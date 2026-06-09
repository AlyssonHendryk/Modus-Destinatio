"use client"

import {
  User,
  Package,
  Play,
  CheckCircle,
  ChevronDown,
  Clock,
  PackageSearch
} from "lucide-react"

export default function OrderSeparationGrid({ orders = [], onStatusChange }) {
  
  const getStatusConfig = (status) => {
    switch (status) {
      case "waiting":
        return {
          badge: {
            bg: "bg-purple-50",
            text: "text-purple-700",
            border: "border-purple-200",
            icon: Clock,
            label: "Aguardando"
          },
          card: {
            border: "border-purple-200",
            iconBg: "from-purple-500 to-purple-600"
          },
          button: {
            bg: "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 cursor-pointer",
            text: "Iniciar Separação",
            icon: Play,
            nextStatus: "separating"
          }
        }

      case "separating":
        return {
          badge: {
            bg: "bg-orange-50",
            text: "text-orange-700",
            border: "border-orange-200",
            icon: PackageSearch,
            label: "Em Separação"
          },
          card: {
            border: "border-orange-200",
            iconBg: "from-orange-500 to-orange-600"
          },
          button: {
            bg: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 cursor-pointer",
            text: "Concluir Separação",
            icon: PackageSearch,
            nextStatus: "completed"
          }
        }

      case "completed":
        return {
          badge: {
            bg: "bg-green-50",
            text: "text-green-700",
            border: "border-green-200",
            icon: CheckCircle,
            label: "Separado"
          },
          card: {
            border: "border-green-200",
            iconBg: "from-green-500 to-green-600"
          },
          button: {
            bg: "bg-gray-100 text-gray-400 border border-gray-200 cursor-default",
            text: "Concluído",
            icon: CheckCircle,
            nextStatus: "completed"
          }
        }

      default:
        return {}
    }
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Nenhum pedido encontrado neste status.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {orders.map((order) => {
        const config = getStatusConfig(order.status)
        const StatusIcon = config.badge.icon
        const ButtonIcon = config.button.icon

        return (
          <div
            key={order.id}
            className={`bg-white rounded-2xl shadow-sm border-2 ${config.card.border} hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col justify-between`}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-gray-900 font-semibold mb-2">
                    PEDIDO {order.id}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${config.badge.bg} ${config.badge.text} ${config.badge.border}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {config.badge.label}
                  </span>
                </div>

                <div
                  className={`w-12 h-12 bg-gradient-to-br ${config.card.iconBg} rounded-xl flex items-center justify-center shadow-lg`}
                >
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    Cliente: <span className="font-medium ml-1">{order.customer}</span>
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Produtos</p>
                  <ul className="space-y-2">
                    {order.products.map((product, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-500 to-orange-500 rounded-full" />
                        <span>{product.name}</span>
                        <span className="ml-auto px-2 py-0.5 bg-gray-100 rounded-full text-xs font-semibold">
                          {product.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 mt-auto">
              <button
                type="button"
                onClick={() => onStatusChange(order.id, config.button.nextStatus)}
                disabled={order.status === "completed"}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-md transition-all duration-300 ${config.button.bg} ${
                  order.status !== "completed" && "hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] text-white"
                }`}
              >
                <ButtonIcon className="w-5 h-5" />
                <span className="text-sm font-semibold">{config.button.text}</span>
                {order.status !== "completed" && (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}