import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const admin = { id: 'A', role: 'admin', status: 'active' }
const setup = { factorId: 'new-factor', secret: 'test-only-secret', qrCode: 'data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E' }
function load(relative, react, service, currentUser = admin) {
  const source = readFileSync(new URL('../' + relative, import.meta.url), 'utf8')
  const code = babel.transformSync(source, { babelrc: false, configFile: false,
    presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
    plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
  }).code
  const loaded = { exports: {} }
  const localRequire = name => {
    if (name === 'react') return react
    if (name === '@/services/mfa') return { mfaManagement: service }
    if (name === '@/context/AppContext') return { useApp: () => ({ currentUser }) }
    if (name === './MfaSettings') return { __esModule: true, default: load('src/components/settings/MfaSettings.js', react, service) }
    if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
    if (name === 'lucide-react') return { Shield: () => null }
    return require(name)
  }
  const context = vm.createContext({})
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(context, name, { get() { throw Error('MFA must never access persistent storage') } })
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, loaded, loaded.exports)
  return loaded.exports.default
}

function harness(user = admin, initial = { level: 'aal1', verified: [], pending: [] }) {
  let snapshot = initial
  let failCode = false
  let resolveEnrollment
  let delayed = false
  const calls = []
  const listeners = new Set()
  const service = {
    read: async () => { calls.push('read'); return snapshot },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    enroll: async () => { calls.push('enroll'); return delayed ? new Promise(resolve => { resolveEnrollment = resolve }) : setup },
    confirmEnrollment: async (_user, factorId, code) => {
      calls.push(['confirm', factorId, code])
      if (failCode) throw Error('Código inválido. Tente novamente.')
      snapshot = { level: 'aal2', verified: [{ id: factorId, type: 'totp', name: 'App' }], pending: [] }
      return snapshot
    },
    cancelEnrollment: async (_user, factorId) => { calls.push(['cancel', factorId]); return snapshot },
    discardPending: async (_user, factorId) => { calls.push(['discard', factorId]); snapshot = { ...snapshot, pending: [] }; return snapshot },
    verifyRemoval: async (_user, factorId, code) => { calls.push(['verify-removal', factorId, code]) },
    removeVerified: async (_user, factorId) => { calls.push(['remove', factorId]); snapshot = { ...snapshot, verified: snapshot.verified.filter(factor => factor.id !== factorId) }; return snapshot },
  }
  let cursor = 0
  const slots = []
  const effects = []
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(setup) { if (!effects.length) effects.push({ setup }) },
  }
  const Component = load('src/components/settings/MfaSettings.js', hooks, service)
  function render() { cursor = 0; return Component({ user }) }
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)]
  render()
  return {
    calls, service,
    html: () => renderToStaticMarkup(render()),
    button: label => flatten(render()).find(node => node.type === 'button' && renderToStaticMarkup(node).includes(label)),
    input: () => flatten(render()).find(node => node.type === 'input'),
    form: () => flatten(render()).find(node => node.type === 'form'),
    mount() { for (const effect of effects) effect.cleanup = effect.setup() },
    unmount() { for (const effect of effects) effect.cleanup?.() },
    replay() { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup() } },
    async settle() { for (let i = 0; i < 30; i++) await Promise.resolve() },
    failCode(value) { failCode = value },
    delayEnrollment() { delayed = true },
    resolveEnrollment() { resolveEnrollment(setup) },
    notify(value) { snapshot = value; for (const listener of listeners) listener(user.id) },
  }
}

test('only active admins see MFA controls in SecuritySection; password recovery link stays available', () => {
  for (const user of [admin, { ...admin, role: 'employee' }, { ...admin, status: 'inactive' }]) {
    const Section = load('src/components/settings/SecuritySection.js', React, {}, user)
    const html = renderToStaticMarkup(React.createElement(Section))
    assert.match(html, /forgotPass/)
    assert.equal(html.includes('Autenticação de dois fatores'), user.role === 'admin' && user.status === 'active')
  }
})

test('employee and inactive profiles perform no factor reads; active admin starts loading then disabled', async () => {
  for (const user of [{ ...admin, role: 'employee' }, { ...admin, status: 'inactive' }]) {
    const ui = harness(user)
    ui.mount(); await ui.settle()
    assert.equal(ui.html(), '')
    assert.equal(ui.calls.length, 0)
  }
  const ui = harness()
  assert.match(ui.html(), /Carregando fatores/)
  ui.mount(); await ui.settle()
  assert.match(ui.html(), /Habilitar 2FA/)
  assert.doesNotMatch(ui.html(), /dois fatores ativa/)
})

test('setup shows official QR/manual key and clears secrets and code only after verified success', async () => {
  const ui = harness()
  ui.mount(); await ui.settle()
  await ui.button('Habilitar 2FA').props.onClick()
  assert.match(ui.html(), /data:image\/svg/)
  assert.match(ui.html(), /bg-\[#fff\]/)
  assert.match(ui.html(), /test-only-secret/)
  assert.doesNotMatch(ui.html(), /dois fatores ativa/)
  ui.failCode(true)
  ui.input().props.onChange({ target: { value: '000000' } })
  await ui.form().props.onSubmit({ preventDefault() {} })
  assert.equal(ui.input().props.value, '')
  assert.match(ui.html(), /Código inválido/)
  assert.match(ui.html(), /test-only-secret/)
  ui.failCode(false)
  ui.input().props.onChange({ target: { value: '123456' } })
  await ui.form().props.onSubmit({ preventDefault() {} })
  assert.match(ui.html(), /dois fatores ativa/)
  assert.doesNotMatch(ui.html(), /test-only-secret|data:image\/svg|mfa-setup-code/)
})

test('cancel clears QR/key/code and removes only this attempt; strict-mode effects never enroll', async () => {
  const ui = harness()
  ui.mount(); ui.replay(); await ui.settle()
  assert.equal(ui.calls.filter(call => call === 'enroll').length, 0)
  await ui.button('Habilitar 2FA').props.onClick()
  ui.input().props.onChange({ target: { value: '123456' } })
  await ui.button('Cancelar configuração').props.onClick()
  assert.doesNotMatch(ui.html(), /test-only-secret|data:image\/svg|123456/)
  assert.deepEqual(ui.calls.filter(call => Array.isArray(call)), [['cancel', setup.factorId]])
})

test('repeated clicks cannot enroll twice and late enrollment after navigation is cleaned without displaying secrets', async () => {
  const ui = harness()
  ui.mount(); await ui.settle()
  ui.delayEnrollment()
  const click = ui.button('Habilitar 2FA').props.onClick
  const pending = click()
  await click()
  assert.equal(ui.calls.filter(call => call === 'enroll').length, 1)
  ui.unmount()
  ui.resolveEnrollment()
  await pending
  assert.deepEqual(ui.calls.filter(call => Array.isArray(call)), [['cancel', setup.factorId]])
  assert.doesNotMatch(ui.html(), /test-only-secret/)
})

test('disable requires explicit confirmation/code; removing one factor never claims all MFA is disabled', async () => {
  const ui = harness(admin, { level: 'aal2', pending: [], verified: [
    { id: 'F1', type: 'totp', name: 'First' }, { id: 'F2', type: 'totp', name: 'Second' },
  ] })
  ui.mount(); await ui.settle()
  ui.button('Desabilitar 2FA — First').props.onClick()
  assert.match(ui.html(), /Confirma a remoção/)
  assert.equal(ui.calls.filter(call => Array.isArray(call)).length, 0)
  ui.button('Cancelar').props.onClick()
  assert.equal(ui.calls.filter(call => Array.isArray(call)).length, 0)
  ui.button('Desabilitar 2FA — First').props.onClick()
  ui.input().props.onChange({ target: { value: '123456' } })
  await ui.form().props.onSubmit({ preventDefault() {} })
  assert.deepEqual(ui.calls.filter(call => Array.isArray(call)), [['verify-removal', 'F1', '123456'], ['remove', 'F1']])
  assert.match(ui.html(), /continua ativo/)
  assert.doesNotMatch(ui.html(), /2FA desabilitado\./)
})

test('incomplete factors need explicit discard and change notifications refresh official state', async () => {
  const ui = harness(admin, { level: 'aal1', verified: [], pending: [{ id: 'old' }] })
  ui.mount(); await ui.settle()
  assert.equal(ui.button('Habilitar 2FA'), undefined)
  ui.button('Descartar configuração incompleta').props.onClick()
  assert.equal(ui.calls.filter(call => Array.isArray(call)).length, 0)
  await ui.button('Confirmar descarte').props.onClick()
  assert.match(ui.html(), /Habilitar 2FA/)
  ui.notify({ level: 'aal2', pending: [], verified: [{ id: 'F1', type: 'totp', name: 'App' }] })
  await ui.settle()
  assert.match(ui.html(), /dois fatores ativa/)
  assert.equal(ui.button('Habilitar 2FA'), undefined)
})

test('late factor reads cannot populate an unmounted session', async () => {
  const ui = harness()
  let release
  ui.service.read = () => new Promise(resolve => { release = resolve })
  ui.mount()
  ui.unmount()
  release({ level: 'aal2', pending: [], verified: [{ id: 'F1', type: 'totp', name: 'App' }] })
  await ui.settle()
  assert.doesNotMatch(ui.html(), /dois fatores ativa/)
})
