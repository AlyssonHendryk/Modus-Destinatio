"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function TesteSupabase() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [resultado, setResultado] = useState("")
  const [loading, setLoading] = useState(false)

  async function testarLogin(event) {
    event.preventDefault()
    setLoading(true)
    setResultado("Autenticando...")

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (error) {
        setResultado(`Erro: ${error.message}`)
        return
      }

      if (!data.user) {
        setResultado("Não foi possível identificar o usuário.")
        return
      }

      const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("name, role, status")
  .eq("id", data.user.id)
  .single()

if (profileError) {
  setResultado(`Login realizado, mas houve erro ao consultar o perfil: ${profileError.message}`)
  return
}

setResultado(
  `Login e perfil confirmados! Nome: ${profile.name} | Perfil: ${profile.role} | Situação: ${profile.status}`
)
    } catch (error) {
      setResultado(`Erro de conexão: ${error.message}`)
    } finally {
      setLoading(false)
      setPassword("")
    }
  }

  return (
    <main className="max-w-md mx-auto p-10">
      <h1 className="text-2xl font-bold mb-6">
        Teste de autenticação
      </h1>

      <form onSubmit={testarLogin} className="space-y-4">
        <input
          type="email"
          placeholder="E-mail do administrador"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full border rounded-lg p-3"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full border rounded-lg p-3"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white p-3 rounded-lg disabled:opacity-50"
        >
          {loading ? "Autenticando..." : "Testar login"}
        </button>
      </form>

      {resultado && (
        <p className="mt-6">{resultado}</p>
      )}
    </main>
  )
}