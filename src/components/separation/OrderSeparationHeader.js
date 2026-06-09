"use client"

import { Bell } from "lucide-react"

// Recebe o contador dinâmico do componente pai
export default function OrderSeparationHeader({ pendingCount = 0 }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Separação de Pedidos
        </h1>

        <p className="text-gray-500 text-sm">
          Gerencie os pedidos aguardando separação e acompanhe o andamento da expedição.
        </p>
      </div>

      {/* Alerta Dinâmico */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl shadow-sm animate-pulse-subtle">
          
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>

          <div>
            <p className="text-sm text-purple-900">
              <span className="font-semibold">
                {pendingCount} {pendingCount === 1 ? "novo pedido" : "novos pedidos"}
              </span>{" "}
              aguardando separação
            </p>
          </div>

        </div>
      )}
    </div>
  )
}