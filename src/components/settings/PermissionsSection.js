"use client"

import { Shield, Check } from "lucide-react"

export default function PermissionsSection() {
  const permissions = [
    "Gerenciar usuários",
    "Gerenciar estoque",
    "Gerenciar pedidos",
    "Gerenciar separação",
    "Visualizar relatórios",
    "Exportar dados"
  ]

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      <div className="flex items-center gap-3 mb-6">

        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>

        <div>
          <h3 className="text-gray-900 font-semibold">
            Permissões
          </h3>

          <p className="text-sm text-gray-500">
            Nível de acesso
          </p>
        </div>

      </div>

      <div className="mb-6">

        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full text-sm shadow-lg">

          <Shield className="w-4 h-4" />

          Administrador

        </span>

      </div>

      <div className="space-y-3">

        {permissions.map((permission) => (
          <div
            key={permission}
            className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl"
          >

            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>

            <span className="text-sm text-gray-700">
              {permission}
            </span>

          </div>
        ))}

      </div>

    </div>
  )
}