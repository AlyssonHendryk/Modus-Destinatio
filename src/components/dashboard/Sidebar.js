import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
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
  ]

  return (
    <aside className="w-72 bg-[#111c5a] text-white flex flex-col shadow-xl">
      {/* Topo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-white">StockFlow</h2>
            <p className="text-xs text-white/60">Sistema de Gestão</p>
          </div>
        </div>

        {/* Usuário */}
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center font-medium">
            <span>B</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate font-medium">Bruno</p>
            <p className="text-xs text-white/60">Administrador</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-[#F97316] to-[#7C3AED] shadow-lg text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-2">
        
        {/* Adicionado o onClick para sincronizar o estado ativo com a nova página */}
        <Link 
          href="/configuracoes" 
          onClick={() => onTabChange("configuracoes")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] cursor-pointer ${
            activeTab === "configuracoes"
              ? "bg-gradient-to-r from-[#F97316] to-[#7C3AED] shadow-lg text-white"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Configurações</span>
        </Link>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 cursor-pointer">
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}