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
    { name: "Sáb", text: 2390, vendas: 2390, pedidos: 15 },
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
      {/* 🛠️ MUDANÇA: Adicionado dark:bg-gray-800 e dark:border-gray-700 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="mb-6">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-1">
            Vendas Semanais
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Últimos 7 dias
          </p>
        </div>

        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={salesData}>
            {/* 🛠️ MUDANÇA: Usando uma classe utilitária de borda do Tailwind para controlar o stroke da grade */}
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-gray-100 dark:stroke-gray-700"
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
            {/* 🛠️ MUDANÇA: Customizado o Tooltip usando Tailwind dinâmico para se adaptar ao escuro */}
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background-card, #ffffff)",
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: "12px",
              }}
              labelStyle={{ color: "var(--text-color, #111827)" }}
              itemStyle={{ color: "var(--text-color, #111827)" }}
              className="shadow-lg dark:shadow-black/20"
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
      {/* 🛠️ MUDANÇA: Adicionado dark:bg-gray-800 e dark:border-gray-700 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="mb-6">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-1">
            Vendas por Categoria
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Este mês
          </p>
        </div>

        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={categoryData}>
            {/* 🛠️ MUDANÇA: Sincronizada a cor da grade com o tema */}
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-gray-100 dark:stroke-gray-700"
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
            {/* 🛠️ MUDANÇA: Customizado o Tooltip também para o gráfico de barras */}
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background-card, #ffffff)",
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: "12px",
              }}
              labelStyle={{ color: "var(--text-color, #111827)" }}
              itemStyle={{ color: "var(--text-color, #111827)" }}
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