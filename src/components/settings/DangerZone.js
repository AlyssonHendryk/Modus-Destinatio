"use client"

import { AlertTriangle, Trash2 } from "lucide-react"

export default function DangerZone({ onDeleteAccount }) {
  return (
    /* 🛠️ AJUSTE: Mantido o bg-white puro para a regra global agir no card, preservando a borda de alerta vermelha */
    <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-200 dark:border-red-900/50 transition-colors duration-200">

      <div className="flex items-center gap-3 mb-4">
        {/* Ícone de aviso com fundo vermelho suave adaptável */}
        <div className="w-10 h-10 bg-red-100 dark:bg-red-950/40 rounded-lg flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>

        <div>
          {/* Mantidos os tons de vermelho legíveis sem misturar opacidade por cima do texto */}
          <h3 className="text-red-600 dark:text-red-400 font-bold text-lg">
            Zona de Perigo
          </h3>
          <p className="text-sm text-red-500 font-medium">
            Ações irreversíveis
          </p>
        </div>
      </div>

      {/* 🛠️ AJUSTE: Caixa de aviso usa bg-transparent para evitar que o seletor injete o cinza asfalto no Modo Claro */}
      <div className="p-4 bg-transparent border border-red-200 dark:border-red-900/40 rounded-xl mb-4">
        <p className="text-sm text-red-600 dark:text-red-300 mb-2 font-medium">
          Ao excluir sua conta, todos os seus dados serão permanentemente removidos do sistema.
        </p>
        <p className="text-xs text-red-500 dark:text-red-400 font-medium">
          Esta ação é <strong className="font-bold underline">irreversível</strong>.
        </p>
      </div>

      {/* Botão de exclusão vermelho vibrante mantendo o padrão de atenção sem classes dark conflitantes */}
      <button 
        type="button"
        onClick={onDeleteAccount}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer font-semibold text-sm"
      >
        <Trash2 className="w-4 h-4" />
        <span>
          Excluir Conta
        </span>
      </button>

    </div>
  )
}