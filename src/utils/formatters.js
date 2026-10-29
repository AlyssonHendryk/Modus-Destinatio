export const ORDER_STATUS = {
  waiting: "Aguardando",
  separating: "Em separação",
  shipped: "Em rota",
  completed: "Concluído",
  cancelled: "Cancelado",
}

export function formatCurrency(value) {
  const number = parseCurrency(value)
  if (number === undefined) return "—"
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function parseCurrency(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value !== "string") return undefined
  const text = value.trim().replace(/^R\$\s*/, "")
  if (!text) return undefined

  // Decimal API strings and Brazilian currency strings are both accepted.
  // Invalid text is rejected, rather than stripped down to an invented amount.
  let normalized = text
  if (text.includes(",")) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)) return undefined
    normalized = text.replace(/\./g, "").replace(",", ".")
  } else if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    return undefined
  }
  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}

export function normalizeOrder(raw) {
  const items = (raw.items || raw.products || []).map((item, index) => {
    const unitPrice = parseCurrency(item.unitPrice ?? item.price)
    return {
      productId: item.productId || item.id || `P${index + 1}`,
      product: item.product || item.name || "Produto",
      quantity: Math.max(1, Number(item.quantity) || 1),
      ...(unitPrice === undefined ? {} : { unitPrice }),
    }
  })

  const statusMap = {
    Aguardando: "waiting",
    "Em separação": "separating",
    "Em rota": "shipped",
    Concluído: "completed",
    Cancelado: "cancelled",
    Pendente: "waiting",
  }

  const { total: rawTotal, ...fields } = raw
  const total = parseCurrency(rawTotal)

 return {
  ...fields,
  stock_applied: raw.stock_applied === true,
  id: raw.id || `#${Date.now().toString().slice(-6)}`,
  customer: raw.customer || raw.supplier || "Cliente não informado",
  supplier: raw.supplier || raw.customer || "Não informado",
  operation: raw.operation || "Venda",
  status: statusMap[raw.status] || raw.status || "waiting",
  date: raw.date || new Date().toLocaleDateString("pt-BR"),
  ...(total === undefined ? {} : { total }),
  items,
}
}
