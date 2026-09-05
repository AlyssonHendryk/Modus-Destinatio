"use client"

import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Settings, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

export default function Sidebar({ activeTab, onTabChange }) {
  const { currentUser, logout } = useApp()
  const router = useRouter()
  const menuItems = [
    { id: "dashboard", label: "Tela Inicial", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "separar", label: "Separar Pedidos", icon: ClipboardList },
  ]
  const displayName = currentUser?.name || "Visitante"
  const displayRole = currentUser?.role || "Sessão local"

  function handleLogout() {
    logout()
    router.push("/login")
  }

  return (
    <aside className="w-72 bg-[#111c5a] text-white flex flex-col shadow-xl">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#7C3AED] rounded-xl flex items-center justify-center"><Package className="w-6 h-6" /></div>
          <div><h2 className="font-semibold text-white">Modus Destinatio</h2><p className="text-xs text-white/60">Sistema de Gestão</p></div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center font-medium">{displayName.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0"><p className="text-sm truncate font-medium">{displayName}</p><p className="text-xs text-white/60">{displayRole}</p></div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return <button key={item.id} onClick={() => onTabChange?.(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? "bg-gradient-to-r from-[#F97316] to-[#7C3AED] shadow-lg text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}><Icon className="w-5 h-5" /><span className="text-sm font-medium">{item.label}</span></button>
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <Link href="/configuracoes" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all"><Settings className="w-5 h-5" /><span className="text-sm font-medium">Configurações</span></Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-all"><LogOut className="w-5 h-5" /><span className="text-sm">Sair</span></button>
      </div>
    </aside>
  )
}
