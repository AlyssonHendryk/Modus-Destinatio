export const INITIAL_MOVEMENT_LIMIT = 5

function dateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
}

export function filterStockMovements(movements = [], inventory = [], filters = {}) {
  const query = String(filters.search || "").trim().toLowerCase()
  const movementType = filters.movementType || "all"
  const startDate = filters.startDate || ""
  const endDate = filters.endDate || ""
  const products = Array.isArray(inventory) ? inventory : []

  return (Array.isArray(movements) ? movements : [])
    .filter((movement) => {
      const productId = String(movement?.product_id ?? "")
      const productName = String(products.find((item) => item.id === productId)?.name ?? "").toLowerCase()
      const key = dateKey(movement?.created_at)
      const matchesSearch = !query || productId.toLowerCase().includes(query) || productName.includes(query)
      const matchesType = movementType === "all" || (movementType === "entry" && movement.delta > 0) || (movementType === "exit" && movement.delta < 0)
      return Boolean(key) && matchesSearch && matchesType && (!startDate || key >= startDate) && (!endDate || key <= endDate)
    })
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
}

export function visibleStockMovements(movements, expanded) {
  return expanded ? movements : movements.slice(0, INITIAL_MOVEMENT_LIMIT)
}
