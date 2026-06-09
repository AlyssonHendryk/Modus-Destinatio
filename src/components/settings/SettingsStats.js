"use client"

import {
  Users,
  ShieldCheck,
  UserCheck,
  Clock
} from "lucide-react"

export default function SettingsStats() {
  const stats = [
    {
      label: "Usuários Ativos",
      value: "12",
      icon: Users,
      color: "from-blue-500 to-blue-600"
    },
    {
      label: "Administradores",
      value: "3",
      icon: ShieldCheck,
      color: "from-purple-500 to-purple-600"
    },
    {
      label: "Funcionários",
      value: "9",
      icon: UserCheck,
      color: "from-orange-500 to-orange-600"
    },
    {
      label: "Último Login",
      value: "Agora",
      icon: Clock,
      color: "from-green-500 to-green-600"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

      {stats.map((stat) => {

        const Icon = stat.icon

        return (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >

            <div className="flex items-center gap-3">

              <div
                className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center shadow-lg`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>

              <div>

                <p className="text-xs text-gray-500">
                  {stat.label}
                </p>

                <p className="text-lg font-bold text-gray-900">
                  {stat.value}
                </p>

              </div>

            </div>

          </div>
        )
      })}

    </div>
  )
}