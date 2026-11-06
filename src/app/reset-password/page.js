"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { newPasswordRecovery } from "@/services/passwordRecovery"
import { readRecoveryCallback } from "@/utils/passwordRecovery"

export default function ResetPassword() {
  const flow = useRef(null)
  const verification = useRef(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  useEffect(() => {
    let active = true
    mounted.current = true
    // Reuse verification in StrictMode: one-time codes must not be consumed twice.
    if (!verification.current) {
      flow.current = newPasswordRecovery()
      const search = window.location.search
      const hash = window.location.hash
      window.history.replaceState(null, "", window.location.pathname)
      verification.current = Promise.resolve().then(() =>
        flow.current.verifyCallback(readRecoveryCallback(search, hash)))
    }
    verification.current.then(() => {
      if (active) setReady(true)
      else if (!mounted.current) void flow.current.dispose()
    })
      .catch(failure => { if (active) setError(failure.message) })
    return () => {
      active = false
      mounted.current = false
      // StrictMode immediately mounts the effect again; actual navigation must
      // release the memory-only recovery session, including pending verification.
      queueMicrotask(() => { if (!mounted.current) void flow.current?.dispose() })
    }
  }, [])
  async function submit(event) {
    event.preventDefault()
    if (busy.current || !ready) return
    busy.current = true
    setSaving(true)
    setError("")
    try {
      await flow.current.update(password, confirmation)
      if (mounted.current) { setReady(false); setSaved(true) }
    } catch (failure) { if (mounted.current) setError(failure.message) }
    finally {
      if (mounted.current) { setPassword(""); setConfirmation(""); setSaving(false) }
      busy.current = false
    }
  }
  return <main className="min-h-dvh flex flex-col bg-gradient-to-r from-purple-600 to-orange-500 p-4">
    <div className="mx-auto my-auto bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Redefinir senha</h1>
      {!ready && !error && !saved && <p role="status">Validando link...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-green-700">Senha atualizada. Entre novamente com sua nova senha.</p>}
      {ready && <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-gray-700" htmlFor="new-password">Nova senha</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={saving} value={password} onChange={e => setPassword(e.target.value)} className="form-control w-full rounded-xl p-3" />
        <label className="block text-sm text-gray-700" htmlFor="confirm-password">Confirmar nova senha</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required disabled={saving} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="form-control w-full rounded-xl p-3" />
        <button disabled={saving} className="w-full bg-purple-600 text-white py-3 rounded-xl">{saving ? "Salvando..." : "Salvar nova senha"}</button>
      </form>}
      <Link href="/forgotPass" className="block text-sm text-purple-700">Solicitar outro link</Link>
      <Link href="/login" className="block text-sm text-gray-600">Voltar ao login</Link>
    </div>
  </main>
}
