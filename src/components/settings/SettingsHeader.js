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
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2 select-none">
        <button 
          type="button"
          onClick={handleGoBack}
          className="hover:text-purple-600 hover:underline transition-all cursor-pointer font-medium"
        >
          Sistema
        </button>
        
        <span className="text-gray-300">/</span>
        
        <span className="text-gray-600 font-semibold">
          Configurações
        </span>
      </div>

      {/* Título e Descrição */}
      <h1 className="text-3xl font-bold text-gray-900">
        {title}
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        {description}
      </p>
    </div>
  )
}