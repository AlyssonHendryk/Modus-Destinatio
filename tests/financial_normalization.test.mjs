import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/utils/formatters.js', import.meta.url), 'utf8')
const { parseCurrency, formatCurrency, normalizeOrder } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)

test('absent and invalid currency values stay unavailable instead of becoming zero', () => {
  for (const value of [undefined, null, '', '  ', NaN, Infinity, -Infinity,
    'invalid', 'price 42', 'R$', 'NaN', 'Infinity', '.', '1,2,3', true, false, [], {}, '1e999']) {
    assert.equal(parseCurrency(value), undefined)
    assert.equal(formatCurrency(value), '—')
  }
})

test('legitimate zeros and valid decimal/Brazilian amounts retain their value', () => {
  for (const [value, expected] of [
    [0, 0], ['0', 0], ['0.00', 0], ['R$ 0,00', 0],
    [12.75, 12.75], ['12.75', 12.75], ['12,75', 12.75],
    ['R$ 1.234,56', 1234.56], ['1234.56', 1234.56], [-25.5, -25.5],
  ]) {
    assert.equal(parseCurrency(value), expected)
    assert.equal(formatCurrency(value), expected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
  }
})

const operational = {
  id: 'O1', supplier: 'Supplier', operation: 'Venda', status: 'separating',
  date: '01/01/2026', stock_applied: true,
  items: [{ productId: 'P1', product: 'Product', quantity: 2 }],
}

test('normalization preserves operational data without creating financial fields', () => {
  const result = normalizeOrder(operational)
  for (const key of ['id', 'supplier', 'operation', 'status', 'date', 'stock_applied']) {
    assert.equal(result[key], operational[key])
  }
  assert.equal(result.customer, 'Supplier')
  assert.deepEqual(result.items, operational.items)
  assert.equal(Object.hasOwn(result, 'total'), false)
  for (const key of ['unitPrice', 'price', 'subtotal', 'total']) {
    assert.equal(Object.hasOwn(result.items[0], key), false)
  }
  assert.deepEqual(normalizeOrder(result), result)
  assert.equal(Object.hasOwn(operational, 'total'), false)
})

test('missing totals are never inferred from empty, partial or fully priced items', () => {
  for (const items of [[], operational.items,
    [{ ...operational.items[0], unitPrice: 10 }, { productId: 'P2', quantity: 3 }],
    [{ ...operational.items[0], unitPrice: 10 }],
  ]) {
    const result = normalizeOrder({ ...operational, items })
    assert.equal(Object.hasOwn(result, 'total'), false)
    for (const item of result.items) assert.equal(Object.hasOwn(item, 'subtotal'), false)
  }
})

test('null and invalid financial fields are omitted, including their legacy price alias', () => {
  for (const value of [null, undefined, '', 'bad-value', NaN, Infinity, false]) {
    const result = normalizeOrder({
      ...operational, total: value, items: [{ ...operational.items[0], unitPrice: value, price: value }],
    })
    assert.equal(Object.hasOwn(result, 'total'), false)
    assert.equal(Object.hasOwn(result.items[0], 'unitPrice'), false)
    assert.equal(Object.hasOwn(result.items[0], 'price'), false)
  }
})

test('full administrative data preserves prices, totals, zero and legacy item names', () => {
  for (const [price, total] of [[0, 0], [12.75, 25.5], ['R$ 12,75', 'R$ 25,50']]) {
    const result = normalizeOrder({
      ...operational, total, status: 'Aguardando',
      items: [{ id: 'P1', name: 'Product', quantity: 2, price }],
    })
    assert.equal(result.status, 'waiting')
    assert.equal(result.total, parseCurrency(total))
    assert.equal(result.items[0].unitPrice, parseCurrency(price))
    assert.equal(result.items[0].productId, 'P1')
    assert.equal(result.items[0].quantity, 2)
  }
})
