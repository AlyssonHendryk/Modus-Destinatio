"use client"
import { ShoppingCart, Package, TrendingUp, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/utils/formatters"
export default function KPICards({ orders = [], inventory = [] }) {
  const revenue = orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+(Number(o.total)||0),0)
  const low = inventory.filter(i=>i.quantity<=i.min).length
  const active = inventory.filter(i=>i.active!==false).length
  const kpis=[
    {title:"Pedidos",value:orders.length,icon:ShoppingCart,color:"from-blue-500 to-blue-600"},
    {title:"Estoque Baixo",value:low,icon:AlertTriangle,color:"from-orange-500 to-orange-600"},
    {title:"Vendas",value:formatCurrency(revenue),icon:TrendingUp,color:"from-green-500 to-green-600"},
    {title:"Produtos Ativos",value:active,icon:Package,color:"from-purple-500 to-purple-600"},
  ]
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">{kpis.map(k=>{const Icon=k.icon;return <div key={k.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div className="flex items-start justify-between"><div><p className="text-sm text-gray-500 mb-1">{k.title}</p><h3 className="text-2xl font-bold text-gray-900">{k.value}</h3></div><div className={`w-12 h-12 bg-gradient-to-br ${k.color} rounded-xl flex items-center justify-center shadow-lg`}><Icon className="w-6 h-6 text-white"/></div></div></div>})}</div>
}
