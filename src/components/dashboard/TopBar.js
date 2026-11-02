"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Bell, AlertTriangle, PackageSearch, CheckCircle2, XCircle, Clock } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { buildOperationalNotifications } from "@/utils/operationalNotifications"

export default function TopBar({ search = "", onSearchChange }) {
  const { currentUser, orders, inventory } = useApp()
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationsRef = useRef(null)
  const bellButtonRef = useRef(null)
  const notifications = useMemo(
    () => buildOperationalNotifications(orders, inventory),
    [orders, inventory]
  )
  const name = currentUser?.name || "Visitante"

  useEffect(() => {
    if (!isNotificationsOpen) return undefined

    function closeOnOutsideClick(event) {
      if (!notificationsRef.current?.contains(event.target)) setIsNotificationsOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key !== "Escape") return
      setIsNotificationsOpen(false)
      bellButtonRef.current?.focus()
    }

    document.addEventListener("pointerdown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [isNotificationsOpen])

  const notificationIcon = {
    lowStock: AlertTriangle,
    waiting: Clock,
    separating: PackageSearch,
    completed: CheckCircle2,
    cancelled: XCircle,
  }

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={search} onChange={(e) => onSearchChange?.(e.target.value)} type="text" aria-label="Buscar pedidos ou produtos" placeholder="Buscar pedidos, produtos..." className="form-control w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div ref={notificationsRef} className="relative">
            <button ref={bellButtonRef} type="button" onClick={() => setIsNotificationsOpen((open) => !open)} aria-expanded={isNotificationsOpen} aria-haspopup="dialog" aria-controls="operational-notifications" title="Abrir notificações" className="relative rounded-xl p-2.5 transition-all hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-purple-600"><Bell className="w-5 h-5 text-gray-600" />{notifications.actionableCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">{notifications.actionableCount}</span>}</button>

            {isNotificationsOpen && (
              <section id="operational-notifications" role="dialog" aria-modal="false" aria-labelledby="notifications-title" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 id="notifications-title" className="font-semibold text-gray-900">Notificações</h2><span className="text-xs text-gray-500">Resumo operacional atual</span></div>
                {notifications.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">Não há alertas operacionais no momento.</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Resumo de notificações operacionais">
                    {notifications.items.map((item) => {
                      const Icon = notificationIcon[item.kind] || Bell
                      const tone = item.priority === "urgent" ? "text-red-700 bg-red-50 border-red-200" : item.priority === "attention" ? "text-purple-700 bg-purple-50 border-purple-200" : "text-gray-700 bg-gray-50 border-gray-200"
                      return <li key={item.id} className={`flex items-start gap-3 rounded-xl border p-3 ${tone}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-sm"><span className="font-semibold">{item.count}</span> {item.label}</p></li>
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right"><p className="text-sm text-gray-900">{name}</p><p className="text-xs text-gray-500">{currentUser?.role || "Local"}</p></div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center"><span className="text-white">{name.charAt(0).toUpperCase()}</span></div>
          </div>
        </div>
      </div>
    </header>
  )
}
