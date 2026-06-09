"use client"

import { useState } from "react"

import Sidebar from "@/components/dashboard/Sidebar"
import TopBar from "@/components/dashboard/TopBar"

import OrderSeparationHeader from "@/components/separation/OrderSeparationHeader"
import OrderSeparationStats from "@/components/separation/OrderSeparationStats"
import OrderSeparationGrid from "@/components/separation/OrderSeparationGrid"

export default function SepararPedidosPage() {
  const [activeTab, setActiveTab] = useState("separar")

  // 1. Estado Central dos Pedidos
  const [orders, setOrders] = useState([
    {
      id: "#1023",
      customer: "João Silva",
      products: [
        { name: "Camiseta preta", quantity: 1 },
        { name: "Boné", quantity: 1 },
        { name: "Tênis", quantity: 2 }
      ],
      status: "waiting"
    },
    {
      id: "#1024",
      customer: "Maria Santos",
      products: [{ name: "Celular", quantity: 1 }],
      status: "separating"
    },
    {
      id: "#1025",
      customer: "Miguel Oliveira",
      products: [{ name: "Coca Cola Lata", quantity: 12 }],
      status: "completed"
    },
    {
      id: "#1026",
      customer: "Pedro Costa",
      products: [
        { name: "Carregador", quantity: 1 },
        { name: "Teclado", quantity: 1 }
      ],
      status: "completed"
    },
    {
      id: "#1027",
      customer: "Ana Souza",
      products: [
        { name: "Mouse Gamer", quantity: 1 },
        { name: "Mousepad", quantity: 1 }
      ],
      status: "waiting"
    },
    {
      id: "#1028",
      customer: "Carlos Lima",
      products: [{ name: 'Monitor 24"', quantity: 2 }],
      status: "separating"
    }
  ])

  // 2. Estado para controlar qual filtro de status está clicado ('all', 'waiting', 'separating', 'completed')
  const [activeFilter, setActiveFilter] = useState("all")

  // 3. Função para mudar o status de um pedido
  const handleStatusChange = (orderId, newStatus) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    )
  }

  // 4. Filtrando a lista que vai para o Grid baseado no card clicado
  const filteredOrders = orders.filter(order => {
    if (activeFilter === "all") return true
    return order.status === activeFilter
  })

  // ... dentro do seu return do SepararPedidosPage, mude essa seção:

  // Descobre quantos estão aguardando para mandar pro Header
  const countWaitingForHeader = orders.filter(o => o.status === "waiting").length

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            
            {/* AGORA O HEADER RECEBE O VALOR REAL DE PEDIDOS EM ESPERA */}
            <OrderSeparationHeader pendingCount={countWaitingForHeader} />

            <OrderSeparationStats 
              orders={orders} 
              activeFilter={activeFilter} 
              onFilterChange={setActiveFilter} 
            />

            <OrderSeparationGrid 
              orders={filteredOrders} 
              onStatusChange={handleStatusChange} 
            />

          </div>
        </main>
      </div>
    </div>
  )
}