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
    /* 🛠️ AJUSTE: Mantido o bg-white puro para a interceptação limpa do seu arquivo CSS global */
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-colors duration-200">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-gray-900 font-bold text-lg mb-1">Ações Rápidas</h2>
        <p className="text-sm text-gray-500">Tarefas do dia</p>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const Icon = task.icon

          return (
            <button
              key={task.id}
              type="button"
              /* 🛠️ AJUSTE: Trocado bg-gradient por bg-transparent para evitar o bug do fundo cinza asfalto no claro.
                 O hover interage com um fundo cinza bem leve e suave sem quebrar a leitura. */
              className="w-full flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-700/30 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md transition-all duration-300 transform hover:scale-[1.01] group cursor-pointer"
            >
              {/* Ícone: O box com gradiente vibrante garante excelente destaque e leitura no Modo Claro */}
              <div className={`w-12 h-12 bg-gradient-to-br ${task.color} rounded-xl flex items-center justify-center shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Texto: Mantido text-gray-900 puro para o seletor global inverter para branco no escuro */}
              <span className="flex-1 text-left text-gray-900 font-semibold">
                {task.label}
              </span>

              {/* Seta */}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-300" />
            </button>
          )
        })}
      </div>

    </div>
  )
}