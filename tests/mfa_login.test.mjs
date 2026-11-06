import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const source = readFileSync(new URL('../src/components/LoginCard.js', import.meta.url), 'utf8')
const code = babel.transformSync(source, {
  babelrc: false, configFile: false,
  presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
  plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
}).code

function load(react, app, router) {
  const loaded = { exports: {} }
  const localRequire = name => {
    if (name === 'react') return react
    if (name === '@/context/AppContext') return { useApp: () => app }
    if (name === 'next/navigation') return { useRouter: () => router }
    return require(name)
  }
  // Expose the private component only inside this isolated test module.
  vm.runInThisContext(`(function(require,module,exports){${code}\nmodule.exports.challenge = TotpChallenge;\n})`)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

test('MFA pending login renders only the TOTP challenge; ordinary login retains email and password', () => {
  const app = { mfaPending: true, completeMfa() {}, logout() {}, login() {} }
  const { default: Card } = load(React, app, { push() {} })
  let html = renderToStaticMarkup(React.createElement(Card))
  assert.match(html, /login-totp|Autenticação de dois fatores/)
  assert.match(html, /Cancelar e voltar ao login/)
  assert.doesNotMatch(html, /login-password|login-email/)
  app.mfaPending = false
  html = renderToStaticMarkup(React.createElement(Card))
  assert.match(html, /login-email/)
  assert.match(html, /login-password/)
  assert.doesNotMatch(html, /login-totp/)
})

function challengeHarness(verify, cancel = async () => {}) {
  let cursor = 0
  const slots = []
  const errors = []
  let redirects = 0
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
    useEffect: () => {},
  }
  const { challenge: Challenge } = load(hooks, {}, {})
  function render() {
    cursor = 0
    return Challenge({ verify: async code => { const result = await verify(code); if (result.ok) redirects++; return result }, cancel, onCancelError: error => errors.push(error) })
  }
  function flatten(element) {
    if (!element || typeof element !== 'object') return []
    return [element, ...React.Children.toArray(element.props?.children).flatMap(flatten)]
  }
  return {
    render,
    controls() {
      const form = render()
      const nodes = flatten(form)
      return { form, input: nodes.find(node => node.type === 'input'), buttons: nodes.filter(node => node.type === 'button') }
    },
    get redirects() { return redirects }, errors,
  }
}

test('TOTP input is cleared after failure/success, permits retry and redirects only on success', async () => {
  let succeed = false
  const received = []
  const ui = challengeHarness(async code => { received.push(code); return succeed ? { ok: true } : { ok: false, message: 'Código inválido.' } })
  ui.controls().input.props.onChange({ target: { value: '123456' } })
  await ui.controls().form.props.onSubmit({ preventDefault() {} })
  assert.equal(ui.controls().input.props.value, '')
  assert.equal(ui.redirects, 0)
  succeed = true
  ui.controls().input.props.onChange({ target: { value: '654321' } })
  await ui.controls().form.props.onSubmit({ preventDefault() {} })
  assert.equal(ui.controls().input.props.value, '')
  assert.equal(ui.redirects, 1)
  assert.deepEqual(received, ['123456', '654321'])
})

test('TOTP blocks malformed codes and duplicate verification; cancel clears code and signs out', async () => {
  let release
  let calls = 0
  const ui = challengeHarness(async () => { calls++; return new Promise(resolve => { release = resolve }) })
  ui.controls().input.props.onChange({ target: { value: 'bad' } })
  await ui.controls().form.props.onSubmit({ preventDefault() {} })
  assert.equal(calls, 0)
  assert.equal(ui.controls().input.props.value, '')
  ui.controls().input.props.onChange({ target: { value: '123456' } })
  const submit = ui.controls().form.props.onSubmit
  const pending = submit({ preventDefault() {} })
  await submit({ preventDefault() {} })
  assert.equal(calls, 1)
  assert.equal(ui.controls().input.props.disabled, true)
  assert.ok(ui.controls().buttons.every(button => button.props.disabled))
  release({ ok: false, message: 'Tente novamente.' })
  await pending
  let cancelled = 0
  const cancel = challengeHarness(async () => { throw Error('Unexpected verification') }, async () => { cancelled++ })
  cancel.controls().input.props.onChange({ target: { value: '123456' } })
  await cancel.controls().buttons.find(button => button.props.type === 'button').props.onClick()
  assert.equal(cancel.controls().input.props.value, '')
  assert.equal(cancelled, 1)
  assert.equal(cancel.redirects, 0)
})

test('password form does not navigate when login returns an MFA requirement and clears the password', async () => {
  const slots = []
  let cursor = 0
  let redirects = 0
  const hooks = { useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], value => { slots[index] = value }]
  } }
  const { default: Card } = load(hooks, { login: async () => ({ ok: false, mfaRequired: true }), mfaPending: false }, { push: () => { redirects++ } })
  const render = () => { cursor = 0; return Card() }
  render()
  slots[0] = 'user@example.test'
  slots[1] = 'test-password'
  const form = render().props.children.find(child => child?.type === 'form')
  await form.props.onSubmit({ preventDefault() {} })
  assert.equal(redirects, 0)
  assert.equal(slots[1], '')
})

test('the parent performs MFA success navigation even when the challenge is removed from the tree', async () => {
  let cursor = 0
  let redirects = 0
  const slots = []
  const hooks = { useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], value => { slots[index] = value }]
  } }
  let success = false
  const app = { mfaPending: true, completeMfa: async () => {
    if (success) app.mfaPending = false
    return { ok: success }
  } }
  const { default: Card } = load(hooks, app, { push: path => { assert.equal(path, '/dashboard'); redirects++ } })
  const render = () => { cursor = 0; return Card() }
  const challenge = render().props.children.find(child => typeof child?.type === 'function')
  await challenge.props.verify('000000')
  assert.equal(redirects, 0)
  success = true
  await challenge.props.verify('123456')
  assert.equal(app.mfaPending, false)
  assert.equal(redirects, 1)
  assert.ok(render().props.children.some(child => child?.type === 'form'))
})
