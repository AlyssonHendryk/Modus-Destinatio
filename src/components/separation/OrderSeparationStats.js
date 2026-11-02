"use client"

import { Clock, Layers, PackageSearch } from "lucide-react"

export default function OrderSeparationStats({ orders = [], activeFilter, onFilterChange }) {
  const countWaiting = orders.filter((order) => order.status === "waiting").length
  const countSeparating = orders.filter((order) => order.status === "separating").length
  const stats = [
    { id: "all", title: "Pedidos Ativos", value: orders.length, icon: Layers, color: "from-blue-500 to-blue-600", borderColor: "border-blue-500", bgColor: "bg-blue-50/30" },
    { id: "waiting", title: "Pedidos Aguardando", value: countWaiting, icon: Clock, color: "from-purple-500 to-purple-600", borderColor: "border-purple-500", bgColor: "bg-purple-50/30" },
    { id: "separating", title: "Em Separação", value: countSeparating, icon: PackageSearch, color: "from-orange-500 to-orange-600", borderColor: "border-orange-500", bgColor: "bg-orange-50/30" },
  ]

  return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{stats.map((stat) => {
    const Icon = stat.icon
    const isSelected = activeFilter === stat.id
    return <button key={stat.id} type="button" onClick={() => onFilterChange?.(stat.id)} className={`w-full cursor-pointer select-none rounded-2xl border-2 p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isSelected ? `${stat.borderColor} ${stat.bgColor}` : "border-gray-100 bg-white"}`}><div className="flex items-start justify-between"><div><p className="mb-2 text-sm font-medium text-gray-500">{stat.title}</p><h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3></div><div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg`}><Icon className="h-6 w-6 text-white" /></div></div></button>
  })}</div>
}
