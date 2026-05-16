"use client"

import {
  FileText,
  Package,
  Printer,
  Send,
  ChevronRight,
} from "lucide-react"

export default function TasksPanel() {

  const tasks = [
    {
      id: 1,
      label: "Processar NF",
      icon: FileText,
      color: "from-blue-500 to-blue-600",
    },

    {
      id: 2,
      label: "Separar Pedido",
      icon: Package,
      color: "from-purple-500 to-purple-600",
    },

    {
      id: 3,
      label: "Imprimir Etiqueta",
      icon: Printer,
      color: "from-orange-500 to-orange-600",
    },

    {
      id: 4,
      label: "Enviar Pedido",
      icon: Send,
      color: "from-green-500 to-green-600",
    },
  ]

  return (

    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      {/* Header */}
      <div className="mb-6">

        <h2 className="text-gray-900 font-semibold mb-1">
          Ações Rápidas
        </h2>

        <p className="text-sm text-gray-500">
          Tarefas do dia
        </p>

      </div>

      {/* Lista */}
      <div className="space-y-3">

        {tasks.map((task) => {

          const Icon = task.icon

          return (

            <button
              key={task.id}
              className="
                w-full
                flex
                items-center
                gap-4
                p-4
                border
                border-gray-100
                rounded-xl
                bg-gradient-to-r
                from-white
                to-gray-50
                hover:from-gray-50
                hover:to-white
                hover:border-gray-200
                hover:shadow-md
                transition-all
                duration-300
                transform
                hover:scale-[1.02]
                group
                cursor-pointer
              "
            >

              {/* Ícone */}
              <div
                className={`w-12 h-12 bg-gradient-to-br ${task.color} rounded-xl flex items-center justify-center shadow-lg`}
              >

                <Icon className="w-6 h-6 text-white" />

              </div>

              {/* Texto */}
              <span className="flex-1 text-left text-gray-900 font-medium">

                {task.label}

              </span>

              {/* Seta */}
              <ChevronRight
                className="
                  w-5
                  h-5
                  text-gray-400
                  group-hover:text-gray-600
                  group-hover:translate-x-1
                  transition-all
                  duration-300
                "
              />

            </button>
          )
        })}

      </div>

    </div>
  )
}