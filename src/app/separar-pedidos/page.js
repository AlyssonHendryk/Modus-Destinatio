"use client"

import { useState } from "react"

import Sidebar from "@/components/dashboard/Sidebar"
import TopBar from "@/components/dashboard/TopBar"

import OrderSeparationHeader from "@/components/separation/OrderSeparationHeader"
import OrderSeparationStats from "@/components/separation/OrderSeparationStats"
import OrderSeparationGrid from "@/components/separation/OrderSeparationGrid"

export default function SepararPedidosPage() {
  const [activeTab, setActiveTab] = useState("separar")

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TopBar */}
        <TopBar />

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto p-8">

          <div className="max-w-[1600px] mx-auto space-y-6">

            <OrderSeparationHeader />

            <OrderSeparationStats />

            <OrderSeparationGrid />

          </div>

        </main>

      </div>

    </div>
  )
}