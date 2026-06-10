"use client"

import { Search, Bell } from 'lucide-react';

export default function TopBar() {
  return (
    /* 🛠️ AJUSTE: Mantido bg-white e border-gray-200 limpos para o seu globals.css chavear nativamente */
    <header className="bg-white border-b border-gray-200 px-8 py-4 transition-colors duration-200">
      <div className="flex items-center justify-between">
        
        {/* Barra de Busca */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            {/* 🛠️ AJUSTE: Trocado bg-gray-50 por bg-transparent para evitar o bug do fundo asfalto opaco no Modo Claro. 
               Mantida a borda fina e o anel de foco roxo original do projeto. */}
            <input
              type="text"
              placeholder="Buscar pedidos, produtos..."
              className="w-full pl-10 pr-4 py-2.5 bg-transparent border border-gray-300 dark:border-gray-700 text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
            />
          </div>
        </div>

        {/* Notificações e Perfil */}
        <div className="flex items-center gap-4">
          {/* Botão de Notificação sem bg fixo para herdar o tema do header */}
          <button 
            type="button"
            className="relative p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer group"
          >
            <Bell className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
          </button>

          {/* Divisória Vertical e Identidade do Usuário */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
            <div className="text-right">
              {/* Mantido o text-gray-900 e text-gray-500 puros para o CSS global ler na hora do switch */}
              <p className="text-sm text-gray-900 font-semibold">Bruno</p>
              <p className="text-xs text-gray-500 font-medium">Admin</p>
            </div>
            
            {/* Avatar do Usuário */}
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center shadow-sm select-none">
              <span className="text-white font-semibold text-sm">B</span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}