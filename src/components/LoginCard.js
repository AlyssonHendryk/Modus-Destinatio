"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

export default function LoginCard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useApp()

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
      if (!result.ok) {
        setError(result.message)
        return
      }
      router.push("/dashboard")
    } catch (loginError) {
      console.error("Erro ao autenticar:", loginError)
      setError("Não foi possível realizar o login. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-[420px] max-w-full overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-6 text-center text-white">
        <h1 className="text-2xl font-semibold">Bem-vindo!</h1>
        <p className="mt-1 text-sm">Faça login para continuar</p>
      </div>

      <form onSubmit={submit} className="space-y-4 p-6">
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
      </form>
    </div>
  )
}
