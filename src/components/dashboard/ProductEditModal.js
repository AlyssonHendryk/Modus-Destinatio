"use client"

import { useEffect, useRef, useState } from "react"
import { Save, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { canViewFinancials } from "@/utils/financialPresentation"

function toForm(product) {
  return {
    name: product.name || "",
    quantity: String(product.quantity ?? ""),
    min: String(product.min ?? ""),
    max: String(product.max ?? ""),
    unitPrice: product.unitPrice === undefined ? "" : String(product.unitPrice),
    active: product.active !== false,
  }
}

function parseProduct(form) {
  const quantity = Number(form.quantity)
  const min = Number(form.min)
  const max = Number(form.max)
  const unitPrice = Number(form.unitPrice)

  if (!form.name.trim()) return { error: "Informe o nome do produto." }
  if (!Number.isInteger(quantity) || quantity < 0) return { error: "A quantidade deve ser um número inteiro maior ou igual a zero." }
  if (!Number.isInteger(min) || min < 0) return { error: "O estoque mínimo deve ser um número inteiro maior ou igual a zero." }
  if (!Number.isInteger(max) || max < 1) return { error: "O estoque máximo deve ser um número inteiro maior ou igual a um." }
  if (min > max) return { error: "O estoque mínimo não pode ser maior que o estoque máximo." }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Informe um preço unitário válido." }

  return { value: { name: form.name.trim(), quantity, min, max, unitPrice, active: form.active } }
}

export default function ProductEditModal({ isOpen, product, onClose }) {
  const { currentUser, saveProduct, changeStock } = useApp()
  const isAdmin = canViewFinancials(currentUser)

  if (!isOpen || !product || !isAdmin) return null

  return <ProductEditForm key={product.id} product={product} onClose={onClose} saveProduct={saveProduct} changeStock={changeStock} />
}

function ProductEditForm({ product, onClose, saveProduct, changeStock }) {
  const closeButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const redirectTimeout = useRef(null)
  const [original] = useState(() => ({ id: product.id, ...toForm(product), quantity: Number(product.quantity) }))
  const [form, setForm] = useState(() => toForm(product))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => previousFocusRef.current?.focus?.()
  }, [])

  useEffect(() => () => {
    if (redirectTimeout.current) window.clearTimeout(redirectTimeout.current)
  }, [])

  function requestClose() {
    if (!saving) onClose?.()
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
    setSuccess("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const parsed = parseProduct(form)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    const next = parsed.value
    const quantityDelta = next.quantity - original.quantity
    const metadataChanged = ["name", "min", "max", "unitPrice", "active"].some(
      (field) => next[field] !== original[field]
    )

    if (!metadataChanged && quantityDelta === 0) {
      setSuccess("Nenhuma alteração para salvar.")
      return
    }

    setSaving(true)
    setError("")
    let metadataSaved = false
    let saved = false
    try {
      if (metadataChanged) {
        // The product PUT deliberately preserves quantity. It never creates stock history.
        await saveProduct({ id: original.id, ...next, quantity: original.quantity })
        metadataSaved = true
      }

      if (quantityDelta !== 0) {
        // Only the stock-movement flow can change quantity and register history.
        await changeStock(original.id, quantityDelta)
      }

      setSuccess("Alterações salvas com sucesso.")
      saved = true
      redirectTimeout.current = window.setTimeout(() => onClose?.(), 500)
    } catch (saveError) {
      setError(
        metadataSaved && quantityDelta !== 0
          ? "Os dados do produto foram salvos, mas a movimentação de estoque falhou. Revise a quantidade antes de tentar novamente."
          : saveError?.message || "Não foi possível salvar as alterações do produto."
      )
    } finally {
      if (!saved) setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="presentation">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="edit-product-title" className="max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl sm:p-6">
        <fieldset disabled={saving} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
            <div><h2 id="edit-product-title" className="text-xl font-bold text-gray-900">Editar Produto</h2><p className="mt-1 text-sm text-gray-500 [overflow-wrap:anywhere]">Código do produto: {original.id}</p></div>
            <button ref={closeButtonRef} type="button" onClick={requestClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-purple-600" aria-label="Fechar edição de produto"><X className="h-5 w-5" /></button>
          </div>

          <div>
            <label htmlFor="edit-product-name" className="mb-1 block text-sm font-medium text-gray-700">Nome do produto</label>
            <input id="edit-product-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} className="form-control w-full rounded-lg p-3 text-gray-900" />
          </div>
          <div>
            <label htmlFor="edit-product-quantity" className="mb-1 block text-sm font-medium text-gray-700">Quantidade</label>
            <input id="edit-product-quantity" type="number" min="0" step="1" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} className="form-control w-full rounded-lg p-3 text-gray-900" />
            <p className="mt-1 text-xs text-gray-500">A diferença será registrada como movimentação de estoque.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="edit-product-min" className="mb-1 block text-sm font-medium text-gray-700">Estoque mínimo</label><input id="edit-product-min" type="number" min="0" step="1" value={form.min} onChange={(event) => updateField("min", event.target.value)} className="form-control w-full rounded-lg p-3 text-gray-900" /></div>
            <div><label htmlFor="edit-product-max" className="mb-1 block text-sm font-medium text-gray-700">Estoque máximo</label><input id="edit-product-max" type="number" min="1" step="1" value={form.max} onChange={(event) => updateField("max", event.target.value)} className="form-control w-full rounded-lg p-3 text-gray-900" /></div>
          </div>
          <div><label htmlFor="edit-product-price" className="mb-1 block text-sm font-medium text-gray-700">Preço unitário</label><input id="edit-product-price" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => updateField("unitPrice", event.target.value)} className="form-control w-full rounded-lg p-3 text-gray-900" /></div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {success && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">{success}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={requestClose} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"><X className="h-4 w-4" />Cancelar</button>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar alterações"}</button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
