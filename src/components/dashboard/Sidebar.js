"use client"

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  FolderPlus,
  Settings,
  LogOut,
} from "lucide-react"
import Link from "next/link"

export default function Sidebar({ activeTab, onTabChange }) {
  const menuItems = [
    {
      id: "dashboard",
      label: "Tela Inicial",
      icon: LayoutDashboard,
    },
    {
      id: "pedidos",
      label: "Pedidos",
      icon: ShoppingCart,
    },
    {
      id: "estoque",
      label: "Estoque",
      icon: Package,
    },
    {
      id: "separar",
      label: "Separar Pedidos",
      icon: ClipboardList,
    },
    {
      // 🛠️ ADICIONADO: Nova rota para o Módulo de Cadastros Gerais
      id: "cadastros",
      label: "Cadastros",
      icon: FolderPlus,
    },
  ]

  // Função interna para lidar com o botão Sair
  const handleLogout = () => {
    if (confirm("Deseja realmente sair do sistema?")) {
      window.location.href = "/"
    }
  }

  return (
    <aside className="w-72 bg-[#111c5a] text-white flex flex-col shadow-xl select-none">
      {/* Topo com o nome do sistema ModusDestinatio */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white tracking-wide text-base">ModusDestinatio</h2>
            <p className="text-xs text-white/50 font-medium">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.01] group cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-purple-600 shadow-md text-white font-bold"
                  : "text-white/70 hover:bg-white/5 hover:text-white font-semibold"
              }`}
            >
              <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-white" : "text-white/60 group-hover:text-white"}`} />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer / Opções de Rodapé */}
      <div className="p-4 border-t border-white/10 space-y-1.5">
        <Link 
          href="/configuracoes" 
          onClick={() => onTabChange("configuracoes")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.01] group cursor-pointer ${
            activeTab === "configuracoes"
              ? "bg-gradient-to-r from-orange-500 to-purple-600 shadow-md text-white font-bold"
              : "text-white/70 hover:bg-white/5 hover:text-white font-semibold"
          }`}
        >
          <Settings className={`w-5 h-5 transition-colors ${activeTab === "configuracoes" ? "text-white" : "text-white/60 group-hover:text-white"}`} />
          <span className="text-sm">Configurações</span>
        </Link>

        {/* Botão Sair */}
        <button 
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 cursor-pointer font-semibold group"
        >
          <LogOut className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}