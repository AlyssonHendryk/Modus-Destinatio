import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import React from 'react'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const stockSource = readFileSync(new URL('../src/utils/orderStockValidation.js', import.meta.url), 'utf8')
const stockValidation = await import(`data:text/javascript;base64,${Buffer.from(stockSource).toString('base64')}`)

function harness(file, props, app = {}, seeds = {}) {
  const slots = []
  let cursor = 0
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: Object.hasOwn(seeds, index) ? seeds[index] : typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, next => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
      }]
    },
    useRef(value) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: value }
      return slots[index]
    },
    useMemo: calculate => calculate(), useEffect: () => {},
  }
  const loadedModule = { exports: {} }
  const errors = []
  const code = babel.transformSync(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
    plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
  }).code
  const context = vm.createContext({ console: { error() {} }, alert: message => errors.push(message) })
  const localRequire = name => {
    if (name === 'react') return hooks
    if (name === '@/context/AppContext') return { useApp: () => ({
      currentUser: { role: 'admin', status: 'active' }, inventory: [], orders: [], ...app,
    }) }
    if (name === '@/utils/orderStockValidation') return stockValidation
    if (name === '@/utils/financialPresentation') return {
      canViewFinancials: user => user?.role === 'admin',
      sumFinancialValues: values => values.reduce((sum, value) => sum + value, 0),
    }
    if (name === '@/utils/formatters') return { formatCurrency: String }
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
    if (name === './ProductEditModal') return { __esModule: true, default: () => null }
    return require(name)
  }
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, loadedModule, loadedModule.exports)
  const render = () => {
    cursor = 0
    const outer = loadedModule.exports.default(props)
    // OrderModal intentionally delegates its hooks to the existing OrderForm.
    return typeof outer?.type === 'function' ? outer.type(outer.props) : outer
  }
  function elements(node, predicate) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(value => elements(value, predicate))
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)]
  }
  return { render, errors,
    find: predicate => elements(render(), predicate),
    form: () => elements(render(), node => node.type === 'form')[0],
  }
}

test('product creation blocks duplicate submissions synchronously, disables inputs, and releases after success or failure', async () => {
  for (const fail of [false, true]) {
    let resolve, reject, count = 0
    const response = new Promise((yes, no) => { resolve = yes; reject = no })
    const ui = harness('src/components/dashboard/InventoryTable.js', {}, {
      saveProduct: async () => { count++; return response },
    })
    ui.find(node => node.type === 'button' && node.props.children?.includes('Novo produto'))[0].props.onClick()
    ui.find(node => node.type === 'input' && node.props.id === 'product-name')[0].props.onChange({ target: { value: 'Real product' } })
    const submit = ui.form().props.onSubmit
    const pending = submit({ preventDefault() {} })
    await submit({ preventDefault() {} })
    assert.equal(count, 1)
    assert.equal(ui.find(node => node.type === 'button' && node.props.type === 'submit')[0].props.disabled, true)
    assert.ok(ui.find(node => node.type === 'input').every(node => node.props.disabled))
    if (fail) reject(new Error('Controlled failure'))
    else resolve({ id: 'P' })
    await pending
    if (fail) {
      assert.ok(ui.form())
      assert.equal(ui.find(node => node.type === 'button' && node.props.type === 'submit')[0].props.disabled, false)
      assert.deepEqual(ui.errors, ['Controlled failure'])
      // A later user-initiated retry is allowed; the guard is not left locked.
      await ui.form().props.onSubmit({ preventDefault() {} })
      assert.equal(count, 2)
    } else {
      assert.equal(ui.form(), undefined)
      assert.equal(ui.find(node => node.type === 'button' && node.props.children?.includes('Novo produto'))[0].props.disabled, false)
    }
  }
})

test('the real order form validates original sale credit for manual entry and +/- controls, without merging customer and supplier', async () => {
  for (const quantity of [4, 6, 8, 10, 11]) {
    const saved = []
    const original = { id: 'O', customer: 'Client', supplier: 'Supplier', operation: 'Venda', status: 'waiting', stock_applied: true,
      items: [{ productId: 'P', product: 'Product', quantity: 6, unitPrice: 2 }] }
    const ui = harness('src/components/Orders/OrderModal.js', {
      isOpen: true, orderToEdit: original, inventory: [{ id: 'P', name: 'Product', quantity: 4, unitPrice: 2 }],
      onSave: async payload => saved.push(payload),
    })
    const input = () => ui.find(node => node.type === 'input' && node.props.id === 'order-item-quantity-0')[0]
    input().props.onChange({ target: { value: String(quantity) } })
    await ui.form().props.onSubmit({ preventDefault() {} })
    assert.equal(saved.length, quantity <= 10 ? 1 : 0)
    if (saved.length) {
      assert.equal(saved[0].items[0].quantity, quantity)
      assert.equal(saved[0].customer, 'Client')
      assert.equal(saved[0].supplier, 'Supplier')
    }
    if (quantity === 6) {
      const plus = ui.find(node => node.type === 'button' && String(node.props.onClick).includes('changeQuantity(index, 1)'))[0]
      plus.props.onClick()
      assert.equal(input().props.value, 7)
    }
    if (quantity === 10) {
      ui.find(node => node.type === 'button' && String(node.props.onClick).includes('changeQuantity(index, 1)'))[0].props.onClick()
      assert.equal(input().props.value, 10)
    }
  }
})
