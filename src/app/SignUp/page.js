
"use client"

import Link from "next/link"

export default function SignUp() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-4">
      <div className="bg-white w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-center py-8 px-6">
          <h1 className="text-3xl font-bold">
            Cadastro de Usuários
          </h1>

          <p className="text-sm mt-2 opacity-90">
            Modus Destinatio
          </p>
        </div>

        <div className="p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-purple-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2"
              />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Cadastro restrito
            </h2>

            <p className="text-gray-600 text-sm leading-relaxed">
              O cadastro público de usuários está desativado.
            </p>

            <p className="text-gray-600 text-sm leading-relaxed">
              Novas contas de administradores e funcionários
              devem ser criadas por um administrador autorizado.
            </p>
          </div>

          <Link
            href="/login"
            className="block w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
