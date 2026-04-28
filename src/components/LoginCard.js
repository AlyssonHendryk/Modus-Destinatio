"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginCard() {
  const [role, setRole] = useState("admin")
  const router = useRouter()

  return (
    <div className="bg-white rounded-2xl shadow-xl w-[420px] overflow-hidden">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-center py-6 px-4">
        <h1 className="text-2xl font-semibold">Bem-vindo!</h1>
        <p className="text-sm mt-1">Faça login para continuar</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">

        {/* Toggle */}
        <div className="flex gap-3">
          
          <button
            onClick={() => setRole("admin")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
              role === "admin"
                ? "bg-purple-600 text-white shadow-md hover:bg-purple-700"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            👜 Administrador
          </button>

          <button
            onClick={() => setRole("func")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
              role === "func"
                ? "bg-orange-500 text-white shadow-md hover:bg-orange-600"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            👤 Funcionário
          </button>

        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Email
          </label>

          <div className="flex items-center border border-gray-300 rounded-lg px-3 mt-1 focus-within:border-purple-600 transition">
            <span className="text-gray-500">📧</span>

            <input
              type="email"
              placeholder="seu@email.com"
              className="w-full p-2 outline-none text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Senha */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Senha
          </label>

          <div className="flex items-center border border-gray-300 rounded-lg px-3 mt-1 focus-within:border-purple-600 transition">
            <span className="text-gray-500">🔒</span>

            <input
              type="password"
              placeholder="********"
              className="w-full p-2 outline-none text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Esqueceu senha */}
        <p
          onClick={() => router.push("/esqueci-senha")}
          className="text-sm text-purple-600 text-right cursor-pointer transition duration-200 hover:underline hover:text-purple-800"
        >
          Esqueceu a senha?
        </p>

        {/* Botão */}
        <button
          onClick={() => router.push("/PaginaInicial")}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-medium shadow-md transition-all duration-200 transform hover:scale-105 hover:shadow-lg cursor-pointer" 
        >
          Entrar
        </button>

        {/* Cadastro */}
        <p className="text-center text-sm text-gray-600">
          Não tem uma conta?{" "}
          <span className="text-purple-600 cursor-pointer hover:underline">
            Cadastre-se
          </span>
        </p>

      </div>
    </div>
  )
}