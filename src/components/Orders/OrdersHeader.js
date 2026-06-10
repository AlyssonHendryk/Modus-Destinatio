"use client";

import { Plus } from 'lucide-react';

export function OrdersHeader({ onNewOrderClick }) {
  return (
    <div className="flex items-center justify-between transition-colors duration-200">
      <div>
        {/* 🛠️ AJUSTE: Mantido o text-gray-900 puro para a inversão de cor automática global operar sem bugs */}
        <h1 className="text-gray-900 mb-1 text-2xl font-bold">
          Pedidos
        </h1>
        {/* 🛠️ AJUSTE: Mantido o text-gray-500 sutil para o CSS global convertê-lo para text-muted no escuro */}
        <p className="text-gray-500 text-sm">
          Gerenciamento e fluxo de entregas
        </p>
      </div>

      {/* 🛠️ AJUSTE: Padronizado com as classes nativas limpas de gradiente (from-orange-500 to-orange-600) 
         iguais às que usamos nos botões principais de salvar e confirmar */}
      <button 
        type="button"
        onClick={onNewOrderClick}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-bold text-sm cursor-pointer"
      >
        <Plus className="w-5 h-5 text-white" />
        <span>Novo Pedido</span>
      </button>
    </div>
  );
}