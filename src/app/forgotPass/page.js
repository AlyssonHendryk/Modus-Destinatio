"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EsqueciSenha() {

  // estado do input
  const [email, setEmail] = useState("")

  // mensagem de feedback (erro ou sucesso)
  const [mensagem, setMensagem] = useState("")

  // controle de navegação entre páginas
  const router = useRouter()

  function handleSubmit(e) {
    e.preventDefault()

    // validação simples
    if (!email) {
      setMensagem("Digite um email válido")
      return
    }

    // simulação de envio
    setMensagem("Instruções enviadas para o email!")

    // redireciona após 2 segundos
    setTimeout(() => {
      router.push("/login")
    }, 2000)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-r from-purple-600 to-orange-500">
      
      <div className="bg-white rounded-2xl shadow-xl w-[400px] overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-center p-6">
          <h1 className="text-xl font-bold">Esqueceu a Senha?</h1>
          <p className="text-sm">Enviaremos instruções para seu email</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />
          </div>

          {/* mensagem dinâmica */}
          {mensagem && (
            <p className="text-sm text-center text-purple-600">
              {mensagem}
            </p>
          )}

          <button className="w-full bg-gradient-to-r from-purple-600 to-orange-500 text-white p-3 rounded-lg">
            Enviar Instruções
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full text-gray-600 text-sm"
          >
            ← Voltar para login
          </button>

        </form>

      </div>

    </div>
  )
}