"use client"
import { useEffect, useRef, useState } from "react"
import { mfaManagement } from "@/services/mfa"

export default function MfaSettings({ user }) {
  const [state, setState] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState("")
  const [confirmation, setConfirmation] = useState(null)
  const [processing, setProcessing] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const active = useRef(false)
  const busy = useRef(false)
  const createdFactor = useRef(null)
  const revision = useRef(0)
  const userId = user?.id
  const role = user?.role
  const status = user?.status

  useEffect(() => {
    if (!userId || role !== "admin" || status !== "active") return
    active.current = true
    const owner = { id: userId, role, status }
    async function refresh() {
      const version = ++revision.current
      try {
        const snapshot = await mfaManagement.read(owner)
        if (active.current && version === revision.current) setState(snapshot)
      } catch {
        if (active.current && version === revision.current) setError("Não foi possível consultar o 2FA. Atualize os fatores e tente novamente.")
      }
    }
    void refresh()
    const unsubscribe = mfaManagement.subscribe(id => { if (id === owner.id && active.current) void refresh() })
    return () => {
      active.current = false
      revision.current += 1
      unsubscribe()
      // Only the ID owned by this attempt is kept in the ref. The service
      // refuses cleanup of a factor that has already become verified.
      const id = createdFactor.current
      createdFactor.current = null
      if (id) void mfaManagement.cancelEnrollment(owner, id).catch(() => {})
    }
  }, [userId, role, status])

  if (!userId || role !== "admin" || status !== "active") return null

  async function run(label, operation) {
    if (busy.current) return
    busy.current = true
    setProcessing(label)
    setError("")
    setNotice("")
    try { await operation() }
    catch (failure) { if (active.current) setError(failure.message || "Não foi possível concluir a operação de 2FA.") }
    finally {
      if (active.current) { setCode(""); setProcessing("") }
      busy.current = false
    }
  }
  const refresh = () => run("Atualizando...", async () => {
    const snapshot = await mfaManagement.read(user)
    if (active.current) setState(snapshot)
  })
  const start = () => run("Configurando...", async () => {
    const enrollment = await mfaManagement.enroll(user)
    if (!active.current) {
      await mfaManagement.cancelEnrollment(user, enrollment.factorId)
      return
    }
    createdFactor.current = enrollment.factorId
    setSetup(enrollment)
    setConfirmation(null)
  })
  async function confirmSetup(event) {
    event.preventDefault()
    await run("Verificando...", async () => {
      const snapshot = await mfaManagement.confirmEnrollment(user, setup.factorId, code)
      createdFactor.current = null
      if (active.current) {
        setSetup(null)
        setState(snapshot)
        setNotice("Autenticação de dois fatores habilitada.")
      }
    })
  }
  const cancelSetup = () => run("Cancelando...", async () => {
    const id = createdFactor.current
    createdFactor.current = null
    setSetup(null)
    setCode("")
    const snapshot = await mfaManagement.cancelEnrollment(user, id)
    if (active.current) { setState(snapshot); setNotice("Configuração cancelada.") }
  })
  async function confirmRemoval(event) {
    event.preventDefault()
    await run("Desabilitando...", async () => {
      const id = confirmation.factorId
      // Require an explicit current code even at aal2. This also upgrades an
      // aal1 session through the official API before unenroll is attempted.
      await mfaManagement.verifyRemoval(user, id, code)
      const snapshot = await mfaManagement.removeVerified(user, id)
      if (active.current) {
        setState(snapshot)
        setConfirmation(null)
        setNotice(snapshot.verified.length ? "Fator removido. O 2FA continua ativo com os fatores restantes." : "2FA desabilitado.")
      }
    })
  }
  const discard = () => run("Descartando...", async () => {
    const snapshot = await mfaManagement.discardPending(user, confirmation.factorId)
    if (active.current) { setState(snapshot); setConfirmation(null); setNotice("Configuração incompleta descartada.") }
  })
  const verifiedTotp = state?.verified.filter(factor => factor.type === "totp") || []
  return <section aria-labelledby="mfa-settings-title" className="mt-6 border-t border-gray-200 pt-5 space-y-3">
    <h4 id="mfa-settings-title" className="font-semibold text-gray-900">Autenticação de dois fatores</h4>
    {!state && !error && <p role="status" className="text-sm text-gray-600">Carregando fatores...</p>}
    {state && <p className="text-sm text-gray-600">{state.verified.length
      ? `Autenticação de dois fatores ativa. Fatores verificados: ${state.verified.length}.`
      : "Proteja sua conta com um aplicativo autenticador. O 2FA é opcional."}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {processing && <p role="status" className="text-sm text-gray-600">{processing}</p>}
    {setup && <form onSubmit={confirmSetup} className="space-y-3">
      <p className="text-sm text-gray-700">Escaneie o QR Code no autenticador e confirme o primeiro código. O 2FA ainda não está habilitado.</p>
      {/* Auth returns SVG; an img data URL does not inject SVG/HTML markup. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qrCode} alt="QR Code para configurar o aplicativo autenticador" width={200} height={200} className="bg-[#fff] p-2 rounded-lg max-w-full" />
      <p className="text-xs text-gray-600">Chave para configuração manual: <code className="block break-all select-all text-gray-900">{setup.secret}</code></p>
      <label htmlFor="mfa-setup-code" className="block text-sm text-gray-700">Código do autenticador
        <input id="mfa-setup-code" value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={Boolean(processing)} className="form-control mt-1 w-full rounded-lg p-2" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={Boolean(processing)} className="rounded-lg bg-purple-600 text-white px-3 py-2 text-sm disabled:opacity-50">Confirmar habilitação</button>
        <button type="button" disabled={Boolean(processing)} onClick={cancelSetup} className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Cancelar configuração</button>
      </div>
    </form>}
    {!setup && state && !confirmation && <div className="flex flex-wrap gap-2">
      {!state.verified.length && !state.pending.length && <button onClick={start} disabled={Boolean(processing)} className="rounded-lg bg-purple-600 text-white px-3 py-2 text-sm disabled:opacity-50">Habilitar 2FA</button>}
      {verifiedTotp.map(factor => <button key={factor.id} onClick={() => { setCode(""); setConfirmation({ type: "remove", factorId: factor.id }) }} disabled={Boolean(processing)} className="rounded-lg border border-red-300 text-red-700 px-3 py-2 text-sm disabled:opacity-50">Desabilitar 2FA{verifiedTotp.length > 1 ? ` — ${factor.name}` : ""}</button>)}
      {state.pending.length > 0 && <button onClick={() => setConfirmation({ type: "discard", factorId: state.pending[0].id })} disabled={Boolean(processing)} className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Descartar configuração incompleta</button>}
      {state.verified.length > verifiedTotp.length && <p className="text-sm text-gray-600">Existem fatores de outro tipo. Esta tela gerencia somente aplicativos TOTP.</p>}
    </div>}
    {confirmation?.type === "remove" && <form onSubmit={confirmRemoval} className="space-y-3">
      <p className="text-sm text-gray-700">Confirma a remoção deste autenticador? Sua conta perderá esta proteção. Outros fatores existentes serão preservados.</p>
      <label htmlFor="mfa-removal-code" className="block text-sm text-gray-700">Código atual deste autenticador
        <input id="mfa-removal-code" value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={Boolean(processing)} className="form-control mt-1 w-full rounded-lg p-2" />
      </label>
      <button disabled={Boolean(processing)} className="rounded-lg bg-red-700 text-white px-3 py-2 text-sm disabled:opacity-50">Confirmar desabilitação</button>
      <button type="button" disabled={Boolean(processing)} onClick={() => { setConfirmation(null); setCode("") }} className="ml-2 text-sm text-gray-700">Cancelar</button>
    </form>}
    {confirmation?.type === "discard" && <div className="space-y-2">
      <p className="text-sm text-gray-700">Descartar a configuração TOTP não confirmada? Somente esse fator incompleto será removido.</p>
      <button onClick={discard} disabled={Boolean(processing)} className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Confirmar descarte</button>
      <button disabled={Boolean(processing)} onClick={() => setConfirmation(null)} className="ml-2 text-sm text-gray-700">Cancelar</button>
    </div>}
    {!setup && !confirmation && <button type="button" disabled={Boolean(processing)} onClick={refresh} className="text-sm text-purple-700 underline disabled:opacity-50">Atualizar fatores</button>}
  </section>
}
