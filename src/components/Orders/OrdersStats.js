"use client";

import {
  Calendar,
  Truck,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

export function OrdersStats({ orders = [] }) {
  // 1. Lógica de cálculo dinâmico baseada no array vindo do Python
  const totalToday = orders.length;
  
  const totalInRoute = orders.filter(order => order.status === 'Em rota').length;
  const totalCompleted = orders.filter(order => order.status === 'Concluído').length;
  const totalCanceled = orders.filter(order => order.status === 'Cancelado').length;
  const totalWaiting = orders.filter(order => order.status === 'Aguardando').length;

  // 2. Mapeamento dos cards mantendo a sua estética original
  const stats = [
    {
      label: 'Pedidos hoje',
      value: totalToday, // <-- Dinâmico
      icon: Calendar,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    {
      label: 'Em rota',
      value: totalInRoute, // <-- Dinâmico
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      label: 'Concluídos',
      value: totalCompleted, // <-- Dinâmico
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      label: 'Cancelados',
      value: totalCanceled, // <-- Dinâmico
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      label: 'Aguardando',
      value: totalWaiting, // <-- Dinâmico
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`${stat.bgColor} ${stat.borderColor} border rounded-xl p-4 flex items-center gap-3 transition-all hover:shadow-sm`}
          >
            <Icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}