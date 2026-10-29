import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'

// Exercise the actual service without contacting Supabase or a database.
const source = await readFile(new URL('../src/services/backend.js', import.meta.url), 'utf8')
const formatterSource = await readFile(new URL('../src/utils/formatters.js', import.meta.url), 'utf8')
const formatterUrl = `data:text/javascript;base64,${Buffer.from(formatterSource).toString('base64')}`
const token = randomBytes(32).toString('hex')
let session = { access_token: token }
globalThis.__backendAuthTest = {
  auth: { getSession: async () => ({ data: { session }, error: null }) },
}
const moduleSource = source.replace(
  'import { supabase } from "../lib/supabase"',
  'const supabase = globalThis.__backendAuthTest',
).replace('"../utils/formatters.js"', JSON.stringify(formatterUrl))
const backend = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`)

test('private request carries the current session token', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    assert.ok(url.endsWith('/api/products'))
    return new Response('[]', { status: 200 })
  }
  assert.deepEqual(await backend.getProducts(), [])
})

test('missing session blocks the request before fetch', async () => {
  session = null
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected fetch') }
  await assert.rejects(backend.getProducts(), error => error.status === 401)
  assert.equal(calls, 0)
})

test('backend authentication rejection is propagated without retrying a mutation', async () => {
  session = { access_token: token }
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ detail: 'Sessão inválida ou expirada.' }), { status: 401 })
  }
  await assert.rejects(backend.moveProductStock('test-product', 1), error => error.status === 401)
  assert.equal(calls, 1)
})

test('separation service sends exactly action with Bearer and preserves operational response', async () => {
  session = { access_token: token }
  for (const action of ['start', 'confirm']) {
    const expected = { orderId: 'order / test', status: action === 'start' ? 'separating' : 'completed', changed: false }
    globalThis.fetch = async (url, options) => {
      assert.ok(url.endsWith('/api/orders/order%20%2F%20test/separation'))
      assert.equal(options.method, 'PATCH')
      assert.equal(options.headers.Authorization, `Bearer ${token}`)
      assert.deepEqual(JSON.parse(options.body), { action })
      return new Response(JSON.stringify(expected), { status: 200 })
    }
    const result = await backend.transitionOrderSeparation('order / test', action)
    assert.deepEqual(result, expected)
    assert.equal(Object.hasOwn(result, 'total'), false)
    assert.equal(Object.hasOwn(result, 'items'), false)
  }
})

test('separation service rejects unsupported actions before fetch', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected fetch') }
  await assert.rejects(backend.transitionOrderSeparation('test', 'completed'), /Ação de separação inválida/)
  assert.equal(calls, 0)
})

test('employee provisioning sends only employee fields with the current Bearer token', async () => {
  session = { access_token: token }
  const password = randomBytes(24).toString('base64url')
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/api/admin/users'))
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    assert.deepEqual(JSON.parse(options.body), {
      name: 'Employee Test', email: 'employee@example.test', password,
    })
    return new Response(JSON.stringify({
      id: '6f76db2f-33db-44ea-ae50-eec7ea8e0660', name: 'Employee Test',
      role: 'employee', status: 'active',
    }), { status: 201 })
  }
  const created = await backend.createEmployee({
    name: 'Employee Test', email: 'employee@example.test', password,
    role: 'admin', status: 'inactive', id: 'must-not-be-sent',
  })
  assert.deepEqual(created, {
    id: '6f76db2f-33db-44ea-ae50-eec7ea8e0660', name: 'Employee Test',
    role: 'employee', status: 'active',
  })
  assert.deepEqual(session, { access_token: token })
})

test('employee provisioning propagates authentication and validation failures without retrying', async t => {
  t.mock.method(console, 'error', () => {})
  session = { access_token: token }
  for (const status of [401, 403, 409, 422, 500, 502]) {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response(JSON.stringify({ detail: 'Cadastro indisponível.' }), { status })
    }
    await assert.rejects(
      backend.createEmployee({ name: 'Employee Test', email: 'employee@example.test', password: 'not-logged' }),
      error => error.status === status && error.message === 'Cadastro indisponível.',
    )
    assert.equal(calls, 1)
  }
})

test('administrative directory request uses Bearer pagination and allowlists the response', async () => {
  session = { access_token: token }
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/api/admin/users?page=2&per_page=10'))
    assert.equal(options.method, undefined)
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    return new Response(JSON.stringify({
      users: [{
        id: '6f76db2f-33db-44ea-ae50-eec7ea8e0660', name: 'Employee Test',
        email: 'employee@example.test', role: 'employee', status: 'active',
        created_at: '2026-01-01T00:00:00Z', encrypted_password: 'must-not-retain', token: 'must-not-retain',
      }],
      page: 2, per_page: 10, total: 11, internal: 'must-not-retain',
    }), { status: 200 })
  }
  const directory = await backend.getAdminUsers(2, 10)
  assert.deepEqual(directory, {
    users: [{
      id: '6f76db2f-33db-44ea-ae50-eec7ea8e0660', name: 'Employee Test',
      email: 'employee@example.test', role: 'employee', status: 'active', created_at: '2026-01-01T00:00:00Z',
    }],
    page: 2, per_page: 10, total: 11,
  })
})

test('administrative directory propagates backend denial without retrying', async t => {
  t.mock.method(console, 'error', () => {})
  session = { access_token: token }
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ detail: 'Acesso negado.' }), { status: 403 })
  }
  await assert.rejects(backend.getAdminUsers(), error => error.status === 403)
  assert.equal(calls, 1)
})

test('order reads preserve operational fields and omit absent/invalid financial fields', async () => {
  session = { access_token: token }
  for (const fields of [{}, { total: null, unitPrice: null },
    { total: 'invalid', unitPrice: 'invalid', price: 'invalid' }]) {
    const row = {
      id: 'O1', supplier: 'Supplier', status: 'separating', date: '01/01/2026',
      operation: 'Venda', stock_applied: true,
      ...(Object.hasOwn(fields, 'total') ? { total: fields.total } : {}),
      items: [{ productId: 'P1', product: 'Product', quantity: 2,
        ...(Object.hasOwn(fields, 'unitPrice') ? { unitPrice: fields.unitPrice } : {}),
        ...(Object.hasOwn(fields, 'price') ? { price: fields.price } : {}),
      }],
    }
    globalThis.fetch = async () => new Response(JSON.stringify([row]), { status: 200 })
    const [result] = await backend.getOrders()
    assert.equal(result.id, 'O1')
    assert.equal(result.status, 'separating')
    assert.equal(result.stock_applied, true)
    assert.equal(result.items[0].quantity, 2)
    assert.equal(result.items[0].id, 'P1')
    assert.equal(Object.hasOwn(result, 'total'), false)
    for (const key of ['unitPrice', 'price', 'subtotal']) {
      assert.equal(Object.hasOwn(result.items[0], key), false)
    }
  }
})

test('order reads preserve zero and complete administrative financial values', async () => {
  session = { access_token: token }
  for (const [price, total] of [[0, 0], ['0.00', '0.00'], ['12.75', '25.50']]) {
    globalThis.fetch = async () => new Response(JSON.stringify([{
      id: 'O1', total, items: [{ productId: 'P1', product: 'Product', quantity: 2, unitPrice: price }],
    }]), { status: 200 })
    const [result] = await backend.getOrders()
    assert.equal(result.total, Number(total))
    assert.equal(result.items[0].unitPrice, Number(price))
    assert.equal(result.items[0].price, Number(price))
  }
})

test('product reads distinguish absent/invalid prices from legitimate zero', async () => {
  session = { access_token: token }
  for (const fields of [{}, { unitPrice: null }, { unitPrice: 'invalid' }, { unitPrice: 0 }, { unitPrice: '12.75' }]) {
    globalThis.fetch = async () => new Response(JSON.stringify([{
      id: 'P1', name: 'Product', quantity: '8', min: '1', max: '20', active: true, ...fields,
    }]), { status: 200 })
    const [result] = await backend.getProducts()
    const valid = fields.unitPrice === 0 || fields.unitPrice === '12.75'
    assert.equal(Object.hasOwn(result, 'unitPrice'), valid)
    assert.equal(Object.hasOwn(result, 'price'), false)
    assert.equal(result.quantity, 8)
    assert.equal(result.active, true)
    if (valid) assert.equal(result.unitPrice, Number(fields.unitPrice))
  }
})

test('administrative order create/update contracts retain zero and Brazilian money inputs', async t => {
  t.mock.method(console, 'log', () => {})
  session = { access_token: token }
  for (const method of ['POST', 'PUT']) {
    for (const [price, total, expectedPrice, expectedTotal] of [[0, 0, 0, 0], ['R$ 12,75', 'R$ 25,50', 12.75, 25.5]]) {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.method, method)
        const body = JSON.parse(options.body)
        assert.equal(body.total, expectedTotal)
        assert.equal(body.items[0].unitPrice, expectedPrice)
        assert.equal(body.items[0].quantity, 2)
        return new Response(JSON.stringify(body), { status: 200 })
      }
      const order = { id: 'O1', total, items: [{ productId: 'P1', product: 'Product', quantity: 2, unitPrice: price }] }
      const result = await (method === 'POST' ? backend.createOrder(order) : backend.updateOrder(order))
      assert.equal(result.total, expectedTotal)
      assert.equal(result.items[0].unitPrice, expectedPrice)
    }
  }
})

test('administrative product create/update contracts preserve numeric prices including zero', async () => {
  session = { access_token: token }
  for (const method of ['POST', 'PUT']) {
    for (const unitPrice of [0, 12.75]) {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.method, method)
        const body = JSON.parse(options.body)
        assert.equal(body.unitPrice, unitPrice)
        return new Response(JSON.stringify(body), { status: 200 })
      }
      const product = { id: 'P1', name: 'Product', quantity: 8, min: 1, max: 20, unitPrice }
      const result = await (method === 'POST' ? backend.createProduct(product) : backend.updateProduct(product))
      assert.equal(result.unitPrice, unitPrice)
    }
  }
})
