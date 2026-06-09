"use client"

import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"

export default function KPICards() {

  const kpis = [
    {
      title: "Pedidos Hoje",
      value: "24",
      change: "+12%",
      isPositive: true,
      icon: ShoppingCart,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Estoque Baixo",
      value: "3",
      change: "-2",
      isPositive: false,
      icon: AlertTriangle,
      color: "from-orange-500 to-orange-600",
    },
    {
      title: "Vendas do Dia",
      value: "R$ 12.5k",
      change: "+18%",
      isPositive: true,
      icon: TrendingUp,
      color: "from-green-500 to-green-600",
    },
    {
      title: "Produtos Ativos",
      value: "142",
      change: "+5",
      isPositive: true,
      icon: Package,
      color: "from-purple-500 to-purple-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon

        return (
          <div
            key={kpi.title}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* Topo */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  {kpi.title}
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {kpi.value}
                </h3>
              </div>

              {/* Ícone */}
              <div className={`w-12 h-12 bg-gradient-to-br ${kpi.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1">
              <span className={`text-sm font-medium ${kpi.isPositive ? "text-green-600" : "text-red-600"}`}>
                {kpi.change}
              </span>
              <span className="text-xs text-gray-500">
                vs. ontem
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}