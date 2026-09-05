"use client"

import { Search, Bell } from "lucide-react"
import { useApp } from "@/context/AppContext"

export default function TopBar({ search = "", onSearchChange }) {
  const { currentUser, orders, inventory } = useApp()
  const alerts = orders.filter((o) => o.status === "waiting").length + inventory.filter((i) => i.quantity <= i.min).length
  const name = currentUser?.name || "Visitante"
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={search} onChange={(e) => onSearchChange?.(e.target.value)} type="text" placeholder="Buscar pedidos, produtos..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => window.alert(alerts ? `${alerts} alerta(s): pedidos aguardando e/ou estoque baixo.` : "Nenhum alerta no momento.")} title={`${alerts} alerta(s)`} className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all"><Bell className="w-5 h-5 text-gray-600" />{alerts > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{alerts}</span>}</button>
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right"><p className="text-sm text-gray-900">{name}</p><p className="text-xs text-gray-500">{currentUser?.role || "Local"}</p></div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center"><span className="text-white">{name.charAt(0).toUpperCase()}</span></div>
          </div>
        </div>
      </div>
    </header>
  )
}
