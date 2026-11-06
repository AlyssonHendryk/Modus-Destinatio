"use client"

import { useEffect, useRef } from "react"
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, History, Settings, LogOut, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

export default function Sidebar({ activeTab, onTabChange, mobileOpen = false, onClose }) {
  const { currentUser, logout } = useApp()
  const router = useRouter()
  const navigationRef = useRef(null)
  const closeRef = useRef(null)
  useEffect(() => {
    if (!mobileOpen) return
    const previousFocus = document.activeElement
    closeRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); onClose?.(); return }
      if (event.key !== "Tab") return
      const controls = [...navigationRef.current.querySelectorAll("button, a[href]")]
        .filter(element => !element.disabled && element.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const desktop = window.matchMedia("(min-width: 1024px)")
    function closeOnDesktop() { if (desktop.matches) onClose?.() }
    desktop.addEventListener("change", closeOnDesktop)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      desktop.removeEventListener("change", closeOnDesktop)
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus?.()
    }
  }, [mobileOpen, onClose])
  const menuItems = [
    { id: "dashboard", label: "Tela Inicial", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "historico", label: "Histórico", icon: History },
    { id: "separar", label: "Separar Pedidos", icon: ClipboardList },
  ]
  const displayName = currentUser?.name || "Visitante"
  const displayRole = currentUser?.role || "Sessão local"

async function handleLogout() {
  try {
    await logout()
    router.replace("/login")
  } catch (error) {
    console.error("Erro ao sair:", error)
    alert("Não foi possível encerrar a sessão. Tente novamente.")
  }
}

  return (
    <>
    {mobileOpen && <button type="button" onClick={onClose} aria-label="Fechar menu de navegação" tabIndex={-1} className="fixed inset-0 z-60 bg-black/40 lg:hidden" />}
    <aside ref={navigationRef} id="primary-navigation" aria-label="Navegação principal" className={`fixed inset-y-0 left-0 z-70 h-dvh w-72 max-w-[calc(100vw-2rem)] overflow-y-auto bg-[#111c5a] text-white flex-col shadow-xl lg:static lg:z-auto lg:h-full lg:max-w-none lg:shrink-0 ${mobileOpen ? "flex" : "hidden lg:flex"}`}>
      <div className="relative shrink-0 p-6 border-b border-white/10">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar navegação" className="absolute right-2 top-2 rounded-lg p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white lg:hidden"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#7C3AED] rounded-xl flex items-center justify-center"><Package className="w-6 h-6" /></div>
          <div><h2 className="font-semibold text-white">Modus Destinatio</h2><p className="text-xs text-white/60">Sistema de Gestão</p></div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center font-medium">{displayName.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0"><p className="text-sm truncate font-medium">{displayName}</p><p className="text-xs text-white/60">{displayRole}</p></div>
        </div>
      </div>
      <nav className="flex-none p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return <button key={item.id} onClick={() => {
            onTabChange?.(item.id)
            onClose?.()
            if (item.id === "historico") router.push("/historico")
            else if (activeTab === "historico") {
              const routes = { dashboard: "/dashboard", pedidos: "/Orders", estoque: "/estoque", separar: "/separar-pedidos" }
              router.push(routes[item.id])
            }
          }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? "bg-gradient-to-r from-[#F97316] to-[#7C3AED] shadow-lg text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}><Icon className="w-5 h-5" /><span className="text-sm font-medium">{item.label}</span></button>
        })}
      </nav>
      <div className="mt-auto shrink-0 p-4 border-t border-white/10 space-y-2">
        <Link href="/configuracoes" onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all"><Settings className="w-5 h-5" /><span className="text-sm font-medium">Configurações</span></Link>
        <button onClick={() => { onClose?.(); void handleLogout() }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-all"><LogOut className="w-5 h-5" /><span className="text-sm">Sair</span></button>
      </div>
    </aside>
    </>
  )
}
