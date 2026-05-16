import { CheckCircle, XCircle, Clock, Eye } from "lucide-react"

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
      status: "Pendente",
      customer: "Carlos Souza",
      amount: "R$ 3.200,00",
      date: "15/05/2026",
    },
    {
      id: "NF 2938",
      status: "Concluído",
      customer: "Ana Costa",
      amount: "R$ 950,00",
      date: "15/05/2026",
    },
  ]

  const getStatusConfig = (status) => {

    switch (status) {

      case "Concluído":
        return {
          bg: "bg-green-50",
          text: "text-green-700",
          border: "border-green-200",
          icon: CheckCircle,
        }

      case "Cancelado":
        return {
          bg: "bg-red-50",
          text: "text-red-700",
          border: "border-red-200",
          icon: XCircle,
        }

      case "Pendente":
        return {
          bg: "bg-yellow-50",
          text: "text-yellow-700",
          border: "border-yellow-200",
          icon: Clock,
        }

      default:
        return {
          bg: "bg-gray-50",
          text: "text-gray-700",
          border: "border-gray-200",
          icon: Clock,
        }
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      <div className="flex items-center justify-between mb-6">

        <div>
          <h2 className="text-gray-900 font-semibold mb-1">
            Pedidos do Dia
          </h2>

          <p className="text-sm text-gray-500">
            Últimas movimentações
          </p>
        </div>

        <button className="text-sm text-[#7C3AED] hover:text-[#F97316] transition-colors cursor-pointer">
          Ver todos
        </button>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead>

            <tr className="border-b border-gray-100">

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                Pedido
              </th>

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                Cliente
              </th>

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                Valor
              </th>

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                Data
              </th>

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                Status
              </th>

              <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
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
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >

                  <td className="py-4 px-4">
                    <span className="text-gray-900 font-medium">
                      {order.id}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-600">
                      {order.customer}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-900">
                      {order.amount}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-gray-600 text-sm">
                      {order.date}
                    </span>
                  </td>

                  <td className="py-4 px-4">

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >

                      <StatusIcon className="w-3.5 h-3.5" />

                      {order.status}

                    </span>

                  </td>

                  <td className="py-4 px-4">

                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">

                      <Eye className="w-4 h-4 text-gray-600" />

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