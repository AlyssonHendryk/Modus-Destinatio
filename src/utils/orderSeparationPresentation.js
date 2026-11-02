export const ACTIVE_SEPARATION_STATUSES = new Set(["waiting", "separating"])
export const HISTORY_ORDER_STATUSES = new Set(["completed", "cancelled", "shipped"])
export const INITIAL_HISTORY_ORDER_LIMIT = 5

function parseRealOrderDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== "string" || !value.trim()) return null
  const text = value.trim()
  const brazilianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoDate) {
    const [, year, month, day] = isoDate
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function historyDate(order) {
  // Future-compatible with a backend that explicitly exposes updated_at.
  if (order?.updated_at) return { value: order.updated_at, source: "updated" }
  return { value: order?.date, source: "order" }
}

function matchesPeriod(date, period, now) {
  if (period === "all") return true
  if (!date) return false
  const reference = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(reference.getTime())) return false
  const lowerBound = new Date(reference)
  if (period === "last7days") lowerBound.setDate(lowerBound.getDate() - 7)
  if (period === "lastMonth") lowerBound.setMonth(lowerBound.getMonth() - 1)
  return date.getTime() >= lowerBound.getTime() && date.getTime() <= reference.getTime()
}

export function splitSeparationOrders(orders = []) {
  const safeOrders = Array.isArray(orders) ? orders : []
  return {
    active: safeOrders.filter((order) => ACTIVE_SEPARATION_STATUSES.has(order?.status)),
    history: safeOrders.filter((order) => HISTORY_ORDER_STATUSES.has(order?.status)),
  }
}

export function filterHistoricalOrders(orders = [], { search = "", period = "all", now = new Date() } = {}) {
  const query = String(search).trim().toLocaleLowerCase("pt-BR")
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => HISTORY_ORDER_STATUSES.has(order?.status))
    .filter((order) => {
      const searchable = [order.id, order.customer, order.supplier, ...(order.items || []).map((item) => item.product)]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query))
      const date = parseRealOrderDate(historyDate(order).value)
      return searchable && matchesPeriod(date, period, now)
    })
    .sort((first, second) => {
      const firstDate = parseRealOrderDate(historyDate(first).value)
      const secondDate = parseRealOrderDate(historyDate(second).value)
      return (secondDate?.getTime() ?? -Infinity) - (firstDate?.getTime() ?? -Infinity)
    })
}

export function visibleHistoricalOrders(orders, expanded) {
  return expanded ? orders : orders.slice(0, INITIAL_HISTORY_ORDER_LIMIT)
}

export function getHistoricalOrderDateLabel(order) {
  const { value, source } = historyDate(order)
  if (!value) return "Data do pedido indisponível"
  return `${source === "updated" ? "Atualizado em" : "Data do pedido"}: ${value}`
}
