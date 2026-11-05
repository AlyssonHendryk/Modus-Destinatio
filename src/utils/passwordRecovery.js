// A separate, memory-only Auth client owns this flow. Never infer permission
// to reset a password from an existing application session or a URL flag.
export const RECOVERY_MESSAGE = "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação."
const INVALID_LINK = "Link de recuperação inválido ou expirado. Solicite outro link."

// Read before clearing the address bar. The requesting client uses implicit
// flow; token_hash also supports the custom Supabase recovery email template.
export function readRecoveryCallback(search, hash) {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ""))
  if ([query, fragment].some(params => [...params.keys()].some(key => params.getAll(key).length !== 1) ||
      ["error", "error_code", "error_description"].some(key => params.has(key)))) throw new Error(INVALID_LINK)
  if (query.has("code")) throw new Error(INVALID_LINK) // No PKCE verifier is created by this flow.
  if (query.get("type") === "recovery" && query.has("token_hash") && !fragment.toString()) {
    return { kind: "token_hash", tokenHash: query.get("token_hash") }
  }
  if (!query.toString() && fragment.get("type") === "recovery" &&
      fragment.get("access_token") && fragment.get("refresh_token") && fragment.get("token_type") === "bearer") {
    return { kind: "implicit", accessToken: fragment.get("access_token"), refreshToken: fragment.get("refresh_token") }
  }
  throw new Error(INVALID_LINK)
}

// Used by the primary Auth client so it cannot consume a recovery callback or
// persist that temporary identity as the application's regular session.
export function shouldDetectApplicationSession(url, params) {
  return url.pathname.replace(/\/$/, "") !== "/reset-password" &&
    Boolean(params.access_token || params.error || params.error_description || params.error_code)
}

export function validateNewPassword(password, confirmation) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128 ||
      !password.trim() || /[\x00-\x1f\x7f]/.test(password)) throw new Error("Use uma senha de 8 a 128 caracteres válidos.")
  if (password !== confirmation) throw new Error("As senhas não coincidem.")
}

export function createPasswordRecovery(client, reportRequestFailure = category => console.warn("password_recovery_request", category)) {
  let verifiedUserId = null
  let pending = false
  let disposed = false
  async function systemIdentity() {
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id || disposed) throw new Error(INVALID_LINK)
    const id = data.user.id
    // RLS permits reading only this Auth user's profile. No public email lookup,
    // Auth directory or service credential is needed to establish membership.
    const { data: profile, error: profileError } = await client.schema("public").from("profiles")
      .select("id, role, status").eq("id", id).maybeSingle()
    if (profileError || profile?.id !== id || !["admin", "employee"].includes(profile.role) ||
        !["active", "inactive"].includes(profile.status) || disposed) throw new Error(INVALID_LINK)
    return id
  }
  async function verifyCallback(callback) {
    verifiedUserId = null
    try {
      if (disposed) throw new Error()
      let response
      if (callback?.kind === "token_hash" && typeof callback.tokenHash === "string" && /^[a-f0-9]{32,256}$/i.test(callback.tokenHash)) {
        response = await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: "recovery" })
      } else if (callback?.kind === "implicit" && typeof callback.accessToken === "string" && callback.accessToken &&
                 typeof callback.refreshToken === "string" && callback.refreshToken) {
        // Do not let setSession refresh an already expired callback. Use the
        // SDK's signature/expiry verification, never a locally trusted JWT decode.
        const claims = await client.auth.getClaims(callback.accessToken)
        if (claims.error || !claims.data?.claims?.sub || disposed) throw new Error()
        // setSession validates with Auth; URL fields alone never authorize update.
        response = await client.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken })
      } else throw new Error()
      if (response.error || !response.data?.session || !response.data?.user?.id) throw new Error()
      const id = await systemIdentity()
      if (id !== response.data.user.id) throw new Error()
      verifiedUserId = id
    } catch {
      try { await client.auth.signOut({ scope: "local" }) } catch { /* memory only */ }
      throw new Error(INVALID_LINK)
    }
  }
  return {
    async request(email, origin) {
      const trimmed = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 254) throw new Error("Informe um e-mail válido.")
      let failure = null
      try {
        const result = await client.auth.resetPasswordForEmail(trimmed, { redirectTo: `${origin}/reset-password` })
        failure = result?.error
      } catch {
        failure = {} // Never retain or log an exception or its request details.
      }
      if (failure) {
        // Fixed categories only: no account-existence codes, messages, email,
        // tokens, URLs or raw SDK responses. The public response stays neutral.
        const category = failure.status === 429 ? "rate_limited" :
          [500, 502, 503, 504].includes(failure.status) ? "provider_unavailable" : "request_failed"
        reportRequestFailure(category)
      }
      return RECOVERY_MESSAGE
    },
    verifyCallback,
    async update(password, confirmation) {
      validateNewPassword(password, confirmation)
      if (!verifiedUserId) throw new Error("Solicite um novo link de recuperação.")
      if (pending) throw new Error("Atualização em andamento.")
      pending = true
      try {
        if (await systemIdentity() !== verifiedUserId) throw new Error()
        const { data, error } = await client.auth.updateUser({ password })
        if (error || data?.user?.id !== verifiedUserId) throw new Error()
        verifiedUserId = null
        // A confirmed password update is not rolled back if sign-out fails.
        try { await client.auth.signOut({ scope: "local" }) } catch { /* memory only */ }
      } catch {
        throw new Error("Não foi possível atualizar a senha. Verifique a política de senha ou solicite outro link.")
      } finally { pending = false }
    },
    async dispose() {
      disposed = true
      verifiedUserId = null
      try { await client.auth.signOut({ scope: "local" }) } catch { /* memory only */ }
    },
  }
}
