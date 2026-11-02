
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { canViewFinancials } from "@/utils/financialPresentation"

// Componentes do Dashboard
import Sidebar from "./dashboard/Sidebar"
import TopBar from "./dashboard/TopBar"
import KPICards from "./dashboard/KPICards"
import OrdersList from "./dashboard/OrdersList"
import TasksPanel from "./dashboard/TasksPanel"
import InventoryTable from "./dashboard/InventoryTable"
import AnalyticsCharts from "./dashboard/AnalyticsCharts"
import StockMovementHistory from "./dashboard/StockMovementHistory"
import ActivityHistory from "./dashboard/ActivityHistory"

// Componentes de Pedidos
import { OrdersHeader } from "./Orders/OrdersHeader"
import { OrdersStats } from "./Orders/OrdersStats"
import { OrdersTable } from "./Orders/OrdersTable"
import OrderModal from "./Orders/OrderModal"

// Componentes de Separação
import OrderSeparationHeader from "./separation/OrderSeparationHeader"
import OrderSeparationStats from "./separation/OrderSeparationStats"
import OrderSeparationGrid from "./separation/OrderSeparationGrid"
import OrderSeparationHistory from "./separation/OrderSeparationHistory"
import { splitSeparationOrders } from "@/utils/orderSeparationPresentation"

export default function Dashboard({ initialTab = "dashboard" }) {
  const router = useRouter()

  const {
    authLoading,
    currentUser,
    orders,
    inventory,
    saveOrder,
    deleteOrder,
    updateOrderStatus,
  } = useApp()
  const isAdmin = canViewFinancials(currentUser)

  const [activeTab, setActiveTab] = useState(initialTab)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [separationFilter, setSeparationFilter] = useState("all")

  // ============================================================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ============================================================

  useEffect(() => {
    if (authLoading) return

    if (!currentUser) {
      router.replace("/login")
    }
  }, [authLoading, currentUser, router])

  // ============================================================
  // FILTRAGEM DE PEDIDOS
  // ============================================================

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return orders

    return orders.filter(
      (order) =>
        [
          order.id,
          order.customer,
          order.supplier,
          order.operation,
        ].some((value) =>
          String(value || "").toLowerCase().includes(q)
        ) ||
        order.items.some((item) =>
          item.product.toLowerCase().includes(q)
        )
    )
  }, [orders, search])

  // ============================================================
  // FILTRAGEM DE PEDIDOS PARA SEPARAÇÃO
  // ============================================================

  const activeSeparationOrders = orders.filter((order) =>
    order.status === "waiting" || order.status === "separating"
  )

  const separationOrders = activeSeparationOrders.filter((order) =>
    separationFilter === "all"
      ? true
      : order.status === separationFilter
  )

  // ============================================================
  // FUNÇÕES DE PEDIDOS
  // ============================================================

  function openCreate() {
    if (!isAdmin) return
    setEditingOrder(null)
    setIsModalOpen(true)
  }

  function openEdit(order) {
    if (!isAdmin || order.status === "completed") return
    setEditingOrder(order)
    setIsModalOpen(true)
  }

  async function handleSaveOrder(order) {
    if (!isAdmin) throw new Error("Apenas administradores podem editar pedidos.")
    if (editingOrder && orders.find(item => item.id === editingOrder.id)?.status === "completed") {
      throw new Error("Pedidos concluídos não podem ser editados.")
    }
    await saveOrder(order)
    setIsModalOpen(false)
    setEditingOrder(null)
  }

  function handleDeleteOrder(id) {
    if (!isAdmin) return
    const confirmed = window.confirm(
      `Deseja realmente excluir o pedido ${id}?`
    )

    if (confirmed) {
      deleteOrder(id)
    }
  }

  // ============================================================
  // BLOQUEIO DE ACESSO SEM AUTENTICAÇÃO
  // ============================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">
          Verificando sessão...
        </p>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  // ============================================================
  // RENDERIZAÇÃO DO DASHBOARD
  // ============================================================

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <TopBar
          search={search}
          onSearchChange={setSearch}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
          {/* ==================================================
              DASHBOARD PRINCIPAL
          ================================================== */}

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

              <KPICards
                orders={orders}
                inventory={inventory}
              />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <OrdersList
                    orders={filteredOrders}
                    onOpenOrders={() => setActiveTab("pedidos")}
                  />

                  <AnalyticsCharts orders={orders} />
                </div>

                <div className="space-y-6">
                  <TasksPanel />

                  <InventoryTable
                    compact
                    search={search}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================================================
              PEDIDOS
          ================================================== */}

          {activeTab === "pedidos" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrdersHeader onNewOrderClick={openCreate} />

              <OrdersStats orders={orders} />

              <OrdersTable
                orders={filteredOrders}
                onEditClick={openEdit}
              />
            </div>
          )}

          {/* ==================================================
              ESTOQUE
          ================================================== */}

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

              <InventoryTable search={search} />


            </div>
          )}

          {/* ==================================================
              SEPARAÇÃO DE PEDIDOS
          ================================================== */}

          {activeTab === "separar" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrderSeparationHeader pendingCount={activeSeparationOrders.filter((order) => order.status === "waiting").length} />

              <OrderSeparationStats
                orders={activeSeparationOrders}
                activeFilter={separationFilter}
                onFilterChange={setSeparationFilter}
              />

              <OrderSeparationGrid
                orders={separationOrders}
                onStatusChange={updateOrderStatus}
              />


            </div>
          )}
          {activeTab === "historico" && (
            <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6">
              <header>
                <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
                <p className="mt-1 text-gray-500">Consulte as movimentações de estoque e os pedidos históricos carregados.</p>
              </header>
              <StockMovementHistory />
              <OrderSeparationHistory orders={splitSeparationOrders(orders).history} />
              {!authLoading && currentUser?.role === "admin" && currentUser?.status === "active" && (
                <ActivityHistory key={currentUser.id} user={currentUser} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* ====================================================
          MODAL DE PEDIDOS
      ==================================================== */}

      <OrderModal
        isOpen={isAdmin && isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingOrder(null)
        }}
        onSave={handleSaveOrder}
        orderToEdit={editingOrder}
        inventory={inventory}
      />
    </div>
  )
}
