"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Plus, Trash2, Minus } from "lucide-react"
import { formatCurrency } from "@/utils/formatters"
import { useApp } from "@/context/AppContext"
import { canViewFinancials, sumFinancialValues } from "@/utils/financialPresentation"
import { findSaleStockShortage } from "@/utils/orderStockValidation"

export default function OrderModal(props) {
  const { currentUser, orders = [] } = useApp()
  if (!props.isOpen || !canViewFinancials(currentUser)) return null
  const editingLocked = Boolean(props.orderToEdit &&
    (props.orderToEdit.status === "completed" ||
      orders.find(order => order.id === props.orderToEdit.id)?.status === "completed"))
  return <OrderForm editingLocked={editingLocked} key={props.orderToEdit?.id || "new"} {...props}/>
}

function OrderForm({ onClose, onSave, orderToEdit, inventory = [], editingLocked = false }) {
  const closeButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const [id] = useState(() => orderToEdit?.id || `#${Date.now().toString().slice(-6)}`)
  const [customer, setCustomer] = useState(orderToEdit?.customer || "")
  const [supplier, setSupplier] = useState(orderToEdit?.supplier || "")
  const [operation, setOperation] = useState(orderToEdit?.operation || "Venda")
  const [status, setStatus] = useState(orderToEdit?.status || "waiting")
  const [items, setItems] = useState(orderToEdit?.items || [])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)
    return () => previousFocusRef.current?.focus?.()
  }, [])

  const total = useMemo(() => sumFinancialValues(items.map(item =>
    typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) &&
    typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? item.unitPrice * item.quantity : undefined
  )), [items])

  function addItem() {
    const first = inventory.find((p) => p.active !== false)
    setItems((current) => [...current, {
      productId: first?.id || `P${Date.now().toString().slice(-4)}`,
      product: first?.name || "",
      quantity: 1,
      unitPrice: first?.unitPrice,
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
    const next = Math.max(1, item.quantity + delta)
    const nextItems = items.map((current, i) => i === index ? { ...current, quantity: next } : current)
    const shortage = findSaleStockShortage(nextItems, inventory, { operation, status, originalOrder: orderToEdit })
    if (shortage) {
      setError(`Estoque insuficiente para ${shortage.name}. Disponível: ${shortage.available}. Necessário adicional: ${shortage.required}.`)
      return
    }
    setError("")
    changeItem(index, { quantity: next })
  }

  function requestClose() {
    if (!saving) onClose?.()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    if (editingLocked) return setError("Pedidos concluídos não podem ser editados.")
    if (!customer.trim() || !supplier.trim()) return setError("Informe cliente e fornecedor/origem.")
    if (items.length === 0) return setError("Adicione pelo menos um item ao pedido.")
    if (total === undefined || items.some((item) => !item.product.trim() ||
      !Number.isFinite(item.quantity) || item.quantity < 1 ||
      !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return setError("Revise os itens do pedido.")
    const shortage = findSaleStockShortage(items, inventory, { operation, status, originalOrder: orderToEdit })
    if (shortage) return setError(`Estoque insuficiente para ${shortage.name}. Disponível: ${shortage.available}. Necessário adicional: ${shortage.required}.`)
    setSaving(true)
    setError("")
    try {
      await onSave?.({ id, customer: customer.trim(), supplier: supplier.trim(), operation, status, date: orderToEdit?.date || new Date().toLocaleDateString("pt-BR"), total, items })
    } catch (saveError) {
      setError(saveError?.message || "Não foi possível salvar o pedido.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="presentation">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="order-modal-title" className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-3xl min-w-0 w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] overflow-y-auto p-6 space-y-6">
        <fieldset disabled={saving} className="m-0 space-y-6 border-0 p-0 min-w-0"><div className="flex items-center justify-between border-b border-gray-100 pb-4"><div><h2 id="order-modal-title" className="text-xl font-bold text-gray-900">{orderToEdit ? "Editar Pedido" : "Criar Novo Pedido"}</h2>{orderToEdit && <p className="mt-1 text-sm text-gray-500 [overflow-wrap:anywhere]">Pedido {id}</p>}</div><button ref={closeButtonRef} type="button" onClick={requestClose} className="p-2 hover:bg-gray-100 text-gray-500 rounded-xl focus-visible:outline-2 focus-visible:outline-purple-600" aria-label="Fechar edição de pedido"><X className="w-5 h-5" /></button></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label htmlFor="order-customer" className="text-sm font-medium text-gray-700">Cliente</label><input id="order-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="form-control mt-1 w-full rounded-xl p-3 text-gray-900" placeholder="Nome do cliente" /></div>
          <div><label htmlFor="order-supplier" className="text-sm font-medium text-gray-700">Fornecedor / origem</label><input id="order-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="form-control mt-1 w-full rounded-xl p-3 text-gray-900" placeholder="Fornecedor ou canal" /></div>
          <div><label htmlFor="order-operation" className="text-sm font-medium text-gray-700">Operação</label><select id="order-operation" value={operation} onChange={(e) => setOperation(e.target.value)} className="form-control mt-1 w-full rounded-xl p-3 text-gray-900"><option>Venda</option><option>Compra</option></select></div>
          <div><label htmlFor="order-status" className="text-sm font-medium text-gray-700">Status</label><select id="order-status" value={status} onChange={(e) => setStatus(e.target.value)} className="form-control mt-1 w-full rounded-xl p-3 text-gray-900"><option value="waiting">Aguardando</option><option value="separating">Em separação</option><option value="shipped">Em rota</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-900">Itens</h3><button type="button" onClick={addItem} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg"><Plus className="w-4 h-4" />Adicionar item</button></div>
          <div className="space-y-3">
            {items.length === 0 && <div className="text-sm text-gray-500 border border-dashed rounded-xl p-6 text-center">Nenhum item adicionado.</div>}
            {items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-12 gap-2 items-end border rounded-xl p-3">
              <label className="col-span-12 md:col-span-5 text-xs text-gray-600" htmlFor={`order-item-product-${index}`}>Produto
                {inventory.length ? <select id={`order-item-product-${index}`} value={item.productId} onChange={(e) => selectProduct(index, e.target.value)} className="form-control mt-1 w-full rounded-lg p-2 text-gray-900">{inventory.filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity} un)</option>)}</select> : <input id={`order-item-product-${index}`} value={item.product} onChange={(e) => changeItem(index, { product: e.target.value })} className="form-control mt-1 w-full rounded-lg p-2 text-gray-900" />}
              </label>
              <div className="col-span-12 sm:col-span-7 md:col-span-3"><label htmlFor={`order-item-quantity-${index}`} className="block text-xs text-gray-600 mb-1">Quantidade</label><div className="flex h-10 items-center overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"><button type="button" onClick={() => changeQuantity(index, -1)} className="flex h-full w-10 shrink-0 items-center justify-center border-r border-gray-300 bg-gray-50 text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"><Minus className="w-4 h-4" strokeWidth={2.5} /></button><input id={`order-item-quantity-${index}`} type="number" min="1" value={item.quantity} onChange={(e) => changeItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-full min-w-0 flex-1 bg-white text-center text-sm font-semibold text-gray-900 caret-purple-700 outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-600" /><button type="button" onClick={() => changeQuantity(index, 1)} className="flex h-full w-10 shrink-0 items-center justify-center border-l border-gray-300 bg-gray-50 text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"><Plus className="w-4 h-4" strokeWidth={2.5} /></button></div></div>
              <label className="col-span-9 sm:col-span-4 md:col-span-3 text-xs text-gray-600" htmlFor={`order-item-price-${index}`}>Preço unitário<input id={`order-item-price-${index}`} type="number" min="0" step="0.01" value={item.unitPrice ?? ""} onChange={(e) => changeItem(index, { unitPrice: e.target.value === "" ? undefined : Number(e.target.value) })} className="form-control mt-1 w-full rounded-lg p-2 text-gray-900" /></label>
              <button type="button" onClick={() => removeItem(index)} className="col-span-3 sm:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>)}
          </div>
        </div>
        {editingLocked && <p role="alert" className="text-sm text-red-600">Pedido concluído. A edição está bloqueada.</p>}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
        <div className="flex flex-col items-stretch justify-between gap-4 border-t pt-4 sm:flex-row sm:items-center"><div><p className="text-xs text-gray-500">Total do pedido</p><p className="text-2xl font-bold text-gray-900 [overflow-wrap:anywhere]">{formatCurrency(total)}</p></div><div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={requestClose} className="px-5 py-3 border rounded-xl text-gray-700">Cancelar</button><button type="submit" disabled={editingLocked || saving} className="px-5 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-xl font-medium">{saving ? "Salvando..." : orderToEdit ? "Salvar alterações" : "Salvar Pedido"}</button></div></div></fieldset>
      </form>
    </div>
  )
}
