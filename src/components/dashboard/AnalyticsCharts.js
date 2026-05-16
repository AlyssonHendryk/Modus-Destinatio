"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

export default function AnalyticsCharts() {

  const salesData = [
    { name: "Seg", vendas: 4000, pedidos: 24 },
    { name: "Ter", vendas: 3000, pedidos: 18 },
    { name: "Qua", vendas: 5000, pedidos: 32 },
    { name: "Qui", vendas: 2780, pedidos: 20 },
    { name: "Sex", vendas: 4890, pedidos: 28 },
    { name: "Sáb", vendas: 2390, pedidos: 15 },
    { name: "Dom", vendas: 1490, pedidos: 10 },
  ]

  const categoryData = [
    { name: "Alimentos", value: 4500 },
    { name: "Bebidas", value: 3200 },
    { name: "Limpeza", value: 2100 },
    { name: "Higiene", value: 1800 },
    { name: "Outros", value: 900 },
  ]

  return (

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Gráfico de Linha */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

        <div className="mb-6">

          <h3 className="text-gray-900 font-semibold mb-1">
            Vendas Semanais
          </h3>

          <p className="text-sm text-gray-500">
            Últimos 7 dias
          </p>

        </div>

        <ResponsiveContainer width="100%" height={250}>

          <LineChart data={salesData}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
            />

            <XAxis
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />

            <Legend />

            <Line
              type="monotone"
              dataKey="vendas"
              stroke="#7C3AED"
              strokeWidth={3}
              dot={{ fill: "#7C3AED", r: 4 }}
              activeDot={{ r: 6 }}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      {/* Gráfico de Barras */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

        <div className="mb-6">

          <h3 className="text-gray-900 font-semibold mb-1">
            Vendas por Categoria
          </h3>

          <p className="text-sm text-gray-500">
            Este mês
          </p>

        </div>

        <ResponsiveContainer width="100%" height={250}>

          <BarChart data={categoryData}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
            />

            <XAxis
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />

            <defs>

              <linearGradient
                id="colorGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >

                <stop
                  offset="0%"
                  stopColor="#F97316"
                />

                <stop
                  offset="100%"
                  stopColor="#7C3AED"
                />

              </linearGradient>

            </defs>

            <Bar
              dataKey="value"
              fill="url(#colorGradient)"
              radius={[8, 8, 0, 0]}
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </div>
  )
}