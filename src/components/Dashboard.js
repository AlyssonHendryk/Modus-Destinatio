"use client"

import { useState, useEffect } from "react"
import { Layers, Plus, Trash2, Tag, Truck } from "lucide-react"

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

  // 📝 ESTADO DE PRODUTOS (Gerenciamento Geral)
  const [products, setProducts] = useState([
    { id: "101", name: "Óleo", max: 150, initialQuantity: 100 },
    { id: "102", name: "Macarrão", max: 100, initialQuantity: 40 },
    { id: "103", name: "Arroz", max: 80, initialQuantity: 50 },
    { id: "104", name: "Feijão", max: 60, initialQuantity: 30 },
  ])

  // 🏢 ESTADO DE FORNECEDORES
  const [suppliers, setSuppliers] = useState([
    "TechLog Distribuidora Ltda",
    "Nexus Indústria e Comércio",
    "Global Sourcing & Logistics",
    "Prime Supply Chain S.A."
  ])

  // Estados dos formulários de cadastro
  const [newProdName, setNewProdName] = useState("")
  const [newProdMax, setNewProdMax] = useState("")
  const [newProdQty, setNewProdQty] = useState("")
  const [newSupplierName, setNewSupplierName] = useState("")

  // Buscar dados da API Python
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

  useEffect(() => {
    fetchOrders()
  }, [])

  // 🛠️ RE-ADICIONADO: Funções de abertura de modal controlando o estado do CRUD
  const handleOpenCreate = () => {
    setEditingOrder(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (order) => {
    setEditingOrder(order)
    setIsModalOpen(true)
  }

  // Funções de Cadastro Local de Itens Gerais do Inventário
  const handleAddProduct = (e) => {
    e.preventDefault()
    if (!newProdName || !newProdMax) return

    const nextId = String(Math.max(...products.map(p => parseInt(p.id))) + 1)
    const newProduct = {
      id: nextId,
      name: newProdName,
      max: parseInt(newProdMax) || 100,
      initialQuantity: parseInt(newProdQty) || 0
    }

    setProducts([...products, newProduct])
    setNewProdName("")
    setNewProdMax("")
    setNewProdQty("")
  }

  const handleAddSupplier = (e) => {
    e.preventDefault()
    if (!newSupplierName.trim()) return

    setSuppliers([...suppliers, newSupplierName.trim()])
    setNewSupplierName("")
  }

  const handleDeleteProduct = (id) => {
    if (confirm("Deseja remover este produto do catálogo?")) {
      setProducts(products.filter(p => p.id !== id))
    }
  }

  const handleDeleteSupplier = (name) => {
    if (confirm("Deseja remover este fornecedor?")) {
      setSuppliers(suppliers.filter(s => s !== name))
    }
  }

  const handleSaveOrder = async (orderData) => {
    try {
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
        fetchOrders()
        setIsModalOpen(false)
        setEditingOrder(null)
      }
    } catch (error) {
      console.error("Erro ao salvar pedido:", error)
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (confirm(`Deseja realmente excluir o pedido ${orderId}?`)) {
      try {
        const response = await fetch(`http://localhost:8000/api/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" })
        if (response.ok) fetchOrders()
      } catch (error) { console.error("Erro ao deletar pedido:", error) }
    }
  }

  // Motor de composição reativa de estoque geral
  const calculateDynamicInventory = () => {
    const currentInventory = {}
    products.forEach(p => {
      currentInventory[p.id] = { name: p.name, quantity: p.initialQuantity, max: p.max, trend: "up" }
    })

    orders.forEach((order) => {
      if (order.status !== "Cancelado" && order.items) {
        order.items.forEach((item) => {
          const idBusca = String(item.productId || "").trim()
          if (currentInventory[idBusca]) {
            const qty = parseInt(item.quantity) || 0
            if (order.operation === "Venda" || !order.operation) {
              currentInventory[idBusca].quantity = Math.max(0, currentInventory[idBusca].quantity - qty)
              currentInventory[idBusca].trend = "down"
            } else if (order.operation === "Compra") {
              currentInventory[idBusca].quantity = Math.min(currentInventory[idBusca].max, currentInventory[idBusca].quantity + qty)
              currentInventory[idBusca].trend = "up"
            }
          }
        })
      }
    })

    return Object.keys(currentInventory).map((id) => ({
      name: currentInventory[id].name,
      quantity: currentInventory[id].quantity,
      max: currentInventory[id].max,
      trend: currentInventory[id].trend
    }))
  }

  const dynamicItems = calculateDynamicInventory()

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden transition-colors duration-200">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

          {/* ABA 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
              <KPICards />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6"><OrdersList /><AnalyticsCharts /></div>
                <div className="space-y-6"><TasksPanel /><InventoryTable items={dynamicItems} /></div>
              </div>
            </div>
          )}

          {/* ABA 2: PEDIDOS */}
          {activeTab === "pedidos" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full animate-fade-in">
              <OrdersHeader onNewOrderClick={handleOpenCreate} />
              <OrdersStats orders={orders} />
              <OrdersTable orders={orders} onEditClick={handleOpenEdit} onDeleteClick={handleDeleteOrder} onSave={handleSaveOrder} />
              <OrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveOrder} orderToEdit={editingOrder} availableProducts={products} availableSuppliers={suppliers} />
            </div>
          )}

          {/* ABA 3: ESTOQUE */}
          {activeTab === "estoque" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full animate-fade-in">
              <InventoryTable items={dynamicItems} />
            </div>
          )}

          {/* ABA 5: ÁREA DE CADASTROS */}
          {activeTab === "cadastros" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full animate-fade-in">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Módulo de Cadastros</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie as entidades globais do sistema de estoque</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cadastro de Produtos */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                  <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <Tag className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Novo SKU / Produto</h2>
                  </div>

                  <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">Nome do Item</label>
                      <input type="text" required placeholder="Ex: Bobina de Cobre" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">Qtd Inicial</label>
                      <input type="number" placeholder="0" value={newProdQty} onChange={(e) => setNewProdQty(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">Capac. Máxima</label>
                        <input type="number" required placeholder="150" value={newProdMax} onChange={(e) => setNewProdMax(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center h-[38px]"><Plus className="w-4 h-4" /></button>
                    </div>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="py-2.5 px-4">Cód ID</th>
                          <th className="py-2.5 px-4">Nome</th>
                          <th className="py-2.5 px-4">Estoque Máx</th>
                          <th className="py-2.5 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="py-3 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">{p.id}</td>
                            <td className="py-3 px-4 font-semibold text-gray-800 dark:text-gray-100">{p.name}</td>
                            <td className="py-3 px-4 font-medium">{p.max} un</td>
                            <td className="py-3 px-4 text-center">
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cadastro de Fornecedores */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                  <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <Truck className="w-5 h-5 text-orange-500" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Fornecedores</h2>
                  </div>

                  <form onSubmit={handleAddSupplier} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">Razão Social / Nome</label>
                      <input type="text" required placeholder="Ex: Metalúrgica Alfa" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center h-[38px]"><Plus className="w-4 h-4" /></button>
                  </form>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {suppliers.map(sup => (
                      <div key={sup} className="flex items-center justify-between p-3 bg-gray-50/80 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{sup}</span>
                        <button onClick={() => handleDeleteSupplier(sup)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Separação de Pedidos */}
          {activeTab === "separar" && (
            <div className="max-w-[1600px] mx-auto space-y-6 w-full animate-fade-in">
              <OrderSeparationHeader /><OrderSeparationStats /><OrderSeparationGrid />
            </div>
          )}

        </main>
      </div>
    </div>
  )
}