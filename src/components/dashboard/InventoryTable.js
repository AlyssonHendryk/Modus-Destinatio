"use client"

import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

export default function InventoryTable() {

  const items = [
    {
      name: "Óleo",
      quantity: 91,
      max: 150,
      trend: "up",
    },

    {
      name: "Macarrão",
      quantity: 20,
      max: 100,
      trend: "down",
    },

    {
      name: "Arroz",
      quantity: 45,
      max: 80,
      trend: "up",
    },

    {
      name: "Feijão",
      quantity: 12,
      max: 60,
      trend: "down",
    },
  ]

  const getStockLevel = (quantity, max) => {

    const percentage = (quantity / max) * 100

    if (percentage < 30) {
      return {
        color: "bg-red-500",
        level: "low",
        label: "Baixo",
      }
    }

    if (percentage < 60) {
      return {
        color: "bg-yellow-500",
        level: "medium",
        label: "Médio",
      }
    }

    return {
      color: "bg-green-500",
      level: "high",
      label: "Alto",
    }
  }

  return (

    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      {/* Header */}
      <div className="mb-6">

        <h2 className="text-gray-900 font-semibold mb-1">
          Itens Armazenados
        </h2>

        <p className="text-sm text-gray-500">
          Status do estoque
        </p>

      </div>

      {/* Lista */}
      <div className="space-y-5">

        {items.map((item) => {

          const stockLevel = getStockLevel(
            item.quantity,
            item.max
          )

          const percentage =
            (item.quantity / item.max) * 100

          return (

            <div
              key={item.name}
              className="space-y-2"
            >

              {/* Topo */}
              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <span className="text-gray-900 font-medium">
                    {item.name}
                  </span>

                  {stockLevel.level === "low" && (

                    <AlertTriangle className="w-4 h-4 text-red-500" />

                  )}

                </div>

                <div className="flex items-center gap-3">

                  <span className="text-sm text-gray-600">
                    {item.quantity} un
                  </span>

                  {item.trend === "up" ? (

                    <TrendingUp className="w-4 h-4 text-green-500" />

                  ) : (

                    <TrendingDown className="w-4 h-4 text-red-500" />

                  )}

                </div>

              </div>

              {/* Barra */}
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">

                <div
                  className={`absolute inset-y-0 left-0 ${stockLevel.color} rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />

              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs">

                <span className="text-gray-500">
                  0
                </span>

                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    stockLevel.level === "low"
                      ? "bg-red-50 text-red-700"
                      : stockLevel.level === "medium"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >

                  {stockLevel.label}

                </span>

                <span className="text-gray-500">
                  {item.max}
                </span>

              </div>

            </div>
          )
        })}

      </div>

    </div>
  )
}