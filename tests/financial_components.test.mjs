import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Compile the actual JSX with Next's installed Babel and render with React SSR.
// External services, context, navigation, icons and chart primitives are substituted.
const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const root = fileURLToPath(new URL('../', import.meta.url))
const compiled = new Map()
const files = {
  inventory: 'src/components/dashboard/InventoryTable.js',
  orders: 'src/components/Orders/OrdersTable.js',
  list: 'src/components/dashboard/OrdersList.js',
  kpis: 'src/components/dashboard/KPICards.js',
  charts: 'src/components/dashboard/AnalyticsCharts.js',
  modal: 'src/components/Orders/OrderModal.js',
  header: 'src/components/Orders/OrdersHeader.js',
  dashboard: 'src/components/Dashboard.js',
  separation: 'src/components/separation/OrderSeparationGrid.js',
  historyPage: 'src/app/historico/page.js',
}
const product = { id: 'P1', name: 'Produto operacional', quantity: 8, min: 2, max: 20, active: true, unitPrice: 12.75 }
const order = {
  id: 'O1', customer: 'Cliente operacional', supplier: 'Origem', operation: 'Venda',
  date: '01/01/2026', status: 'waiting', stock_applied: true, total: 25.5,
  items: [{ productId: 'P1', product: 'Produto operacional', quantity: 2, unitPrice: 12.75 }],
}

function render(name, role, props = {}, options = {}) {
  const app = {
    currentUser: role ? { id: 'test-user', role, status: options.status || 'active' } : null,
    authLoading: false, orders: [order], inventory: [product], tasks: [], stockMovements: [],
    saveProduct() { throw new Error('SSR must not mutate data') },
    deleteProduct() { throw new Error('SSR must not mutate data') },
    changeStock() { throw new Error('SSR must not mutate data') },
    ...options.app,
  }
  const modules = new Map()
  const hookIndexes = new Map()
  function load(relative) {
    relative = relative.replaceAll('\\', '/')
    const filename = path.resolve(root, relative)
    if (modules.has(filename)) return modules.get(filename).exports
    if (!compiled.has(filename)) {
      compiled.set(filename, babel.transformSync(readFileSync(filename, 'utf8'), {
        filename, babelrc: false, configFile: false,
        presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
        plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
      }).code)
    }
    const loadedModule = { exports: {} }
    modules.set(filename, loadedModule)
    const localRequire = specifier => {
      if (specifier === '@/context/AppContext') return { useApp: () => app }
      if (specifier === '@/services/backend') return new Proxy({}, {
        get: (_target, method) => () => { throw new Error(`SSR must not call backend service: ${String(method)}`) },
      })
      if (specifier === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
      if (specifier === 'next/link') return { __esModule: true, default: ({ children, href }) => React.createElement('a', { href }, children) }
      if (specifier === 'lucide-react') return new Proxy({}, {
        get: (_target, icon) => icon === '__esModule' ? true : () => React.createElement('svg', { 'data-icon': icon }),
      })
      if (specifier === 'recharts') return new Proxy({}, {
        get: (_target, chart) => chart === '__esModule' ? true : ({ children }) => React.createElement('div', { 'data-chart': chart }, children),
      })
      if (specifier === 'react' && options.states?.[relative]) {
        return { ...React, useState(initial) {
          const index = hookIndexes.get(filename) || 0
          hookIndexes.set(filename, index + 1)
          const overrides = options.states[relative]
          return React.useState(Object.hasOwn(overrides, index) ? overrides[index] : initial)
        } }
      }
      if (specifier.startsWith('@/')) return load(`${specifier.slice(2).startsWith('src/') ? '' : 'src/'}${specifier.slice(2)}.js`)
      if (specifier.startsWith('.')) {
        let resolved = path.resolve(path.dirname(filename), specifier)
        if (!path.extname(resolved)) resolved += '.js'
        return load(path.relative(root, resolved))
      }
      return require(specifier)
    }
    vm.runInThisContext(`(function(require,module,exports){${compiled.get(filename)}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  const exports = load(files[name])
  const Component = exports.default || exports.OrdersTable || exports.OrdersHeader
  return renderToStaticMarkup(React.createElement(Component, props))
}

function assertNoFinancials(html) {
  assert.doesNotMatch(html, /R\$|Valor Total|Preço unitário|Subtotal|Vendas|faturamento/i)
}

test('employee inventory shows stock and limits but no price or administrative controls', () => {
  const html = render('inventory', 'employee', {}, { states: { [files.inventory]: { 1: true } } })
  assertNoFinancials(html)
  assert.match(html, /Produto operacional/)
  assert.match(html, /8 un/)
  assert.match(html, /Mín\. 2/)
  assert.match(html, /Máx\. 20/)
  assert.doesNotMatch(html, /Novo produto|Editar produto|Excluir produto|Diminuir|Aumentar|<form/)
})

test('employee orders keep expanded product/quantity details without monetary columns or edit actions', () => {
  const html = render('orders', 'employee', { orders: [order] }, { states: { [files.orders]: { 0: 'O1' } } })
  assertNoFinancials(html)
  assert.match(html, /Produto operacional/)
  assert.match(html, /Quantidade/)
  assert.match(html, /colSpan="5"|colspan="5"/)
  assert.doesNotMatch(html, /Editar pedido|Edição bloqueada|>Ações</)
})

test('legacy orders display a customer fallback without storing it in the edit field', () => {
  const legacy = { ...order, customer: null }
  assert.match(render('orders', 'employee', { orders: [legacy] }, { states: { [files.orders]: { 0: 'O1' } } }), /Cliente não informado/)
  assert.match(render('list', 'employee', { orders: [legacy] }), /Cliente não informado/)
  assert.match(render('separation', 'employee', { orders: [legacy] }), /Cliente não informado/)
  const modal = render('modal', 'admin', { isOpen: true, orderToEdit: legacy })
  assert.match(modal, /placeholder="Nome do cliente"[^>]*value=""|value=""[^>]*placeholder="Nome do cliente"/)
  assert.doesNotMatch(modal, /value="Cliente não informado"/)
})

test('employee recent orders and KPIs remain operational even if financial data is present', () => {
  assertNoFinancials(render('list', 'employee', { orders: [order] }))
  const html = render('kpis', 'employee', { orders: [order], inventory: [product] })
  assertNoFinancials(html)
  assert.match(html, /Pedidos/)
  assert.match(html, /Estoque Baixo/)
  assert.match(html, /Produtos Ativos/)
  assert.match(html, /xl:grid-cols-3/)
})

test('employee charts show status distribution without a financial chart', () => {
  const html = render('charts', 'employee', { orders: [order] })
  assertNoFinancials(html)
  assert.match(html, /Pedidos por status/)
  assert.doesNotMatch(html, /LineChart/)
})

test('employee cannot render new-order controls or force the administrative modal open', () => {
  assert.doesNotMatch(render('header', 'employee'), /Novo Pedido/)
  assert.equal(render('modal', 'employee', { isOpen: true, orderToEdit: order }), '')
  assert.equal(render('modal', null, { isOpen: true }), '')
  assert.equal(render('modal', 'admin', { isOpen: true }, { status: 'inactive' }), '')
})

test('admin retains financial columns, values, indicators, charts and administrative controls', () => {
  const inventory = render('inventory', 'admin')
  assert.match(inventory, /R\$/)
  assert.match(inventory, /Novo produto|Editar produto/)
  assert.match(inventory, /Diminuir/)
  const orders = render('orders', 'admin', { orders: [order] }, { states: { [files.orders]: { 0: 'O1' } } })
  assert.match(orders, /Valor Total/)
  assert.match(orders, /Preço unitário/)
  assert.match(orders, /Subtotal/)
  assert.match(orders, /Editar pedido/)
  assert.match(render('list', 'admin', { orders: [order] }), /R\$/)
  assert.match(render('kpis', 'admin', { orders: [order] }), /Vendas/)
  assert.match(render('charts', 'admin', { orders: [order] }), /Vendas por data/)
  assert.match(render('header', 'admin'), /Novo Pedido/)
  assert.match(render('modal', 'admin', { isOpen: true, orderToEdit: order }), /Preço unitário|Salvar Pedido/)
})

test('legitimate zero is retained for admin while incomplete data does not create financial zeros', () => {
  const zero = { ...order, total: 0, items: [{ ...order.items[0], unitPrice: 0 }] }
  assert.match(render('kpis', 'admin', { orders: [zero] }), /R\$[^<]*0,00/)
  assert.match(render('charts', 'admin', { orders: [zero] }), /Vendas por data/)
  const incomplete = { ...order, total: undefined, items: [{ productId: 'P1', product: 'Produto', quantity: 2 }] }
  for (const name of ['orders', 'list', 'kpis', 'charts']) {
    const html = render(name, 'admin', { orders: [incomplete] }, { states: { [files.orders]: { 0: 'O1' } } })
    assert.doesNotMatch(html, /R\$[^<]*0,00/)
    if (name === 'charts') assert.doesNotMatch(html, /Vendas por data/)
  }
  const modal = render('modal', 'admin', { isOpen: true, orderToEdit: incomplete })
  assert.doesNotMatch(modal, /R\$[^<]*0,00/)
})

test('employee financial components do not even read monetary fields to calculate aggregates', () => {
  const guarded = { ...order, get total() { throw new Error('Employee must not read total') } }
  for (const name of ['kpis', 'charts', 'list', 'orders']) {
    assertNoFinancials(render(name, 'employee', { orders: [guarded] }))
  }
})

test('mixed complete/incomplete orders never produce partial revenue or a financial chart', () => {
  const orders = [order, { ...order, id: 'O2', total: undefined }]
  const kpis = render('kpis', 'admin', { orders })
  assert.doesNotMatch(kpis, /R\$/)
  assert.match(kpis, /Vendas/)
  assert.match(kpis, /—/)
  assert.doesNotMatch(render('charts', 'admin', { orders }), /Vendas por data/)
})

test('dashboard keeps the employee order view and separation controls', () => {
  const html = render('dashboard', 'employee', { initialTab: 'pedidos' })
  assertNoFinancials(html)
  assert.match(html, /Cliente operacional/)
  assert.doesNotMatch(html, /Novo Pedido|Editar pedido|<form/)
  const separating = render('dashboard', 'employee', { initialTab: 'separar' })
  assert.match(separating, /Iniciar Separação/)
  assert.match(separating, /Produto operacional/)
  assertNoFinancials(separating)
  const confirming = render('separation', 'employee', { orders: [{ ...order, status: 'separating' }] })
  assert.match(confirming, /Concluir Separação/)
})


test('completed orders remain readable without Edit while active and shipped orders retain admin editing', () => {
  for (const status of ['completed', 'waiting', 'separating', 'shipped']) {
    const html = render('orders', 'admin', { orders: [{ ...order, status }] }, { states: { [files.orders]: { 0: 'O1' } } })
    assert.match(html, /Produto operacional/)
    if (status === 'completed') assert.doesNotMatch(html, /aria-label="Editar pedido/)
    else assert.match(html, /aria-label="Editar pedido/)
    assert.doesNotMatch(render('orders', 'employee', { orders: [{ ...order, status }] }), /aria-label="Editar pedido/)
  }
})

test('an open order modal disables saving when the live order becomes completed', () => {
  const html = render('modal', 'admin', { isOpen: true, orderToEdit: order }, {
    app: { orders: [{ ...order, status: 'completed' }] },
  })
  assert.match(html, /Pedido concluído/)
  assert.match(html, /type="submit" disabled=""/)
  assert.match(render('modal', 'admin', { isOpen: true }), /Criar Novo Pedido/)
})

test('history route is protected and shows both reused histories for admin and employee', () => {
  for (const role of ['admin', 'employee']) {
    const html = render('historyPage', role)
    assert.match(html, /Histórico de movimentações/)
    assert.match(html, /Histórico de pedidos/)
    assert.match(html, /history-order-search/)
    assert.match(html, /history-order-period/)
    if (role === 'admin') assert.match(html, /id="activity-title"/)
    else assert.doesNotMatch(html, /id="activity-title"|Usuário responsável/)
    assertNoFinancials(html)
    assert.match(html, /data-icon="History"/)
    const stock = render('dashboard', role, { initialTab: 'estoque' })
    const separation = render('dashboard', role, { initialTab: 'separar' })
    for (const old of [stock, separation]) {
      assert.doesNotMatch(old, /Histórico de movimentações|Histórico de pedidos|history-order-search/)
    }
  }
  assert.equal(render('historyPage', null), '')
  assert.doesNotMatch(render('historyPage', 'admin', {}, { status: 'inactive' }), /id="activity-title"/)
  const loading = render('historyPage', 'admin', {}, { app: { authLoading: true } })
  assert.match(loading, /Verificando sessão/)
  assert.doesNotMatch(loading, /history-order-search/)
})


test('history route retains five initial orders, expanded details, filters and show more/less', () => {
  const orders = Array.from({ length: 6 }, (_, i) => ({ ...order, id: `H${i}`, status: 'completed' }))
  const app = { orders }
  const initial = render('historyPage', 'employee', {}, { app })
  assert.equal((initial.match(/<article/g) || []).length, 5)
  assert.match(initial, /Ver mais pedidos/)
  const historyFile = 'src/components/separation/OrderSeparationHistory.js'
  const expanded = render('historyPage', 'employee', {}, { app, states: { [historyFile]: { 2: true, 3: 'H0' } } })
  assert.equal((expanded.match(/<article/g) || []).length, 6)
  assert.match(expanded, /Ver menos/)
  assert.match(expanded, /Produtos e quantidades/)
  assert.match(expanded, /Produto operacional/)
  assertNoFinancials(expanded)
  const filtered = render('historyPage', 'employee', {}, { app, states: { [historyFile]: { 0: 'H5' } } })
  assert.equal((filtered.match(/<article/g) || []).length, 1)
  assert.match(filtered, /Pedido H5/)
  for (const control of ['movement-search', 'movement-type', 'movement-start-date', 'movement-end-date', 'history-order-search', 'history-order-period']) {
    assert.match(initial, new RegExp(`id="${control}"`))
  }
})
