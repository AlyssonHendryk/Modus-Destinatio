"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

function TotpChallenge({ verify, cancel, onCancelError }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    if (!/^\d{6}$/.test(code)) { setError("Informe o código de 6 dígitos do autenticador."); setCode(""); return }
    busy.current = true
    setLoading(true)
    setError("")
    try {
      const result = await verify(code)
      if (!mounted.current) return
      if (!result.ok) setError(result.message || "Não foi possível validar o código. Tente novamente.")
    } catch { if (mounted.current) setError("Não foi possível validar o código. Tente novamente.") }
    finally {
      if (mounted.current) { setCode(""); setLoading(false) }
      busy.current = false
    }
  }
  async function leave() {
    if (busy.current) return
    busy.current = true
    setCode("")
    setLoading(true)
    try { await cancel() }
    catch { onCancelError("Não foi possível encerrar a sessão. Tente sair novamente.") }
    finally { if (mounted.current) setLoading(false); busy.current = false }
  }
  return <form onSubmit={submit} className="space-y-4 p-6">
    <p className="text-sm text-gray-700">Autenticação de dois fatores necessária. Informe o código do aplicativo autenticador.</p>
    <label htmlFor="login-totp" className="block text-sm font-medium text-gray-700">Código do autenticador
      <input id="login-totp" value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={loading} autoFocus className="form-control mt-1 w-full rounded-lg p-2 text-gray-800" />
    </label>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
    <button disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 font-medium text-white disabled:opacity-50">{loading ? "Verificando..." : "Verificar código"}</button>
    <button type="button" disabled={loading} onClick={leave} className="w-full text-sm text-purple-600 disabled:opacity-50">Cancelar e voltar ao login</button>
  </form>
}

export default function LoginCard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login, mfaPending, completeMfa, logout } = useApp()

  async function verifyTotp(code) {
    const result = await completeMfa(code)
    // Keep navigation in the parent: successful verification removes the
    // challenge from the tree as soon as the context releases application access.
    if (result.ok) router.push("/dashboard")
    return result
  }

  async function submit(event) {
    event.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.")
      return
    }

    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.mfaRequired) return
      if (!result.ok) {
        setError(result.message)
        return
      }
      router.push("/dashboard")
    } catch {
      setError("Não foi possível realizar o login. Tente novamente.")
    } finally {
      setPassword("")
      setLoading(false)
    }
  }

  return (
    <div className="w-[420px] max-w-full overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-6 text-center text-white">
        <h1 className="text-2xl font-semibold">Bem-vindo!</h1>
        <p className="mt-1 text-sm">Faça login para continuar</p>
      </div>

      {mfaPending ? <TotpChallenge verify={verifyTotp} cancel={logout} onCancelError={setError} /> : <form onSubmit={submit} className="space-y-4 p-6">
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
          E-mail
          <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required className="form-control mt-1 w-full rounded-lg p-2 text-gray-800" />
        </label>

        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
          Senha
          <input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="form-control mt-1 w-full rounded-lg p-2 text-gray-800" />
        </label>

        <button type="button" onClick={() => router.push("/forgotPass")} className="ml-auto block text-sm text-purple-600 hover:underline">Esqueceu a senha?</button>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 font-medium text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button>

        <p className="text-center text-sm text-gray-600">Não tem uma conta? <button type="button" onClick={() => router.push("/SignUp")} className="text-purple-600 hover:underline">Cadastre-se</button></p>
      </form>}
    </div>
  )
}
