"use client"

import { useState } from "react"

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

// SEPARAÇÃO DE PEDIDOS
import OrderSeparationHeader from "./separation/OrderSeparationHeader"
import OrderSeparationStats from "./separation/OrderSeparationStats"
import OrderSeparationGrid from "./separation/OrderSeparationGrid"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")

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
              ABA 2: PEDIDOS
             ========================================================= */}
          {activeTab === "pedidos" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full">
              <OrdersHeader />
              <OrdersStats />
              <OrdersTable />
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