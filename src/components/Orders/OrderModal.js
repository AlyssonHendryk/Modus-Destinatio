"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Plus, Trash2, Minus } from "lucide-react"
import { formatCurrency } from "@/utils/formatters"

export default function OrderModal({ isOpen, onClose, onSave, orderToEdit, inventory = [] }) {
  const [id, setId] = useState("")
  const [customer, setCustomer] = useState("")
  const [supplier, setSupplier] = useState("")
  const [operation, setOperation] = useState("Venda")
  const [status, setStatus] = useState("waiting")
  const [items, setItems] = useState([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) return
    if (orderToEdit) {
      setId(orderToEdit.id)
      setCustomer(orderToEdit.customer || "")
      setSupplier(orderToEdit.supplier || "")
      setOperation(orderToEdit.operation || "Venda")
      setStatus(orderToEdit.status || "waiting")
      setItems(orderToEdit.items || [])
    } else {
      setId(`#${Date.now().toString().slice(-6)}`)
      setCustomer("")
      setSupplier("")
      setOperation("Venda")
      setStatus("waiting")
      setItems([])
    }
    setError("")
  }, [isOpen, orderToEdit])

  const total = useMemo(() => items.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), 0), [items])

  if (!isOpen) return null

  function addItem() {
    const first = inventory.find((p) => p.active !== false)
    setItems((current) => [...current, {
      productId: first?.id || `P${Date.now().toString().slice(-4)}`,
      product: first?.name || "",
      quantity: 1,
      unitPrice: first?.unitPrice || 0,
    }])
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index))
  }

  function changeItem(index, patch) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function selectProduct(index, productId) {
    const product = inventory.find((item) => item.id === productId)
    if (!product) return
    changeItem(index, { productId: product.id, product: product.name, unitPrice: product.unitPrice })
  }

  function changeQuantity(index, delta) {
    const item = items[index]
    if (!item) return
    const product = inventory.find((p) => p.id === item.productId)
    const next = Math.max(1, item.quantity + delta)
    if (operation === "Venda" && product && next > product.quantity) {
      setError(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}.`)
      return
    }
    setError("")
    changeItem(index, { quantity: next })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!customer.trim() || !supplier.trim()) return setError("Informe cliente e fornecedor/origem.")
    if (items.length === 0) return setError("Adicione pelo menos um item ao pedido.")
    if (items.some((item) => !item.product.trim() || item.quantity < 1 || item.unitPrice < 0)) return setError("Revise os itens do pedido.")
    if (operation === "Venda") {
      const unavailable = items.find((item) => {
        const product = inventory.find((p) => p.id === item.productId)
        return product && item.quantity > product.quantity
      })
      if (unavailable) return setError(`Estoque insuficiente para ${unavailable.product}.`)
    }
    onSave?.({ id, customer: customer.trim(), supplier: supplier.trim(), operation, status, date: orderToEdit?.date || new Date().toLocaleDateString("pt-BR"), total, items })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4"><h2 className="text-xl font-bold text-gray-900">{orderToEdit ? `Editar Pedido ${id}` : "Criar Novo Pedido"}</h2><button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-500 rounded-xl"><X className="w-5 h-5" /></button></div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">Cliente<input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1 w-full border rounded-xl p-3 text-gray-900" placeholder="Nome do cliente" /></label>
          <label className="text-sm font-medium text-gray-700">Fornecedor / origem<input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1 w-full border rounded-xl p-3 text-gray-900" placeholder="Fornecedor ou canal" /></label>
          <label className="text-sm font-medium text-gray-700">Operação<select value={operation} onChange={(e) => setOperation(e.target.value)} className="mt-1 w-full border rounded-xl p-3 bg-white text-gray-900"><option>Venda</option><option>Compra</option></select></label>
          <label className="text-sm font-medium text-gray-700">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full border rounded-xl p-3 bg-white text-gray-900"><option value="waiting">Aguardando</option><option value="separating">Em separação</option><option value="shipped">Em rota</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-900">Itens</h3><button type="button" onClick={addItem} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg"><Plus className="w-4 h-4" />Adicionar item</button></div>
          <div className="space-y-3">
            {items.length === 0 && <div className="text-sm text-gray-500 border border-dashed rounded-xl p-6 text-center">Nenhum item adicionado.</div>}
            {items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-12 gap-2 items-end border rounded-xl p-3">
              <label className="col-span-12 md:col-span-5 text-xs text-gray-600">Produto
                {inventory.length ? <select value={item.productId} onChange={(e) => selectProduct(index, e.target.value)} className="mt-1 w-full border rounded-lg p-2 bg-white text-gray-900">{inventory.filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity} un)</option>)}</select> : <input value={item.product} onChange={(e) => changeItem(index, { product: e.target.value })} className="mt-1 w-full border rounded-lg p-2" />}
              </label>
              <div className="col-span-7 md:col-span-3"><p className="text-xs text-gray-600 mb-1">Quantidade</p><div className="flex items-center border rounded-lg"><button type="button" onClick={() => changeQuantity(index, -1)} className="p-2"><Minus className="w-4 h-4" /></button><input type="number" min="1" value={item.quantity} onChange={(e) => changeItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="w-full text-center outline-none" /><button type="button" onClick={() => changeQuantity(index, 1)} className="p-2"><Plus className="w-4 h-4" /></button></div></div>
              <label className="col-span-4 md:col-span-3 text-xs text-gray-600">Preço unitário<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => changeItem(index, { unitPrice: Number(e.target.value) || 0 })} className="mt-1 w-full border rounded-lg p-2 text-gray-900" /></label>
              <button type="button" onClick={() => removeItem(index)} className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>)}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
        <div className="flex items-center justify-between border-t pt-4"><div><p className="text-xs text-gray-500">Total do pedido</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p></div><div className="flex gap-3"><button type="button" onClick={onClose} className="px-5 py-3 border rounded-xl text-gray-700">Cancelar</button><button type="submit" className="px-5 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-xl font-medium">Salvar Pedido</button></div></div>
      </form>
    </div>
  )
}
