"use client"

import { Bell } from "lucide-react"

export default function OrderSeparationHeader() {
  const pendingCount = 2

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Separação de Pedidos
        </h1>

        <p className="text-gray-500">
          Gerencie os pedidos aguardando separação e acompanhe o andamento da expedição.
        </p>
      </div>

      {/* Alerta */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl shadow-sm">
          
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>

          <div>
            <p className="text-sm text-purple-900">
              <span className="font-semibold">
                {pendingCount} novos pedidos
              </span>{" "}
              aguardando separação
            </p>
          </div>

        </div>
      )}
    </div>
  )
}