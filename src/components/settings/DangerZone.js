"use client"

import { AlertTriangle, Trash2 } from "lucide-react"

export default function DangerZone({ onDeleteAccount }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-200">

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>

        <div>
          <h3 className="text-red-900 font-semibold">
            Zona de Perigo
          </h3>
          <p className="text-sm text-red-600">
            Ações irreversíveis
          </p>
        </div>
      </div>

      <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
        <p className="text-sm text-red-700 mb-2">
          Ao excluir sua conta, todos os seus dados serão permanentemente removidos do sistema.
        </p>
        <p className="text-xs text-red-600">
          Esta ação é <strong>irreversível</strong>.
        </p>
      </div>

      {/* Adicionado o evento onClick e a classe cursor-pointer */}
      <button 
        type="button"
        onClick={onDeleteAccount}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        <span className="text-sm font-medium">
          Excluir Conta
        </span>
      </button>

    </div>
  )
}