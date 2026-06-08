"use client"

import {
  Clock,
  PackageSearch,
  PackageCheck,
  Timer
} from "lucide-react"

export default function OrderSeparationStats() {
  const stats = [
    {
      title: "Pedidos Aguardando",
      value: "8",
      icon: Clock,
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "Em Separação",
      value: "3",
      icon: PackageSearch,
      color: "from-orange-500 to-orange-600"
    },
    {
      title: "Concluídos Hoje",
      value: "24",
      icon: PackageCheck,
      color: "from-green-500 to-green-600"
    },
    {
      title: "Tempo Médio",
      value: "12 min",
      icon: Timer,
      color: "from-blue-500 to-blue-600"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon

        return (
          <div
            key={stat.title}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm text-gray-500 mb-2">
                  {stat.title}
                </p>

                <h3 className="text-3xl font-bold text-gray-900">
                  {stat.value}
                </h3>
              </div>

              <div
                className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg`}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>

            </div>
          </div>
        )
      })}
    </div>
  )
}