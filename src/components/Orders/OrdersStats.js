"use client";

import {
  Calendar,
  Truck,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

export function OrdersStats({ orders = [] }) {
  // 1. Lógica de cálculo dinâmico mantida perfeitamente
  const totalToday = orders.length;
  
  const totalInRoute = orders.filter(order => order.status === 'Em rota').length;
  const totalCompleted = orders.filter(order => order.status === 'Concluído').length;
  const totalCanceled = orders.filter(order => order.status === 'Cancelado').length;
  const totalWaiting = orders.filter(order => order.status === 'Aguardando').length;

  // 🎨 SINALIZAÇÃO VIVA: Caixas baseadas em bg-white para blindar contra o bloqueio asfalto do CSS global no Modo Claro
  const stats = [
    {
      label: 'Pedidos hoje',
      value: totalToday,
      icon: Calendar,
      color: 'text-gray-600 dark:text-gray-400',
      borderColor: 'border-gray-200 dark:border-gray-700'
    },
    {
      label: 'Em rota',
      value: totalInRoute,
      icon: Truck,
      color: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-900/40'
    },
    {
      label: 'Concluídos',
      value: totalCompleted,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-900/40'
    },
    {
      label: 'Cancelados',
      value: totalCanceled,
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-900/40'
    },
    {
      label: 'Aguardando',
      value: totalWaiting,
      icon: Clock,
      color: 'text-amber-500 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-900/40'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            /* 🛠️ AJUSTE: Trocado bg-color leve manual por bg-white para garantir o contraste perfeito no claro.
               O número do indicador agora adota font-bold com a cor semântica correspondente da métrica. */
            className={`bg-white ${stat.borderColor} border rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200`}
          >
            <div className="shrink-0">
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              {/* Mantido o text-gray-500 font-medium clássico para a legenda */}
              <p className="text-xs text-gray-500 font-semibold mb-0.5 tracking-wide uppercase">
                {stat.label}
              </p>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}