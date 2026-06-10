"use client"

import { CheckCircle, XCircle, Clock, Truck, Eye } from "lucide-react"

export default function OrdersList() {

  const orders = [
    {
      id: "NF 2941",
      status: "Cancelado",
      customer: "João Silva",
      amount: "R$ 2.450,00",
      date: "16/05/2026",
    },
    {
      id: "NF 2940",
      status: "Concluído",
      customer: "Maria Santos",
      amount: "R$ 1.890,00",
      date: "16/05/2026",
    },
    {
      id: "NF 2939",
      status: "Em Rota",
      customer: "Carlos Souza",
      amount: "R$ 3.200,00",
      date: "15/05/2026",
    },
    {
      id: "NF 2938",
      status: "Pendente",
      customer: "Ana Costa",
      amount: "R$ 950,00",
      date: "15/05/2026",
    },
  ]

  // 🎨 SINALIZAÇÃO VIVA: Sem opacidade de fundo para evitar interferência do CSS global
  const getStatusConfig = (status) => {
    switch (status) {
      case "Concluído":
        return {
          bg: "bg-transparent",
          text: "text-green-600 dark:text-green-400",
          border: "border-green-300 dark:border-green-800/60",
          icon: CheckCircle,
        }

      case "Cancelado":
        return {
          bg: "bg-transparent",
          text: "text-red-600 dark:text-red-400",
          border: "border-red-300 dark:border-red-800/60",
          icon: XCircle,
        }

      case "Pendente":
        return {
          bg: "bg-transparent",
          text: "text-amber-500 dark:text-amber-400",
          border: "border-amber-300 dark:border-amber-800/60",
          icon: Clock,
        }

      case "Em Rota":
        return {
          bg: "bg-transparent",
          text: "text-blue-600 dark:text-blue-400",
          border: "border-blue-300 dark:border-blue-800/60",
          icon: Truck,
        }

      default:
        return {
          bg: "bg-transparent",
          text: "text-gray-600 dark:text-gray-400",
          border: "border-gray-300 dark:border-gray-700",
          icon: Clock,
        }
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-colors duration-200">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900 font-bold text-lg mb-1">
            Pedidos do Dia
          </h2>
          <p className="text-sm text-gray-500">
            Últimas movimentações
          </p>
        </div>

        <button 
          type="button"
          className="text-sm text-purple-600 hover:text-orange-500 font-semibold transition-colors cursor-pointer"
        >
          Ver todos
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Pedido
              </th>
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Cliente
              </th>
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Valor
              </th>
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Data
              </th>
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Status
              </th>
              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => {
              const statusConfig = getStatusConfig(order.status)
              const StatusIcon = statusConfig.icon

              return (
                <tr
                  key={order.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className="text-gray-900 font-semibold">
                      {order.id}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-700 font-medium">
                      {order.customer}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-900 font-bold">
                      {order.amount}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-600 text-sm font-medium">
                      {order.date}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    {/* 🛠️ BADGES ATUALIZADOS: Bordas finas coloridas e texto em destaque total */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {order.status}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <button 
                      type="button"
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer group"
                    >
                      <Eye className="w-4 h-4 text-gray-500 group-hover:text-gray-900" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}