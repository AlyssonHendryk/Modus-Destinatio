"use client"

import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

export default function InventoryTable({ items = [] }) {

  const getStockLevel = (quantity, max) => {
    const percentage = (quantity / max) * 100

    if (percentage < 30) {
      return {
        color: "bg-red-500 dark:bg-red-500",
        level: "low",
        label: "Baixo",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-300 dark:border-red-900/60",
        indicatorColor: "bg-red-500"
      }
    }

    if (percentage < 60) {
      return {
        color: "bg-amber-500 dark:bg-amber-500",
        level: "medium",
        label: "Médio",
        text: "text-amber-500 dark:text-amber-400",
        border: "border-amber-300 dark:border-amber-900/60",
        indicatorColor: "bg-amber-500"
      }
    }

    return {
      color: "bg-green-500 dark:bg-green-500",
      level: "high",
      label: "Alto",
      text: "text-green-600 dark:text-green-400",
      border: "border-green-300 dark:border-green-800/60",
      indicatorColor: "bg-green-500"
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-1">
          Itens Armazenados
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Status do estoque
        </p>
      </div>

      {/* Lista Dinâmica */}
      <div className="space-y-8">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum item em estoque encontrado.</p>
        ) : (
          items.map((item) => {
            const stockLevel = getStockLevel(item.quantity, item.max)
            const percentage = Math.min(100, Math.max(0, (item.quantity / item.max) * 100))

            return (
              <div key={item.name} className="space-y-2">
                
                {/* Nome do Item */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-900 dark:text-gray-100 font-bold text-base tracking-tight">
                      {item.name}
                    </span>
                    {stockLevel.level === "low" && (
                      <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
                    )}
                  </div>
                </div>

                {/* Área da Barra com Bloco Flutuante Unificado */}
                <div className="relative pt-7 pb-2 overflow-visible">
                  
                  {/* 🛠️ SOLUÇÃO: Bloco único absoluto. O min-w-[80px] e o flex-col impedem o texto de sumir ou colapsar */}
                  <div 
                    className="absolute top-0 flex flex-col items-center min-w-[80px] transition-all duration-300 -translate-x-1/2 z-10 select-none"
                    style={{ left: `${percentage}%` }}
                  >
                    {/* Texto + Seta na mesma linha horizontal */}
                    <div className="flex items-center justify-center gap-1 w-full text-center">
                      <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">
                        {item.quantity} un
                      </span>
                      {item.trend === "up" ? (
                        <TrendingUp className="w-4 h-4 text-green-500 font-bold shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 font-bold shrink-0" />
                      )}
                    </div>

                    {/* Pino indicador posicionado logo abaixo do texto e acima da barra */}
                    <div className={`w-[2px] h-2 ${stockLevel.indicatorColor} mt-1`} />
                  </div>

                  {/* Barra de Progresso */}
                  <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 ${stockLevel.color} rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Rodapé */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-400 dark:text-gray-500 font-semibold">
                    0
                  </span>

                  <span
                    className={`px-3 py-0.5 rounded-full font-bold border bg-transparent transition-colors ${stockLevel.text} ${stockLevel.border}`}
                  >
                    {stockLevel.label}
                  </span>

                  <span className="text-gray-400 dark:text-gray-500 font-semibold">
                    {item.max}
                  </span>
                </div>

              </div>
            )
          })
        )}
      </div>

    </div>
  )
}