// Mirrors the signed, per-product delta in update_order_with_customer_and_stock.
// This is an early UI check only; the transactional RPC is authoritative.
export function findSaleStockShortage(items, inventory, { operation, status, originalOrder } = {}) {
  if (operation !== "Venda") return null
  const quantities = new Map()
  function add(productId, delta) {
    quantities.set(productId, (quantities.get(productId) || 0) + delta)
  }
  if (originalOrder?.stock_applied === true) {
    const oldSign = originalOrder.operation === "Venda" ? -1 : 1
    for (const item of originalOrder.items || []) add(item.productId, -oldSign * item.quantity)
  }
  if (status !== "cancelled") {
    for (const item of items) add(item.productId, -item.quantity)
  }
  for (const [productId, delta] of quantities) {
    const product = inventory.find(item => item.id === productId)
    if (product && delta < 0 && -delta > product.quantity) {
      return { productId, name: product.name, required: -delta, available: product.quantity }
    }
  }
  return null
}
