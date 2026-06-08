"use client"

import { useState } from "react"
import {
  User,
  Package,
  Play,
  CheckCircle,
  ChevronDown,
  Clock,
  PackageSearch
} from "lucide-react"

export default function OrderSeparationGrid() {
  const [orders, setOrders] = useState([
    {
      id: "#1023",
      customer: "João Silva",
      products: [
        { name: "Camiseta preta", quantity: 1 },
        { name: "Boné", quantity: 1 },
        { name: "Tênis", quantity: 2 }
      ],
      status: "waiting"
    },
    {
      id: "#1024",
      customer: "Maria Santos",
      products: [{ name: "Celular", quantity: 1 }],
      status: "separating"
    },
    {
      id: "#1025",
      customer: "Miguel Oliveira",
      products: [{ name: "Coca Cola Lata", quantity: 12 }],
      status: "completed"
    },
    {
      id: "#1026",
      customer: "Pedro Costa",
      products: [
        { name: "Carregador", quantity: 1 },
        { name: "Teclado", quantity: 1 }
      ],
      status: "completed"
    },
    {
      id: "#1027",
      customer: "Ana Souza",
      products: [
        { name: "Mouse Gamer", quantity: 1 },
        { name: "Mousepad", quantity: 1 }
      ],
      status: "waiting"
    },
    {
      id: "#1028",
      customer: "Carlos Lima",
      products: [{ name: 'Monitor 24"', quantity: 2 }],
      status: "separating"
    }
  ])

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(
      orders.map((order) =>
        order.id === orderId
          ? { ...order, status: newStatus }
          : order
      )
    )
  }

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
            bg: "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
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
            bg: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
            text: "Separando...",
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
            bg: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
            text: "Separado",
            icon: CheckCircle,
            nextStatus: "completed"
          }
        }

      default:
        return {}
    }
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
            className={`bg-white rounded-2xl shadow-sm border-2 ${config.card.border} hover:shadow-xl transition-all duration-300 overflow-hidden group`}
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
                    Cliente:
                    <span className="font-medium ml-1">
                      {order.customer}
                    </span>
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Produtos
                  </p>

                  <ul className="space-y-2">
                    {order.products.map((product, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-500 to-orange-500 rounded-full" />

                        <span>{product.name}</span>

                        <span className="ml-auto px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                          {product.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() =>
                  handleStatusChange(
                    order.id,
                    config.button.nextStatus
                  )
                }
                disabled={order.status === "completed"}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 ${config.button.bg} text-white rounded-xl shadow-lg transition-all duration-300 ${
                  order.status === "completed"
                    ? "cursor-default"
                    : "hover:shadow-xl hover:scale-[1.02]"
                }`}
              >
                <ButtonIcon className="w-5 h-5" />

                <span>{config.button.text}</span>

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