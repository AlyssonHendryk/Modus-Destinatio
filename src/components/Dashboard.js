"use client"

import { useState } from "react"

import Sidebar from "./dashboard/Sidebar"
import TopBar from "./dashboard/TopBar"
import KPICards from "./dashboard/KPICards"
import OrdersList from "./dashboard/OrdersList"
import TasksPanel from "./dashboard/TasksPanel"
import InventoryTable from "./dashboard/InventoryTable"
import AnalyticsCharts from "./dashboard/AnalyticsCharts"

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

          <div className="max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div>

              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Dashboard
              </h1>

              <p className="text-gray-500">
                Visão geral do sistema de gerenciamento
              </p>

            </div>

            {/* KPIs */}
            <KPICards />

            {/* Grid principal */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Lado esquerdo */}
              <div className="xl:col-span-2 space-y-6">

                <OrdersList />

                <AnalyticsCharts />

              </div>

              {/* Lado direito */}
              <div className="space-y-6">

                <TasksPanel />

                <InventoryTable />

              </div>

            </div>

          </div>

        </main>

      </div>

    </div>
  )
}