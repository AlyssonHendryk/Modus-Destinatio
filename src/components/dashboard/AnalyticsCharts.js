"use client"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useApp } from "@/context/AppContext"
import { canViewFinancials, sumFinancialValues } from "@/utils/financialPresentation"

export default function AnalyticsCharts({ orders = [] }) {
  const { currentUser } = useApp()
  const isAdmin = canViewFinancials(currentUser)
  const salesOrders = isAdmin ? orders.filter(order => order.status !== "cancelled") : []
  const showSales = isAdmin && sumFinancialValues(salesOrders.map(order => order.total)) !== undefined
  const byDate = new Map()
  if (showSales) {
    salesOrders.forEach(order => {
      const key = order.date || "Sem data"
      const current = byDate.get(key) || { name: key, vendas: 0 }
      current.vendas += order.total
      byDate.set(key, current)
    })
  }
  const salesData = [...byDate.values()].slice(-7)
  const byStatus = new Map()
  orders.forEach(order => byStatus.set(order.status, (byStatus.get(order.status) || 0) + 1))
  const statusData = [...byStatus].map(([name, value]) => ({ name, value }))
  return (
    <div className={`grid grid-cols-1 ${showSales ? "lg:grid-cols-2" : ""} gap-6`}>
      {showSales && <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <h3 className="font-semibold text-gray-900">Vendas por data</h3>
        <p className="text-sm text-gray-500 mb-4">Calculado a partir dos pedidos</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={salesData}><CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis/><Tooltip/><Legend/>
            <Line type="monotone" dataKey="vendas" stroke="#7C3AED" strokeWidth={3}/>
          </LineChart>
        </ResponsiveContainer>
      </div>}
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <h3 className="font-semibold text-gray-900">Pedidos por status</h3>
        <p className="text-sm text-gray-500 mb-4">Distribuição atual</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={statusData}><CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/>
            <Bar dataKey="value" fill="#F97316" radius={[8,8,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
