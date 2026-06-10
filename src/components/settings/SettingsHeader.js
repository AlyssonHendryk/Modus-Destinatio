"use client"

import { useRouter } from "next/navigation"

export default function SettingsHeader({ title, description }) {
  const router = useRouter()

  const handleGoBack = () => {
    // Redireciona fisicamente para a página do dashboard principal
    router.push("/dashboard")
  }

  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-2 select-none transition-colors duration-200">
        <button 
          type="button"
          onClick={handleGoBack}
          /* Mantido o hover roxo para a identidade visual do clique */
          className="hover:text-purple-600 hover:underline transition-all cursor-pointer font-semibold"
        >
          Sistema
        </button>
        
        <span className="text-gray-400">/</span>
        
        <span className="text-gray-900 font-bold transition-colors duration-200">
          Configurações
        </span>
      </div>

      {/* Título e Descrição */}
      {/* 🛠️ AJUSTE: Adicionado transition-colors para o chaveamento de cor acompanhar o efeito do resto do sistema */}
      <h1 className="text-3xl font-bold text-gray-900 transition-colors duration-200">
        {title}
      </h1>
      <p className="text-sm text-gray-500 mt-1 transition-colors duration-200">
        {description}
      </p>
    </div>
  )
}