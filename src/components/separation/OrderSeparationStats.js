"use client"

import {
  Clock,
  PackageSearch,
  PackageCheck,
  Timer,
  Layers
} from "lucide-react"

export default function OrderSeparationStats({ orders = [], activeFilter, onFilterChange }) {
  
  // 1. Cálculos reativos em tempo real baseados na lista que vem do pai
  const countWaiting = orders.filter(o => o.status === "waiting").length
  const countSeparating = orders.filter(o => o.status === "separating").length
  const countCompleted = orders.filter(o => o.status === "completed").length
  const countTotal = orders.length

  // Mapeamento dos cards de estatísticas com seus respectivos filtros e valores reais
  const stats = [
    {
      id: "all",
      title: "Todos os Pedidos",
      value: countTotal,
      icon: Layers,
      color: "from-blue-500 to-blue-600",
      borderColor: "border-blue-500",
      bgColor: "bg-blue-50/30"
    },
    {
      id: "waiting",
      title: "Pedidos Aguardando",
      value: countWaiting,
      icon: Clock,
      color: "from-purple-500 to-purple-600",
      borderColor: "border-purple-500",
      bgColor: "bg-purple-50/30"
    },
    {
      id: "separating",
      title: "Em Separação",
      value: countSeparating,
      icon: PackageSearch,
      color: "from-orange-500 to-orange-600",
      borderColor: "border-orange-500",
      bgColor: "bg-orange-50/30"
    },
    {
      id: "completed",
      title: "Concluídos Hoje",
      value: countCompleted,
      icon: PackageCheck,
      color: "from-green-500 to-green-600",
      borderColor: "border-green-500",
      bgColor: "bg-green-50/30"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon
        // Verifica se este card específico é o filtro que está ativo no momento
        const isSelected = activeFilter === stat.id

        return (
          <button
            key={stat.id}
            type="button"
            // PROTEÇÃO APLICADA: Executa apenas se onFilterChange for uma função válida
            onClick={() => {
              if (typeof onFilterChange === "function") {
                onFilterChange(stat.id)
              }
            }}
            className={`w-full text-left rounded-2xl p-6 shadow-sm border-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer select-none ${
              isSelected 
                ? `${stat.borderColor} ${stat.bgColor}` 
                : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-2 font-medium">
                  {stat.title}
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {stat.value}
                </h3>
              </div>

              <div
                className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105`}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}