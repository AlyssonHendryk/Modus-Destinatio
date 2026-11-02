const ORDER_STATUS_SUMMARIES = [
  { status: "waiting", label: "Pedidos aguardando separação", priority: "attention" },
  { status: "separating", label: "Pedidos em separação", priority: "attention" },
  { status: "completed", label: "Pedidos concluídos", priority: "neutral" },
  { status: "cancelled", label: "Pedidos cancelados", priority: "neutral" },
]

// This is a live operational summary, not persisted notification history.
export function buildOperationalNotifications(orders = [], inventory = []) {
  const safeOrders = Array.isArray(orders) ? orders : []
  const safeInventory = Array.isArray(inventory) ? inventory : []
  const items = []
  const lowStockCount = safeInventory.filter((product) =>
    Number.isFinite(Number(product.quantity)) &&
    Number.isFinite(Number(product.min)) &&
    Number(product.quantity) <= Number(product.min)
  ).length

  if (lowStockCount > 0) {
    items.push({
      id: "low-stock",
      kind: "lowStock",
      priority: "urgent",
      count: lowStockCount,
      label: lowStockCount === 1 ? "Produto com estoque no mínimo ou abaixo" : "Produtos com estoque no mínimo ou abaixo",
    })
  }

  ORDER_STATUS_SUMMARIES.forEach(({ status, label, priority }) => {
    const count = safeOrders.filter((order) => order?.status === status).length
    if (count > 0) items.push({ id: `orders-${status}`, kind: status, priority, count, label })
  })

  return {
    items,
    // The badge highlights only work that can still require an action.
    actionableCount: lowStockCount + safeOrders.filter((order) =>
      order?.status === "waiting" || order?.status === "separating"
    ).length,
  }
}
