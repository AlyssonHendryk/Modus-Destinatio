"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignUp() {
  const [role, setRole] = useState("admin")
  const router = useRouter()

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500">

      <div className="bg-white w-[420px] rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-center py-10 px-6">
          <h1 className="text-4xl font-bold">Criar Conta</h1>

          <p className="text-sm mt-2 opacity-90">
            Preencha os dados para começar
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-5">

          {/* Toggle */}
          <div className="flex gap-3">

            <button
              onClick={() => setRole("admin")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                role === "admin"
                  ? "bg-purple-600 text-white shadow-lg hover:bg-purple-700"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              <span>👜</span>
              Administrador
            </button>

            <button
              onClick={() => setRole("func")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                role === "func"
                  ? "bg-orange-500 text-white shadow-lg hover:bg-orange-600"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              <span>👤</span>
              Funcionário
            </button>

          </div>

          {/* Nome */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Nome Completo
            </label>

            <div className="flex items-center border border-gray-300 rounded-xl px-3 mt-1 focus-within:border-purple-600 transition-all">
              <span className="text-gray-400">👤</span>

              <input
                type="text"
                placeholder="Seu nome"
                className="w-full p-3 outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Email
            </label>

            <div className="flex items-center border border-gray-300 rounded-xl px-3 mt-1 focus-within:border-purple-600 transition-all">
              <span className="text-gray-400">📧</span>

              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full p-3 outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Senha
            </label>

            <div className="flex items-center border border-gray-300 rounded-xl px-3 mt-1 focus-within:border-purple-600 transition-all">
              <span className="text-gray-400">🔒</span>

              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3 outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Confirmar Senha
            </label>

            <div className="flex items-center border border-gray-300 rounded-xl px-3 mt-1 focus-within:border-purple-600 transition-all">
              <span className="text-gray-400">🔒</span>

              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3 outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Botão */}
          <button
            className="
              w-full
              bg-gradient-to-r
              from-purple-600
              to-pink-500
              text-white
              py-3
              rounded-xl
              font-medium
              shadow-md
              transition-all
              duration-200
              transform
              hover:scale-105
              hover:shadow-xl
              cursor-pointer
            "
          >
            Cadastrar
          </button>

          {/* Voltar */}
          <button
            onClick={() => router.push("/login")}
            className="
              w-full
              flex
              items-center
              justify-center
              gap-2
              text-gray-600
              text-sm
              cursor-pointer
              transition-all
              duration-200
              hover:text-purple-600
            "
          >
            <span>←</span>
            Voltar para login
          </button>

        </div>
      </div>
    </div>
  )
}