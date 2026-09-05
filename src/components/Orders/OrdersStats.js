"use client"
import { Calendar, Truck, CheckCircle, XCircle, Clock } from "lucide-react"
export function OrdersStats({ orders = [] }) {
  const stats = [
    { label: "Pedidos", value: orders.length, icon: Calendar, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
    { label: "Em rota", value: orders.filter(o => o.status === "shipped").length, icon: Truck, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
    { label: "Concluídos", value: orders.filter(o => o.status === "completed").length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200" },
    { label: "Cancelados", value: orders.filter(o => o.status === "cancelled").length, icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Aguardando", value: orders.filter(o => o.status === "waiting").length, icon: Clock, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  ]
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">{stats.map(s => { const Icon=s.icon; return <div key={s.label} className={`${s.bg} border rounded-xl p-4 flex items-center gap-3`}><Icon className={`w-5 h-5 ${s.color}`} /><div><p className="text-sm text-gray-600">{s.label}</p><p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p></div></div> })}</div>
}
