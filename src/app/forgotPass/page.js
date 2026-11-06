"use client"
import { useRef, useState } from "react"
import Link from "next/link"
import { requestPasswordRecovery } from "@/services/passwordRecovery"

export default function EsqueciSenha() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const pending = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setSending(true)
    try { setMessage(await requestPasswordRecovery(email, window.location.origin)) }
    catch (failure) { setMessage(failure.message) }
    finally { pending.current = false; setSending(false) }
  }
  return <main className="min-h-dvh flex flex-col bg-gradient-to-r from-purple-600 to-orange-500 p-4">
    <div className="mx-auto my-auto bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-center p-6"><h1 className="text-xl font-bold">Recuperar senha</h1></div>
      <form onSubmit={submit} className="p-6 space-y-4">
        <label htmlFor="recovery-email" className="block text-sm text-gray-700">E-mail cadastrado</label>
        <input id="recovery-email" type="email" required autoComplete="email" maxLength={254} disabled={sending} value={email} onChange={e => setEmail(e.target.value)} className="form-control w-full rounded-xl p-3" />
        {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
        <button disabled={sending} className="w-full bg-purple-600 text-white py-3 rounded-xl">{sending ? "Enviando..." : "Enviar link de recuperação"}</button>
        <Link href="/login" className="block text-center text-sm text-gray-600">Voltar ao login</Link>
      </form>
    </div>
  </main>
}
