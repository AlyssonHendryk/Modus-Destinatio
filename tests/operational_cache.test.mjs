import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/utils/operationalCache.js', import.meta.url), 'utf8')
const { projectOrders, projectProducts, sanitizeAppCaches, loadOperationalCache,
  persistOperationalCache, operationalCacheKey } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  let writes = 0
  return {
    get length() { return values.size },
    get writes() { return writes },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes++; values.set(key, value) },
    removeItem: key => values.delete(key),
  }
}

const sensitive = {
  role: 'admin', authUser: { role: 'admin' }, currentUserId: 'forged',
  users: [{ id: 'forged', password: 'test-only-placeholder' }],
  orders: [{ id: 'O1', status: 'waiting', total: 123.5, price: 11, cost: 99,
    internal: { revenue: 100 }, items: [{ productId: 'P1', product: 'Product', quantity: 2,
      unitPrice: 61.75, price: 61.75, subtotal: 123.5, details: { cost: 45 } }],
  }],
  inventory: [{ id: 'P1', name: 'Product', quantity: 8, min: 1, max: 10, active: true,
    unitPrice: 61.75, unit_price: 61.75, financial: { revenue: 100 } }],
  tasks: [{ id: 'T1', title: 'Local task', done: false, total: 123.5 }],
}

function assertOperationalOnly(value) {
  const serialized = JSON.stringify(value)
  assert.doesNotMatch(serialized, /total|unitPrice|unit_price|subtotal|revenue|password|authUser|currentUserId|forged|internal|financial|cost/)
}

test('explicit projections drop all nonoperational fields and preserve source data', () => {
  const snapshot = structuredClone(sensitive)
  const orders = projectOrders(sensitive.orders)
  const inventory = projectProducts(sensitive.inventory)
  assert.deepEqual(orders, [{ id: 'O1', status: 'waiting', items: [{ productId: 'P1', product: 'Product', quantity: 2 }] }])
  assert.deepEqual(inventory, [{ id: 'P1', name: 'Product', quantity: 8, min: 1, max: 10, active: true }])
  assertOperationalOnly({ orders, inventory })
  assert.deepEqual(sensitive, snapshot)
})

test('admin and employee caches persist only operational records and local tasks', () => {
  const local = storage()
  for (const role of ['admin', 'employee']) {
    persistOperationalCache(local, 'A', role, sensitive)
    const raw = JSON.parse(local.getItem(operationalCacheKey('A', role)))
    assertOperationalOnly(raw)
    assert.equal(Object.hasOwn(raw, 'role'), false)
    assert.equal(Object.hasOwn(raw, 'users'), false)
    const restored = loadOperationalCache(local, 'A', role)
    assert.equal(restored.orders[0].items[0].quantity, 2)
    assert.deepEqual(restored.tasks, [{ id: 'T1', title: 'Local task', done: false }])
    assertOperationalOnly(restored)
  }
})

test('all known legacy and current caches in both storages are sanitized without touching preferences or Auth', () => {
  const raw = JSON.stringify(sensitive)
  const preferences = JSON.stringify({ theme: 'dark', language: 'pt' })
  const local = storage({
    modusdestinatio_state_v1: raw,
    'modusdestinatio_state_v1:A': raw,
    'modusdestinatio_state_v1:B': raw,
    [operationalCacheKey('A', 'admin')]: JSON.stringify({ ...sensitive, version: 2, userId: 'A' }),
    modusdestinatio_preferences: preferences,
    'sb-test-auth-token': 'sdk-managed-test-placeholder',
    unrelated: 'preserved',
  })
  const session = storage({ 'modusdestinatio_state_v1:A': raw })
  sanitizeAppCaches(local, session)
  assert.equal(local.getItem('modusdestinatio_state_v1'), null)
  for (const key of ['modusdestinatio_state_v1:A', 'modusdestinatio_state_v1:B', operationalCacheKey('A', 'admin')]) {
    assertOperationalOnly(JSON.parse(local.getItem(key)))
  }
  assertOperationalOnly(JSON.parse(session.getItem('modusdestinatio_state_v1:A')))
  assert.equal(local.getItem('modusdestinatio_preferences'), preferences)
  assert.equal(local.getItem('sb-test-auth-token'), 'sdk-managed-test-placeholder')
  assert.equal(local.getItem('unrelated'), 'preserved')
  const writes = local.writes
  sanitizeAppCaches(local, session)
  assert.equal(local.writes, writes, 'already sanitized storage must not trigger cross-tab write loops')
})

test('legacy fallback is sanitized before restoration and never assigns a cached role', () => {
  const local = storage({ 'modusdestinatio_state_v1:A': JSON.stringify(sensitive) })
  const restored = loadOperationalCache(local, 'A', 'employee')
  assertOperationalOnly(restored)
  assertOperationalOnly(JSON.parse(local.getItem('modusdestinatio_state_v1:A')))
  assert.equal(Object.hasOwn(restored, 'role'), false)
  assert.equal(loadOperationalCache(local, 'B', 'employee'), null)
  assert.equal(loadOperationalCache(local, 'A', 'owner'), null)
})

test('malformed caches and ownership mismatches fail closed', () => {
  const key = operationalCacheKey('A', 'employee')
  for (const raw of ['broken-json', 'null', '[]', JSON.stringify({ version: 2, userId: 'B', ...sensitive })]) {
    const local = storage({ [key]: raw })
    assert.equal(loadOperationalCache(local, 'A', 'employee'), null)
  }
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(loadOperationalCache(blocked, 'A', 'employee'), null)
  assert.doesNotThrow(() => persistOperationalCache(blocked, 'A', 'employee', sensitive))
})

test('nonprimitive fields cannot smuggle nested financial records through allowed names', () => {
  const orders = projectOrders([{ id: 'O1', supplier: { total: 100 }, status: 'waiting',
    items: [{ productId: 'P1', product: { cost: 100 }, quantity: { total: 100 } }] }])
  assert.deepEqual(orders, [{ id: 'O1', status: 'waiting', items: [{ productId: 'P1' }] }])
  assertOperationalOnly(orders)
  assert.deepEqual(projectProducts(null), [])
  assert.deepEqual(projectOrders([null, [], 'invalid']), [])
})
