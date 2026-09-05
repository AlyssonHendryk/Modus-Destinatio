export const ORDER_STATUS = {
  waiting: "Aguardando",
  separating: "Em separação",
  shipped: "Em rota",
  completed: "Concluído",
  cancelled: "Cancelado",
}

export function formatCurrency(value) {
  const number = Number(value) || 0
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function parseCurrency(value) {
  if (typeof value === "number") return value
  if (!value) return 0
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  return Number(normalized) || 0
}

export function normalizeOrder(raw) {
  const items = (raw.items || raw.products || []).map((item, index) => ({
    productId: item.productId || item.id || `P${index + 1}`,
    product: item.product || item.name || "Produto",
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: parseCurrency(item.unitPrice ?? item.price),
  }))

  const statusMap = {
    Aguardando: "waiting",
    "Em separação": "separating",
    "Em rota": "shipped",
    Concluído: "completed",
    Cancelado: "cancelled",
    Pendente: "waiting",
  }

  const total = raw.total != null
    ? parseCurrency(raw.total)
    : items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  return {
    ...raw,
    id: raw.id || `#${Date.now().toString().slice(-6)}`,
    customer: raw.customer || raw.supplier || "Cliente não informado",
    supplier: raw.supplier || raw.customer || "Não informado",
    operation: raw.operation || "Venda",
    status: statusMap[raw.status] || raw.status || "waiting",
    date: raw.date || new Date().toLocaleDateString("pt-BR"),
    total,
    items,
  }
}
