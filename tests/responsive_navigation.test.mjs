import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const notificationsSource = readFileSync(new URL('../src/utils/operationalNotifications.js', import.meta.url), 'utf8')
const notifications = await import(`data:text/javascript;base64,${Buffer.from(notificationsSource).toString('base64')}`)

function harness(file, props) {
  const effects = [], slots = [], events = new Map(), mediaEvents = new Map(), routes = []
  let cursor = 0, restored = 0
  const document = { activeElement: { focus() { restored++ } },
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name),
  }
  const media = { matches: false,
    addEventListener: (name, callback) => mediaEvents.set(name, callback),
    removeEventListener: name => mediaEvents.delete(name),
  }
  const hooks = { ...React, useMemo: calculate => calculate(),
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value } },
    useEffect: setup => effects.push(setup),
    useState(initial) {
      const i = cursor++
      if (!slots[i]) slots[i] = { value: initial }
      return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }]
    },
  }
  const code = babel.transformSync(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
    plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
  }).code
  const loadedModule = { exports: {} }
  const localRequire = name => {
    if (name === 'react') return hooks
    if (name === '@/context/AppContext') return { useApp: () => ({
      currentUser: { name: 'A long account name for mobile navigation', role: 'admin' }, orders: [], inventory: [],
    }) }
    if (name === 'next/navigation') return { useRouter: () => ({ push: route => routes.push(route) }) }
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...attributes }) => React.createElement('a', attributes, children) }
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
    if (name === '@/utils/operationalNotifications') return notifications
    return require(name)
  }
  vm.runInContext(`(function(require,module,exports){${code}\n})`, vm.createContext({
    document, window: { matchMedia: () => media },
  }))(localRequire, loadedModule, loadedModule.exports)
  const render = () => { cursor = 0; return loadedModule.exports.default(props) }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(child => find(child, predicate))
    return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)]
  }
  return { render, effects, document, events, media, mediaEvents, routes,
    restored: () => restored,
    find: predicate => find(render(), predicate),
  }
}

test('mobile navigation is hidden initially, remains available on desktop and closes on selection or backdrop', () => {
  let closed = 0
  const tabs = []
  const props = { activeTab: 'historico', onTabChange: tab => tabs.push(tab), onClose: () => closed++ }
  const ui = harness('src/components/dashboard/Sidebar.js', props)
  assert.match(renderToStaticMarkup(ui.render()), /hidden lg:flex/)
  assert.equal(ui.find(node => node.props?.tabIndex === -1).length, 0)
  props.mobileOpen = true
  const aside = ui.find(node => node.type === 'aside')[0]
  assert.equal(aside.props.id, 'primary-navigation')
  assert.match(aside.props.className, /max-w-\[calc\(100vw-2rem\)\]/)
  ui.find(node => node.props?.tabIndex === -1)[0].props.onClick()
  assert.equal(closed, 1)
  ui.find(node => node.type === 'button' && renderToStaticMarkup(node).includes('Estoque'))[0].props.onClick()
  assert.deepEqual(tabs, ['estoque'])
  assert.deepEqual(ui.routes, ['/estoque'])
  assert.equal(closed, 2)
})

test('the drawer supports Escape, contained keyboard focus, desktop resize and cleanup', () => {
  let closed = 0
  const ui = harness('src/components/dashboard/Sidebar.js', { mobileOpen: true, onClose: () => closed++ })
  const aside = ui.find(node => node.type === 'aside')[0]
  const close = ui.find(node => node.props?.['aria-label'] === 'Fechar navegação')[0]
  const controls = [0, 1].map(() => ({ getClientRects: () => [{}], focus() { ui.document.activeElement = this } }))
  aside.props.ref.current = { querySelectorAll: () => controls }
  close.props.ref.current = controls[0]
  const cleanup = ui.effects.at(-1)()
  assert.equal(ui.document.activeElement, controls[0])
  ui.events.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() {} })
  assert.equal(ui.document.activeElement, controls[1])
  ui.events.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() {} })
  assert.equal(ui.document.activeElement, controls[0])
  ui.events.get('keydown')({ key: 'Escape', preventDefault() {} })
  assert.equal(closed, 1)
  ui.media.matches = true
  ui.mediaEvents.get('change')()
  assert.equal(closed, 2)
  cleanup()
  assert.equal(ui.events.size, 0)
  assert.equal(ui.mediaEvents.size, 0)
  assert.equal(ui.restored(), 1)
})

test('TopBar exposes the mobile menu control and keeps search and notification actions usable', () => {
  let opened = 0, search = ''
  const ui = harness('src/components/dashboard/TopBar.js', {
    navigationOpen: true, onOpenNavigation: () => opened++, onSearchChange: value => { search = value },
  })
  const menu = ui.find(node => node.props?.['aria-label'] === 'Abrir navegação')[0]
  assert.equal(menu.props['aria-controls'], 'primary-navigation')
  assert.equal(menu.props['aria-expanded'], true)
  menu.props.onClick()
  assert.equal(opened, 1)
  ui.find(node => node.type === 'input')[0].props.onChange({ target: { value: 'P1' } })
  assert.equal(search, 'P1')
  ui.find(node => node.props?.title === 'Abrir notificações')[0].props.onClick()
  const panel = ui.find(node => node.props?.id === 'operational-notifications')[0]
  assert.ok(panel)
  assert.match(panel.props.className, /fixed inset-x-4/)
  assert.match(panel.props.className, /sm:absolute/)
})
