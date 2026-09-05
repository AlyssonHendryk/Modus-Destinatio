"use client"

import { useMemo, useState } from "react"
import { useApp } from "@/context/AppContext"
import Sidebar from "./dashboard/Sidebar"
import TopBar from "./dashboard/TopBar"
import KPICards from "./dashboard/KPICards"
import OrdersList from "./dashboard/OrdersList"
import TasksPanel from "./dashboard/TasksPanel"
import InventoryTable from "./dashboard/InventoryTable"
import AnalyticsCharts from "./dashboard/AnalyticsCharts"
import { OrdersHeader } from "./Orders/OrdersHeader"
import { OrdersStats } from "./Orders/OrdersStats"
import { OrdersTable } from "./Orders/OrdersTable"
import OrderModal from "./Orders/OrderModal"
import OrderSeparationHeader from "./separation/OrderSeparationHeader"
import OrderSeparationStats from "./separation/OrderSeparationStats"
import OrderSeparationGrid from "./separation/OrderSeparationGrid"

export default function Dashboard({ initialTab = "dashboard" }) {
  const { orders, inventory, saveOrder, deleteOrder, updateOrderStatus } = useApp()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [separationFilter, setSeparationFilter] = useState("all")

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((order) =>
      [order.id, order.customer, order.supplier, order.operation]
        .some((value) => String(value || "").toLowerCase().includes(q)) ||
      order.items.some((item) => item.product.toLowerCase().includes(q))
    )
  }, [orders, search])

  const separationOrders = filteredOrders.filter((order) =>
    separationFilter === "all" ? true : order.status === separationFilter
  )

  function openCreate() {
    setEditingOrder(null)
    setIsModalOpen(true)
  }

  function openEdit(order) {
    setEditingOrder(order)
    setIsModalOpen(true)
  }

  function handleSaveOrder(order) {
    saveOrder(order)
    setIsModalOpen(false)
    setEditingOrder(null)
  }

  function handleDeleteOrder(id) {
    if (window.confirm(`Deseja realmente excluir o pedido ${id}?`)) deleteOrder(id)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar search={search} onSearchChange={setSearch} />
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "dashboard" && (
            <div className="max-w-[1600px] mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
                <p className="text-gray-500">Visão geral do sistema de gerenciamento</p>
              </div>
              <KPICards orders={orders} inventory={inventory} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <OrdersList orders={filteredOrders} onOpenOrders={() => setActiveTab("pedidos")} />
                  <AnalyticsCharts orders={orders} />
                </div>
                <div className="space-y-6">
                  <TasksPanel />
                  <InventoryTable compact search={search} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "pedidos" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrdersHeader onNewOrderClick={openCreate} />
              <OrdersStats orders={orders} />
              <OrdersTable orders={filteredOrders} onEditClick={openEdit} onDeleteClick={handleDeleteOrder} />
            </div>
          )}

          {activeTab === "estoque" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Estoque</h1>
                <p className="text-gray-500">Controle de mercadorias armazenadas</p>
              </div>
              <InventoryTable search={search} />
            </div>
          )}

          {activeTab === "separar" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrderSeparationHeader pendingCount={orders.filter((o) => o.status === "waiting").length} />
              <OrderSeparationStats orders={orders} activeFilter={separationFilter} onFilterChange={setSeparationFilter} />
              <OrderSeparationGrid orders={separationOrders} onStatusChange={updateOrderStatus} />
            </div>
          )}
        </main>
      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingOrder(null) }}
        onSave={handleSaveOrder}
        orderToEdit={editingOrder}
        inventory={inventory}
      />
    </div>
  )
}
