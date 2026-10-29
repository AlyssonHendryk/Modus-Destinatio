import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

// Isolated lifecycle harness, not a browser/React renderer. Run the actual
// provider functions/effects with controlled hooks, timers and network promises.
const original = await readFile(new URL('../src/context/AppContext.js', import.meta.url), 'utf8')
const cacheSource = await readFile(new URL('../src/utils/operationalCache.js', import.meta.url), 'utf8')
const cacheUtils = await import(`data:text/javascript;base64,${Buffer.from(cacheSource).toString('base64')}`)
const formatterSource = await readFile(new URL('../src/utils/formatters.js', import.meta.url), 'utf8')
const formatterUtils = await import(`data:text/javascript;base64,${Buffer.from(formatterSource).toString('base64')}`)
const source = original
  .replace(/import\s+[\s\S]*?\s+from\s+"[^"]+"\s*/g, '')
  .replace(/export function /g, 'function ')
  .replace(/return \(\s*<AppContext.Provider[\s\S]*?<\/AppContext.Provider>\s*\)/, 'return value')

const gridOriginal = await readFile(new URL('../src/components/separation/OrderSeparationGrid.js', import.meta.url), 'utf8')
const gridLogic = gridOriginal.slice(0, gridOriginal.indexOf('  if (!orders.length)'))
  .replace(/import[^\n]+\n/g, '')
  .replace('export default function', 'function') +
  '\nreturn { handleTransition, pending, errors, configs }\n}'

function gridHarness(onStatusChange) {
  const slots = []
  let cursor = 0
  const context = vm.createContext({
    useRef(value) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: value }
      return slots[index]
    },
    useState(value) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value }
      return [slots[index].value, next => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
      }]
    },
    User: null, Package: null, Play: null, CheckCircle: null,
    Clock: null, PackageSearch: null, Truck: null, XCircle: null,
  })
  vm.runInContext(gridLogic, context)
  return () => {
    cursor = 0
    return context.OrderSeparationGrid({ onStatusChange })
  }
}

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function harness(initialUser = null) {
  const slots = []
  const timers = new Map()
  const listeners = new Set()
  const cache = new Map()
  const calls = []
  const requests = []
  const profiles = new Map()
  const windowListeners = new Map()
  let cursor = 0
  let timerId = 0
  let dirty = false
  let effects = []
  let session = initialUser ? { user: { id: initialUser, email: 'test@example.test' } } : null
  let value
  let read = async name => [{ id: `${session.user.id}-${name}`, items: [] }]
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, next => {
        const result = typeof next === 'function' ? next(slots[index].value) : next
        if (!Object.is(result, slots[index].value)) { slots[index].value = result; dirty = true }
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: initial }
      return slots[index]
    },
    useCallback(fn, deps) {
      const index = cursor++
      if (!depsEqual(slots[index]?.deps, deps)) slots[index] = { value: fn, deps }
      return slots[index].value
    },
    useEffect(setup, deps) {
      const index = cursor++
      if (!depsEqual(slots[index]?.deps, deps)) {
        const previous = slots[index]
        slots[index] = { deps, setup }
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = setup() })
      }
    },
  }
  function emit(event, id) {
    session = id ? { user: { id, email: 'test@example.test' } } : null
    for (const listener of listeners) listener(event, session)
  }
  const supabase = {
    auth: {
      onAuthStateChange(callback) {
        listeners.add(callback)
        queueMicrotask(() => { if (listeners.has(callback)) callback('INITIAL_SESSION', session) })
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
      getUser: async () => ({ data: { user: session?.user }, error: null }),
      signInWithPassword: async () => {
        emit('SIGNED_IN', 'A')
        return { data: { user: session.user }, error: null }
      },
      signOut: async () => { emit('SIGNED_OUT', null); return { error: null } },
    },
    from() {
      return { select: () => ({ eq: (_field, id) => ({ single: async () => ({
        data: await (profiles.get(id) || { name: id, role: 'employee', status: 'active' }), error: null,
      }) }) }) }
    },
  }
  const network = Object.fromEntries([
    'getOrders', 'getProducts', 'getStockMovements', 'createOrder', 'updateOrder',
    'removeOrder', 'createProduct', 'updateProduct', 'moveProductStock', 'removeProduct',
    'transitionOrderSeparation',
  ].map(name => [name, (...args) => {
    calls.push(name)
    requests.push({ name, args })
    return read(name, ...args)
  }]))
  const storage = {
    get length() { return cache.size },
    key: index => [...cache.keys()][index] ?? null,
    getItem: key => cache.get(key) ?? null,
    setItem: (key, val) => cache.set(key, val),
    removeItem: key => cache.delete(key),
  }
  const context = vm.createContext({
    ...hooks, ...network, ...cacheUtils, ...formatterUtils, supabase, createContext: () => ({}),
    normalizeOrder: order => order, initialUsers: [], initialTasks: [],
    window: {
      localStorage: storage,
      addEventListener: (name, handler) => windowListeners.set(name, handler),
      removeEventListener: name => windowListeners.delete(name),
    }, localStorage: storage,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id },
    clearTimeout: id => timers.delete(id), console,
  })
  vm.runInContext(source, context)
  function render() {
    let count = 0
    do {
      assert.ok(count++ < 30, 'render loop')
      dirty = false
      cursor = 0
      value = context.AppProvider({ children: null })
      const pending = effects
      effects = []
      for (const effect of pending) effect()
    } while (dirty)
  }
  async function settle() {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve()
      if (dirty) render()
      const pending = [...timers.values()]
      timers.clear()
      for (const timer of pending) timer()
    }
    if (dirty) render()
  }
  render()
  return {
    get value() { return value }, calls, requests, cache, profiles, emit, settle,
    setRead(fn) { read = fn },
    replayEffects() {
      for (const slot of slots) if (slot?.setup) { slot.cleanup?.(); slot.cleanup = slot.setup() }
    },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    listenerCount: () => listeners.size,
    focus: () => windowListeners.get('focus')?.(),
  }
}

test('no private reads before authentication and active profile validation', async () => {
  const h = harness()
  await h.settle()
  assert.equal(h.calls.length, 0)
  const profile = deferred()
  h.profiles.set('A', profile.promise)
  h.emit('SIGNED_IN', 'A')
  await h.settle()
  assert.equal(h.calls.length, 0)
  assert.equal(h.value.authLoading, true)
  profile.resolve({ name: 'A', role: 'employee', status: 'active' })
  await h.settle()
  assert.deepEqual(h.calls.sort(), ['getOrders', 'getProducts', 'getStockMovements'].sort())
  assert.equal(h.value.orders[0].id, 'A-getOrders')
})

test('persisted session and token refresh do not duplicate data reads', async () => {
  const h = harness('A')
  h.replayEffects() // React Strict Mode setup/cleanup replay.
  await h.settle()
  assert.equal(h.calls.length, 3)
  h.emit('TOKEN_REFRESHED', 'A')
  h.emit('SIGNED_IN', 'A')
  await h.settle()
  assert.equal(h.calls.length, 3)
  assert.equal(h.listenerCount(), 1)
  h.unmount()
  assert.equal(h.listenerCount(), 0)
})

test('login loads data without remounting the provider', async () => {
  const h = harness()
  await h.settle()
  const result = await h.value.login('test@example.test', '', 'employee')
  await h.settle()
  assert.equal(result.ok, true)
  assert.equal(h.value.currentUser.id, 'A')
  assert.equal(h.calls.length, 3)
})

test('logout clears memory and ignores pending reads', async () => {
  const h = harness('A')
  const pending = deferred()
  h.setRead(() => pending.promise)
  await h.settle()
  await h.value.logout()
  await h.settle()
  pending.resolve([{ id: 'old-private-data', items: [] }])
  await h.settle()
  assert.equal(h.value.currentUser, null)
  for (const name of ['orders', 'inventory', 'stockMovements', 'users', 'tasks']) {
    assert.equal(h.value[name].length, 0)
  }
})

test('switching users ignores old results and never restores legacy cache', async () => {
  const h = harness('A')
  const pending = deferred()
  h.cache.set('modusdestinatio_state_v1', JSON.stringify({ orders: [{ id: 'legacy-private' }] }))
  h.setRead(() => pending.promise)
  await h.settle()
  h.setRead(async name => [{ id: `B-${name}`, items: [] }])
  h.emit('SIGNED_IN', 'B')
  await h.settle()
  pending.resolve([{ id: 'A-private', items: [] }])
  await h.settle()
  assert.equal(h.value.currentUser.id, 'B')
  assert.equal(h.value.orders[0].id, 'B-getOrders')
  assert.equal(JSON.parse(h.cache.get(cacheUtils.operationalCacheKey('B', 'employee'))).orders[0].id, 'B-getOrders')
})

test('401 and 403 never restore scoped cached orders', async () => {
  for (const status of [401, 403]) {
    const h = harness('A')
    h.cache.set('modusdestinatio_state_v1:A', JSON.stringify({ orders: [{ id: 'cached-private' }] }))
    h.setRead(async () => { const error = new Error('denied'); error.status = status; throw error })
    await h.settle()
    assert.equal(h.value.orders.length, 0)
    assert.equal(h.value.inventory.length, 0)
    assert.equal(h.value.backendError, 'denied')
  }
})

test('inactive profiles and stale profile lookups do not start private reads', async () => {
  const h = harness('A')
  const pending = deferred()
  h.profiles.set('A', pending.promise)
  await h.settle()
  h.emit('SIGNED_OUT', null)
  pending.resolve({ name: 'A', role: 'admin', status: 'active' })
  await h.settle()
  assert.equal(h.calls.length, 0)
  h.profiles.set('B', { name: 'B', role: 'employee', status: 'inactive' })
  h.emit('SIGNED_IN', 'B')
  await h.settle()
  assert.equal(h.calls.length, 0)
  assert.equal(h.value.currentUser, null)
})

test('late movement refresh cannot refill memory after logout', async () => {
  const h = harness('A')
  await h.settle()
  const pending = deferred()
  h.setRead(() => pending.promise)
  const refresh = h.value.loadStockMovements()
  h.emit('SIGNED_OUT', null)
  await h.settle()
  pending.resolve([{ id: 'old-movement' }])
  await refresh
  await h.settle()
  assert.equal(h.value.stockMovements.length, 0)
})

test('refresh rechecks profile status and clears an inactivated user', async () => {
  const h = harness('A')
  await h.settle()
  h.profiles.set('A', { name: 'A', role: 'employee', status: 'inactive' })
  h.emit('TOKEN_REFRESHED', 'A')
  await h.settle()
  assert.equal(h.value.currentUser, null)
  assert.equal(h.value.orders.length, 0)
  assert.equal(h.value.inventory.length, 0)
  assert.equal(h.calls.length, 3)
})

test('same-user network fallback preserves local functionality without crossing users', async () => {
  const h = harness('A')
  h.cache.set('modusdestinatio_state_v1:A', JSON.stringify({
    orders: [{ id: 'A-cached', items: [] }], tasks: [{ id: 'A-task' }], users: [],
  }))
  h.setRead(async () => { throw new Error('offline') })
  await h.settle()
  assert.equal(h.value.orders[0].id, 'A-cached')
  assert.equal(h.value.tasks[0].id, 'A-task')
  assert.equal(h.value.backendError, 'offline')
  h.emit('SIGNED_IN', 'B')
  await h.settle()
  assert.equal(h.value.orders.length, 0)
})

test('late product mutation cannot refill another users inventory', async () => {
  const h = harness('A')
  await h.settle()
  const pending = deferred()
  h.setRead(() => pending.promise)
  const mutation = h.value.saveProduct({ id: 'new-A', name: 'A product', unitPrice: 0 })
  h.setRead(async name => [{ id: `B-${name}`, items: [] }])
  h.emit('SIGNED_IN', 'B')
  await h.settle()
  pending.resolve({ id: 'new-A', name: 'A product' })
  await mutation
  await h.settle()
  assert.equal(h.value.inventory.length, 1)
  assert.equal(h.value.inventory[0].id, 'B-getProducts')
})

test('separation sends only id/action and merges status without inventing financial fields', async () => {
  for (const hasFinancials of [true, false]) {
    const h = harness('A')
    h.profiles.set('A', { name: 'A', role: hasFinancials ? 'admin' : 'employee', status: 'active' })
    const order = {
      id: 'test-order', status: 'waiting', stock_applied: true,
      items: [{ productId: 'P1', quantity: 2 }],
    }
    if (hasFinancials) {
      order.total = 50
      order.items[0].unitPrice = 25
    }
    h.setRead(async name => name === 'getOrders' ? [order] : [])
    await h.settle()
    h.setRead(async (_name, id, action) => ({
      orderId: id, status: action === 'start' ? 'separating' : 'completed', changed: true,
    }))
    for (const [action, status] of [['start', 'separating'], ['confirm', 'completed']]) {
      await h.value.updateOrderStatus('test-order', action)
      await h.settle()
      assert.equal(h.value.orders[0].status, status)
      assert.deepEqual(h.value.orders[0].items, order.items)
      assert.equal(h.value.orders[0].stock_applied, true)
      assert.equal(Object.hasOwn(h.value.orders[0], 'total'), hasFinancials)
      assert.equal(h.value.orders[0].total, order.total)
      assert.deepEqual(h.requests.at(-1), { name: 'transitionOrderSeparation', args: ['test-order', action] })
    }
    assert.equal(h.calls.includes('updateOrder'), false)
    assert.equal(h.calls.includes('moveProductStock'), false)
  }
})

test('separation failure preserves order and propagates its error', async () => {
  const h = harness('A')
  h.setRead(async name => name === 'getOrders' ? [{ id: 'test-order', status: 'waiting' }] : [])
  await h.settle()
  h.setRead(async () => { throw new Error('Transição não permitida') })
  await assert.rejects(h.value.updateOrderStatus('test-order', 'confirm'), /Transição não permitida/)
  await h.settle()
  assert.equal(h.value.orders[0].status, 'waiting')
  assert.equal(h.value.backendError, 'Transição não permitida')
})

test('separation response arriving after logout does not repopulate orders', async () => {
  const h = harness('A')
  h.setRead(async name => name === 'getOrders' ? [{ id: 'test-order', status: 'waiting' }] : [])
  await h.settle()
  const pending = deferred()
  h.setRead(() => pending.promise)
  const transition = h.value.updateOrderStatus('test-order', 'start')
  h.emit('SIGNED_OUT', null)
  await h.settle()
  pending.resolve({ orderId: 'test-order', status: 'separating', changed: true })
  await transition
  await h.settle()
  assert.equal(h.value.orders.length, 0)
})

test('grid maps states to actions and prevents duplicate clicks while pending', async () => {
  const pending = deferred()
  const calls = []
  const render = gridHarness((...args) => { calls.push(args); return pending.promise })
  let grid = render()
  assert.equal(grid.configs.waiting.next, 'start')
  assert.equal(grid.configs.separating.next, 'confirm')
  const first = grid.handleTransition('test-order', grid.configs.waiting.next)
  await grid.handleTransition('test-order', 'start')
  grid = render()
  assert.equal(grid.pending['test-order'], true)
  assert.deepEqual(calls, [['test-order', 'start']])
  pending.resolve()
  await first
  assert.equal(render().pending['test-order'], false)
})

test('grid exposes separation errors and permits a later retry', async () => {
  let fail = true
  const render = gridHarness(async () => { if (fail) throw new Error('Transição não permitida') })
  await render().handleTransition('test-order', 'confirm')
  assert.equal(render().errors['test-order'], 'Transição não permitida')
  assert.equal(render().pending['test-order'], false)
  fail = false
  await render().handleTransition('test-order', 'confirm')
  assert.equal(render().errors['test-order'], '')
})

function privateRows(name, role) {
  if (name === 'getOrders') return [{
    id: 'O1', status: 'waiting', stock_applied: true,
    items: [{ productId: 'P1', product: 'Product', quantity: 2,
      ...(role === 'admin' ? { unitPrice: 25 } : {}) }],
    ...(role === 'admin' ? { total: 50 } : {}),
  }]
  if (name === 'getProducts') return [{
    id: 'P1', name: 'Product', quantity: 8, min: 1, max: 20, active: true,
    ...(role === 'admin' ? { unitPrice: 25 } : {}),
  }]
  return []
}

test('same-user admin downgrade clears state, ignores pending reads and reloads operational data', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.setRead(async name => privateRows(name, 'admin'))
  await h.settle()
  assert.equal(h.value.orders[0].total, 50)
  assert.equal(h.value.inventory[0].unitPrice, 25)
  const pendingHistory = deferred()
  h.setRead(() => pendingHistory.promise)
  const history = h.value.loadStockMovements()
  const nextRead = deferred()
  h.profiles.set('A', { name: 'A', role: 'employee', status: 'active' })
  h.setRead(() => nextRead.promise)
  h.emit('TOKEN_REFRESHED', 'A')
  await h.settle()
  assert.equal(h.value.currentUser.role, 'employee')
  assert.equal(h.value.orders.length, 0)
  assert.equal(h.value.inventory.length, 0)
  pendingHistory.resolve([{ id: 'old-history' }])
  await history
  await h.settle()
  assert.equal(h.value.stockMovements.length, 0)
  // Even unexpected financial fields in a response cannot enter employee state.
  nextRead.resolve(privateRows('getOrders', 'admin'))
  await h.settle()
  assert.equal(Object.hasOwn(h.value.orders[0], 'total'), false)
  assert.equal(Object.hasOwn(h.value.orders[0].items[0], 'unitPrice'), false)
  assert.equal(Object.hasOwn(h.value.inventory[0], 'unitPrice'), false)
})

test('same-user promotion reloads current financial data only from the API', async () => {
  const h = harness('A')
  h.setRead(async name => privateRows(name, 'employee'))
  await h.settle()
  h.cache.set(cacheUtils.operationalCacheKey('A', 'admin'), JSON.stringify({
    version: 2, userId: 'A', role: 'admin', orders: [{ id: 'O1', total: 99999 }],
  }))
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.setRead(async name => privateRows(name, 'admin'))
  h.focus()
  await h.settle()
  assert.equal(h.calls.length, 6)
  assert.equal(h.value.currentUser.role, 'admin')
  assert.equal(h.value.orders[0].total, 50)
  assert.equal(h.value.inventory[0].unitPrice, 25)
  const stored = JSON.parse(h.cache.get(cacheUtils.operationalCacheKey('A', 'admin')))
  assert.equal(Object.hasOwn(stored.orders[0], 'total'), false)
  assert.equal(Object.hasOwn(stored.inventory[0], 'unitPrice'), false)
  assert.equal(Object.hasOwn(stored, 'role'), false)
})

test('legacy and tampered caches cannot grant financial access or restore credentials', async () => {
  const h = harness('A')
  h.cache.set('modusdestinatio_state_v1:A', JSON.stringify({
    role: 'admin', currentUserId: 'forged', authUser: { role: 'admin' },
    users: [{ id: 'forged', password: 'test-only-placeholder' }],
    orders: privateRows('getOrders', 'admin'), inventory: privateRows('getProducts', 'admin'),
    tasks: [{ id: 'T1', title: 'Local task', done: false, financial: 999 }],
  }))
  h.setRead(async () => { throw new Error('offline') })
  await h.settle()
  assert.equal(h.value.currentUser.id, 'A')
  assert.equal(h.value.currentUser.role, 'employee')
  assert.equal(Object.hasOwn(h.value.orders[0], 'total'), false)
  assert.equal(Object.hasOwn(h.value.inventory[0], 'unitPrice'), false)
  assert.equal(h.value.tasks[0].title, 'Local task')
  for (const serialized of h.cache.values()) {
    assert.doesNotMatch(serialized, /unitPrice|total|password|authUser|currentUserId|financial|forged/)
  }
})

test('admin offline fallback never restores financial values even from an admin cache', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.cache.set('modusdestinatio_state_v1:A', JSON.stringify({
    orders: privateRows('getOrders', 'admin'), inventory: privateRows('getProducts', 'admin'),
  }))
  h.setRead(async () => { throw new Error('offline') })
  await h.settle()
  assert.equal(h.value.currentUser.role, 'admin')
  assert.equal(Object.hasOwn(h.value.orders[0], 'total'), false)
  assert.equal(Object.hasOwn(h.value.inventory[0], 'unitPrice'), false)
})

test('profile revalidation hides the previous view while leaving unchanged sessions loaded', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.setRead(async name => privateRows(name, 'admin'))
  await h.settle()
  const profile = deferred()
  h.profiles.set('A', profile.promise)
  h.focus()
  await h.settle()
  assert.equal(h.value.authLoading, true)
  await assert.rejects(h.value.loadStockMovements(), /Sessão alterada/)
  profile.resolve({ name: 'A', role: 'admin', status: 'active' })
  await h.settle()
  assert.equal(h.value.authLoading, false)
  assert.equal(h.value.orders[0].total, 50)
  assert.equal(h.calls.length, 3)
})

test('old administrative mutation cannot refill same-user employee state', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.setRead(async name => privateRows(name, 'admin'))
  await h.settle()
  const pending = deferred()
  h.setRead(() => pending.promise)
  const mutation = h.value.saveProduct({ id: 'P1', name: 'Product', unitPrice: 900 })
  h.profiles.set('A', { name: 'A', role: 'employee', status: 'active' })
  h.setRead(async name => privateRows(name, 'employee'))
  h.focus()
  await h.settle()
  pending.resolve({ id: 'P1', name: 'Old admin product', unitPrice: 900 })
  await mutation
  await h.settle()
  assert.equal(h.value.inventory[0].name, 'Product')
  assert.equal(Object.hasOwn(h.value.inventory[0], 'unitPrice'), false)
})

test('administrative edits cannot turn operational cached records into zero-valued prices', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.cache.set('modusdestinatio_state_v1:A', JSON.stringify({
    orders: privateRows('getOrders', 'admin'), inventory: privateRows('getProducts', 'admin'),
  }))
  h.setRead(async () => { throw new Error('offline') })
  await h.settle()
  const calls = h.calls.length
  await assert.rejects(h.value.saveProduct(h.value.inventory[0]), /preço válido/)
  await assert.rejects(h.value.saveOrder(h.value.orders[0]), /preços e total válidos/)
  assert.equal(h.calls.length, calls)
  h.setRead(async (_name, data) => data)
  const product = await h.value.saveProduct({ ...h.value.inventory[0], unitPrice: 0 })
  assert.equal(product.unitPrice, 0)
})

test('pending initial reads stay invalid after an admin-employee-admin role cycle', async () => {
  const h = harness('A')
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  const oldReads = deferred()
  h.setRead(() => oldReads.promise)
  await h.settle()
  h.profiles.set('A', { name: 'A', role: 'employee', status: 'active' })
  h.setRead(async name => privateRows(name, 'employee'))
  h.focus()
  await h.settle()
  h.profiles.set('A', { name: 'A', role: 'admin', status: 'active' })
  h.setRead(async name => privateRows(name, 'admin'))
  h.focus()
  await h.settle()
  oldReads.resolve([{ id: 'old-admin-record', total: 99999, unitPrice: 99999, items: [] }])
  await h.settle()
  assert.equal(h.value.currentUser.role, 'admin')
  assert.equal(h.value.orders[0].id, 'O1')
  assert.equal(h.value.orders[0].total, 50)
  assert.equal(h.value.inventory[0].id, 'P1')
  assert.equal(h.value.inventory[0].unitPrice, 25)
})
