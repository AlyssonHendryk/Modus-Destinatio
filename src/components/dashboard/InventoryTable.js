"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Plus, Minus, Trash2, Edit2, Save, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { formatCurrency } from "@/utils/formatters"


export default function InventoryTable({ compact = false, search = "" }) {
  const { inventory, saveProduct, deleteProduct, changeStock } = useApp()

  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [movingProductId, setMovingProductId] = useState(null)

  const [form, setForm] = useState({
    name: "",
    quantity: 0,
    max: 100,
    min: 10,
    unitPrice: 0,
    active: true,
  })

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()

    const filtered = q
      ? inventory.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      )
      : inventory

    return compact ? filtered.slice(0, 5) : filtered
  }, [compact, inventory, search])


  function openCreate() {
    setEditing(null)
    setForm({ name: "", quantity: 0, max: 100, min: 10, unitPrice: 0, active: true })
    setShowForm(true)
  }

  function openEdit(item) {
    setEditing(item.id)
    setForm(item)
    setShowForm(true)
  }

  async function submit(e) {
    e.preventDefault()

    if (!form.name.trim()) {
      return
    }

    try {
      await saveProduct({
        ...form,
        id: editing || undefined,
      })

      setShowForm(false)
      setEditing(null)

    } catch (error) {
      console.error(
        "Erro ao salvar produto:",
        error
      )

      alert(
        error.message ||
        "Não foi possível salvar o produto."
      )
    }
  }
  async function handleStockChange(id, delta) {
    if (movingProductId !== null) return

    setMovingProductId(id)

    try {
      await changeStock(id, delta)
    } catch (error) {
      console.error("Erro na movimentação:", error)

      alert(
        error.message ||
        "Não foi possível movimentar o estoque."
      )
    } finally {
      setMovingProductId(null)
    }
  }
  async function handleDeleteProduct(item) {
    const confirmed = window.confirm(
      `Deseja realmente excluir o produto "${item.name}"?`
    )

    if (!confirmed) return

    try {
      await deleteProduct(item.id)

      alert("Produto excluído com sucesso.")
    } catch (error) {
      console.error("Erro ao excluir produto:", error)

      alert(
        error.message ||
        "Não foi possível excluir o produto."
      )
    }
  }
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-gray-900 font-semibold mb-1">Itens Armazenados</h2><p className="text-sm text-gray-500">Status e movimentação do estoque</p></div>
        {!compact && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl"><Plus className="w-4 h-4" />Novo produto</button>}
      </div>


      {showForm && !compact && (
        <form
          onSubmit={submit}
          className="mb-6 border rounded-xl p-4 grid md:grid-cols-6 gap-3 bg-gray-50"
        >
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Produto"
            className="md:col-span-2 border rounded-lg p-2 text-gray-900"
          />

          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={e => setForm({
              ...form,
              quantity: Number(e.target.value)
            })}
            disabled={editing !== null}
            title={
              editing !== null
                ? "A quantidade deve ser alterada por movimentações de estoque."
                : "Quantidade inicial do produto."
            }
            placeholder="Qtd."
            className={`border rounded-lg p-2 text-gray-900 ${editing !== null
              ? "bg-gray-200 cursor-not-allowed opacity-70"
              : ""
              }`}
          />

          <input
            type="number"
            min="1"
            value={form.max}
            onChange={e => setForm({
              ...form,
              max: Number(e.target.value)
            })}
            placeholder="Máx."
            className="border rounded-lg p-2 text-gray-900"
          />

          <input
            type="number"
            min="0"
            value={form.min}
            onChange={e => setForm({
              ...form,
              min: Number(e.target.value)
            })}
            placeholder="Mín."
            className="border rounded-lg p-2 text-gray-900"
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={e => setForm({
              ...form,
              unitPrice: Number(e.target.value)
            })}
            placeholder="Preço"
            className="border rounded-lg p-2 text-gray-900"
          />

          <div className="md:col-span-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 border rounded-lg flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>

            <button
              type="submit"
              className="px-3 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </form>
      )}


      <div className="space-y-4">{visible.map(item => {
        const percentage = Math.min(100, (item.quantity / Math.max(1, item.max)) * 100)
        const low = item.quantity <= item.min
        return <div key={item.id} className="border rounded-xl p-4">

          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {item.name}
                </span>

                {low && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>

              <p className="text-xs text-gray-500">
                {item.id} • {formatCurrency(item.unitPrice)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStockChange(item.id, -1)}
                disabled={movingProductId !== null}
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Diminuir"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="min-w-16 text-center text-sm font-semibold text-gray-900">
                {item.quantity} un
              </span>

              <button
                type="button"
                onClick={() => handleStockChange(item.id, 1)}
                disabled={movingProductId !== null}
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Aumentar"
              >
                <Plus className="w-4 h-4" />
              </button>

              {!compact && (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar produto"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(item)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Excluir produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>s
                </>
              )}
            </div>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`${low
                ? "bg-red-500"
                : percentage < 60
                  ? "bg-yellow-500"
                  : "bg-green-500"
                } h-full rounded-full`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Mín. {item.min}</span>
            <span>Máx. {item.max}</span>
          </div>

        </div>
      })}</div>
    </div>
  )
}
