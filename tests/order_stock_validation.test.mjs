import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/utils/orderStockValidation.js', import.meta.url), 'utf8')
const { findSaleStockShortage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const item = (quantity, productId = 'P') => ({ productId, quantity })
const inventory = [{ id: 'P', name: 'Product', quantity: 4 }, { id: 'Q', name: 'Other', quantity: 1 }]
const originalOrder = { operation: 'Venda', stock_applied: true, items: [item(6)] }
const options = { operation: 'Venda', status: 'waiting', originalOrder }

test('sale edits consume only the additional quantity, allowing unchanged, reduced and affordable increased quantities', () => {
  for (const quantity of [6, 4, 8, 10]) {
    assert.equal(findSaleStockShortage([item(quantity)], inventory, options), null)
  }
  assert.deepEqual(findSaleStockShortage([item(11)], inventory, options), {
    productId: 'P', name: 'Product', required: 5, available: 4,
  })
  assert.equal(findSaleStockShortage([item(8)], [{ ...inventory[0], quantity: 1 }], options).required, 2)
  assert.equal(findSaleStockShortage([item(8)], [{ ...inventory[0], quantity: 2 }], options), null)
})

test('the delta is grouped by product across original and new item lines', () => {
  const original = { ...originalOrder, items: [item(2), item(4)] }
  assert.equal(findSaleStockShortage([item(4), item(6)], inventory, { ...options, originalOrder: original }), null)
  assert.equal(findSaleStockShortage([item(5), item(6)], inventory, { ...options, originalOrder: original }).required, 5)
  assert.equal(findSaleStockShortage([item(3), item(2)], inventory, { operation: 'Venda' }).required, 5)
})

test('new sales, changed products and orders without applied stock receive no unrelated stock credit', () => {
  assert.equal(findSaleStockShortage([item(6)], inventory, { operation: 'Venda' }).required, 6)
  assert.equal(findSaleStockShortage([item(2, 'Q')], inventory, options).productId, 'Q')
  assert.equal(findSaleStockShortage([item(6)], inventory, {
    ...options, originalOrder: { ...originalOrder, stock_applied: false },
  }).required, 6)
})

test('purchase-to-sale changes also account for reversing the original incoming stock', () => {
  const purchase = { ...originalOrder, operation: 'Compra', items: [item(3)] }
  assert.equal(findSaleStockShortage([item(1)], inventory, { ...options, originalOrder: purchase }), null)
  assert.equal(findSaleStockShortage([item(2)], inventory, { ...options, originalOrder: purchase }).required, 5)
  assert.equal(findSaleStockShortage([item(1, 'Q')], inventory, {
    ...options, originalOrder: { ...purchase, items: [item(5)] },
  }).productId, 'P')
})

test('cancellation does not consume new sale quantities and purchase validation remains with the server', () => {
  assert.equal(findSaleStockShortage([item(100)], inventory, { ...options, status: 'cancelled' }), null)
  assert.equal(findSaleStockShortage([item(100)], inventory, { ...options, operation: 'Compra' }), null)
  assert.equal(findSaleStockShortage([item(100, 'missing')], inventory, { operation: 'Venda' }), null)
})
