import { supabase } from "../lib/supabase.js"

const FAILURE = "Não foi possível verificar a autenticação de dois fatores. Entre novamente ou tente mais tarde."
const CODE_FAILURE = "Não foi possível validar o código. Confira o autenticador e tente novamente ou entre novamente."

export function createMfaService(client) {
  async function identity(userId) {
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id || data.user.id !== userId) throw new Error(FAILURE)
  }
  async function requirement(user) {
    if (user.role !== "admin") return { required: false }
    try {
      await identity(user.id)
      const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError || !["aal1", "aal2"].includes(assurance?.currentLevel)) throw new Error()
      if (assurance.currentLevel === "aal2") return { required: false, level: "aal2" }
      const { data, error } = await client.auth.mfa.listFactors()
      if (error || !Array.isArray(data?.all) || data.all.some(factor =>
        !factor || !["verified", "unverified"].includes(factor.status))) throw new Error()
      await identity(user.id)
      const verified = data.all.filter(factor => factor.status === "verified")
      const totp = verified.find(factor => factor.factor_type === "totp" && typeof factor.id === "string" && factor.id)
      return { required: verified.length > 0, level: "aal1", factorId: totp?.id ?? null }
    } catch { throw new Error(FAILURE) }
  }
  return {
    requirement,
    async verify(user, code) {
      if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new Error("Informe o código de 6 dígitos do autenticador.")
      try {
        const state = await requirement(user)
        if (!state.required || !state.factorId) throw new Error()
        const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: state.factorId, code })
        if (error || !data?.access_token || data.user?.id !== user.id) throw new Error()
        return data.access_token
      } catch { throw new Error(CODE_FAILURE) }
    },
    async discardStaleSession(userId, accessToken) {
      // A late verification must not resurrect a cancelled session. Never sign
      // out a newer login: only discard the exact session returned by this call.
      const { data, error } = await client.auth.getSession()
      if (!error && data?.session?.user?.id === userId && data.session.access_token === accessToken) {
        await client.auth.signOut({ scope: "local" })
      }
    },
  }
}

const mfa = createMfaService(supabase)
export const getMfaRequirement = mfa.requirement
export const verifyMfaChallenge = mfa.verify
export const discardStaleMfaSession = mfa.discardStaleSession

class MfaSettingsError extends Error {}
const SETTINGS_FAILURE = "Não foi possível concluir a operação de 2FA. Atualize os fatores e tente novamente."
function checkCode(code) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new MfaSettingsError("Informe o código de 6 dígitos do autenticador.")
}

export function createMfaManagement(client) {
  const creating = new Map()
  const busy = new Set()
  const owned = new Map() // Factor IDs only. Never retain QR codes or secrets here.
  const listeners = new Set()
  async function safe(action) {
    try { return await action() }
    catch (error) { throw error instanceof MfaSettingsError ? error : new MfaSettingsError(SETTINGS_FAILURE) }
  }
  async function authorized(user) {
    if (user?.role !== "admin" || user?.status !== "active") throw new MfaSettingsError("Esta operação exige um administrador ativo.")
    const { data, error } = await client.auth.getUser()
    if (error || data?.user?.id !== user.id) throw new Error()
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("role, status").eq("id", user.id).single()
    if (profileError || profile?.role !== "admin" || profile?.status !== "active") throw new Error()
  }
  async function factors(user) {
    await authorized(user)
    const { data, error } = await client.auth.mfa.listFactors()
    if (error || !Array.isArray(data?.all) || data.all.some(factor =>
      !factor || typeof factor.id !== "string" || !factor.id ||
      !["verified", "unverified"].includes(factor.status))) throw new Error()
    await authorized(user)
    return data.all
  }
  async function assurance() {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !["aal1", "aal2"].includes(data?.currentLevel)) throw new Error()
    return data.currentLevel
  }
  async function snapshot(user) {
    const all = await factors(user)
    const level = await assurance()
    return {
      level,
      verified: all.filter(factor => factor.status === "verified").map(factor => ({
        id: factor.id, type: factor.factor_type,
        name: typeof factor.friendly_name === "string" ? factor.friendly_name : "Aplicativo autenticador",
      })),
      pending: all.filter(factor => factor.factor_type === "totp" && factor.status === "unverified")
        .map(factor => ({ id: factor.id })),
    }
  }
  function notify(userId) {
    for (const listener of listeners) listener(userId)
  }
  async function mutate(user, action) {
    if (busy.has(user?.id)) throw new MfaSettingsError("Operação em andamento. Aguarde.")
    busy.add(user?.id)
    try { return await safe(action) } finally { busy.delete(user?.id) }
  }
  async function removePending(user, factorId, requireOwnership) {
    if (requireOwnership && owned.get(factorId) !== user.id) throw new Error()
    const all = await factors(user)
    const factor = all.find(item => item.id === factorId)
    if (!factor) { owned.delete(factorId); return snapshot(user) }
    if (factor.factor_type !== "totp" || factor.status !== "unverified") throw new Error()
    const { error } = await client.auth.mfa.unenroll({ factorId })
    if (error) throw new Error()
    const state = await snapshot(user)
    if (state.pending.some(item => item.id === factorId) || state.verified.some(item => item.id === factorId)) throw new Error()
    owned.delete(factorId)
    notify(user.id)
    return state
  }
  return {
    read: user => safe(() => snapshot(user)),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    enroll(user) {
      if (creating.has(user?.id)) return creating.get(user.id)
      const operation = mutate(user, async () => {
        const state = await snapshot(user)
        if (state.verified.length) throw new MfaSettingsError("O 2FA já está ativo. Atualize os fatores.")
        if (state.pending.length) throw new MfaSettingsError("Existe uma configuração incompleta. Descarte-a explicitamente antes de iniciar outra.")
        await authorized(user)
        const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" })
        if (error || data?.type !== "totp" || typeof data.id !== "string" || !data.id) throw new Error()
        owned.set(data.id, user.id)
        try {
          const prefix = "data:image/svg+xml;utf-8,"
          if (!data.totp?.qr_code?.startsWith(prefix) || typeof data.totp.secret !== "string" || !data.totp.secret ||
              typeof data.totp.uri !== "string" || !data.totp.uri.startsWith("otpauth://totp/")) throw new Error()
          // SDK 2.118.0 prefixes the raw SVG. Encode it for a safe img data URL
          // (including '#' colors); never insert SVG markup into the DOM.
          const svg = data.totp.qr_code.slice(prefix.length)
          // Parse as XML so declarations, comments and a valid SVG prolog are
          // accepted without accepting malformed markup or another root type.
          // The parsed document is never inserted into the page.
          const document = new DOMParser().parseFromString(svg, "image/svg+xml")
          if (document.getElementsByTagName("parsererror").length ||
              document.documentElement?.localName !== "svg" ||
              document.documentElement.namespaceURI !== "http://www.w3.org/2000/svg") throw new Error()
          await authorized(user)
          return { factorId: data.id, qrCode: prefix + encodeURIComponent(svg), secret: data.totp.secret }
        } catch {
          try { await removePending(user, data.id, true) } catch { /* Explicit pending-factor cleanup remains available. */ }
          throw new Error()
        }
      }).finally(() => creating.delete(user?.id))
      creating.set(user?.id, operation)
      return operation
    },
    confirmEnrollment(user, factorId, code) {
      return mutate(user, async () => {
        checkCode(code)
        if (owned.get(factorId) !== user.id) throw new Error()
        const all = await factors(user)
        if (!all.some(factor => factor.id === factorId && factor.factor_type === "totp" && factor.status === "unverified")) throw new Error()
        const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
        if (error || data?.user?.id !== user.id) throw new Error()
        const state = await snapshot(user)
        if (state.level !== "aal2" || !state.verified.some(factor => factor.id === factorId)) throw new Error()
        owned.delete(factorId)
        notify(user.id)
        return state
      })
    },
    cancelEnrollment(user, factorId) { return mutate(user, () => removePending(user, factorId, true)) },
    discardPending(user, factorId) { return mutate(user, () => removePending(user, factorId, false)) },
    verifyRemoval(user, factorId, code) {
      return mutate(user, async () => {
        checkCode(code)
        const all = await factors(user)
        if (!all.some(factor => factor.id === factorId && factor.factor_type === "totp" && factor.status === "verified")) throw new Error()
        const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
        if (error || data?.user?.id !== user.id || await assurance() !== "aal2") throw new Error()
      })
    },
    removeVerified(user, factorId) {
      return mutate(user, async () => {
        const all = await factors(user)
        if (!all.some(factor => factor.id === factorId && factor.factor_type === "totp" && factor.status === "verified")) throw new Error()
        if (await assurance() !== "aal2") throw new MfaSettingsError("Confirme um código do autenticador antes de remover o fator.")
        await authorized(user)
        const { error } = await client.auth.mfa.unenroll({ factorId })
        if (error) throw new Error()
        const state = await snapshot(user)
        if (state.verified.some(factor => factor.id === factorId) || state.pending.some(factor => factor.id === factorId)) throw new Error()
        notify(user.id)
        return state
      })
    },
  }
}

export const mfaManagement = createMfaManagement(supabase)
