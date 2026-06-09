"use client"

import { useState, useEffect } from "react"

import Sidebar from "./dashboard/Sidebar"
import TopBar from "./dashboard/TopBar"
import KPICards from "./dashboard/KPICards"
import OrdersList from "./dashboard/OrdersList"
import TasksPanel from "./dashboard/TasksPanel"
import InventoryTable from "./dashboard/InventoryTable"
import AnalyticsCharts from "./dashboard/AnalyticsCharts"

// PEDIDOS
import { OrdersHeader } from "./Orders/OrdersHeader"
import { OrdersStats } from "./Orders/OrdersStats"
import { OrdersTable } from "./Orders/OrdersTable"
import OrderModal from "./Orders/OrderModal"

// SEPARAÇÃO DE PEDIDOS
import OrderSeparationHeader from "./separation/OrderSeparationHeader"
import OrderSeparationStats from "./separation/OrderSeparationStats"
import OrderSeparationGrid from "./separation/OrderSeparationGrid"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  
  // --- ESTADOS DO CRUD DE PEDIDOS ---
  const [orders, setOrders] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)

  // 1. Buscar dados da API Python
  const fetchOrders = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/orders")
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error("Erro ao conectar com a API Python:", error)
    }
  }

  // Busca os pedidos assim que o componente carrega
  useEffect(() => {
    fetchOrders()
  }, [])

  // 2. Criar ou Atualizar Registro
  const handleSaveOrder = async (orderData) => {
    try {
      // TRATAMENTO: encodeURIComponent protege a hashtag '#' na rota do Python
      const url = editingOrder 
        ? `http://localhost:8000/api/orders/${encodeURIComponent(editingOrder.id)}`
        : "http://localhost:8000/api/orders"
        
      const method = editingOrder ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      })

      if (response.ok) {
        fetchOrders() // Recarrega a tabela com os novos dados
        setIsModalOpen(false)
        setEditingOrder(null)
      }
    } catch (error) {
      console.error("Erro ao salvar pedido:", error)
    }
  }

  // 3. Apagar Registro
  const handleDeleteOrder = async (orderId) => {
    if (confirm(`Deseja realmente excluir o pedido ${orderId}?`)) {
      try {
        // TRATAMENTO: encodeURIComponent adicionado aqui também para a lixeira funcionar com '#'
        const response = await fetch(`http://localhost:8000/api/orders/${encodeURIComponent(orderId)}`, {
          method: "DELETE"
        })
        if (response.ok) {
          fetchOrders()
        }
      } catch (error) {
        console.error("Erro ao deletar pedido:", error)
      }
    }
  }

  const handleOpenEdit = (order) => {
    setEditingOrder(order)
    setIsModalOpen(true)
  }

  const handleOpenCreate = () => {
    setEditingOrder(null)
    setIsModalOpen(true)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <TopBar />

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">

          {/* =========================================================
              ABA 1: DASHBOARD
             ========================================================= */}
          {activeTab === "dashboard" && (
            <div className="max-w-[1600px] mx-auto space-y-6">

              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  Dashboard
                </h1>

                <p className="text-gray-500">
                  Visão geral do sistema de gerenciamento
                </p>
              </div>

              <KPICards />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                <div className="xl:col-span-2 space-y-6">
                  <OrdersList />
                  <AnalyticsCharts />
                </div>

                <div className="space-y-6">
                  <TasksPanel />
                  <InventoryTable />
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              ABA 2: PEDIDOS (CRUD INTEGRADO COM PYTHON)
             ========================================================= */}
          {activeTab === "pedidos" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrdersHeader onNewOrderClick={handleOpenCreate} />
              <OrdersStats orders={orders} />
              <OrdersTable 
                orders={orders} 
                onEditClick={handleOpenEdit} 
                onDeleteClick={handleDeleteOrder} 
                onSave={handleSaveOrder}
              />
              
              {/* O Modal flutuante fica aqui dentro monitorando o estado */}
              <OrderModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveOrder}
                orderToEdit={editingOrder}
              />
            </div>
          )}

          {/* =========================================================
              ABA 3: ESTOQUE
             ========================================================= */}
          {activeTab === "estoque" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">

              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  Estoque
                </h1>

                <p className="text-gray-500">
                  Controle de mercadorias armazenadas
                </p>
              </div>

              <InventoryTable />

            </div>
          )}

          {/* =========================================================
              ABA 4: SEPARAÇÃO DE PEDIDOS
             ========================================================= */}
          {activeTab === "separar" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">

              <OrderSeparationHeader />

              <OrderSeparationStats />

              <OrderSeparationGrid />

            </div>
          )}

        </main>

      </div>

    </div>
  )
}