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
    /* 🛠️ AJUSTE: Mantido bg-white puro para que a regra global faça o chaveamento sem conflitos */
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-colors duration-200">

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>

        <div>
          <h3 className="text-gray-900 font-bold text-lg">
            Permissões
          </h3>
          <p className="text-sm text-gray-500">
            Nível de acesso
          </p>
        </div>
      </div>

      <div className="mb-6">
        {/* O badge de Administrador mantém o gradiente roxo original */}
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full text-sm shadow-md font-semibold">
          <Shield className="w-4 h-4" />
          Administrador
        </span>
      </div>

      <div className="space-y-3">
        {permissions.map((permission) => (
          <div
            key={permission}
            /* 🛠️ AJUSTE: Mudado para bg-transparent e adicionada borda sutil para evitar manchas no Modo Claro */
            className="flex items-center gap-3 p-3 bg-transparent border border-gray-100 dark:border-gray-700 rounded-xl transition-colors duration-200"
          >
            {/* Ícone de Check */}
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>

            {/* Mantido o text-gray-900 para o seu CSS global chavear automaticamente no switch */}
            <span className="text-sm font-medium text-gray-900">
              {permission}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}