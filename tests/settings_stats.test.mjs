import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')
const source = readFileSync(new URL('../src/components/settings/SettingsStats.js', import.meta.url), 'utf8')
const code = babel.transformSync(source, {
  babelrc: false, configFile: false,
  presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
  plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
}).code
function harness(read) {
  let state = null
  let effect
  let cleanup
  const loadedModule = { exports: {} }
  const environment = vm.createContext({ AbortController })
  function localRequire(name) {
    if (name === 'react') return {
      useState: () => [state, value => { state = value }],
      useEffect: callback => { effect = callback },
    }
    if (name === '@/services/backend') return { getAdminUserStats: read }
    if (name === 'lucide-react') return { ShieldCheck: () => null, UserCheck: () => null }
    return require(name)
  }
  vm.runInContext(`(function(require,module,exports){${code}\n})`, environment)(localRequire, loadedModule, loadedModule.exports)
  return {
    render: (user, revision = 0) => renderToStaticMarkup(loadedModule.exports.default({ user, revision })),
    mount: () => { cleanup = effect() },
    unmount: () => { cleanup?.() },
  }
}
const admin = { id: 'admin-one', role: 'admin', status: 'active' }
test('settings counts render real zero and active counts with no simulated session indicator', async () => {
  const ui = harness(async () => ({ admins: 0, employees: 7 }))
  assert.match(ui.render(admin), /Carregando/)
  ui.mount()
  await Promise.resolve()
  const html = ui.render(admin)
  assert.match(html, />0</)
  assert.match(html, />7</)
  assert.doesNotMatch(html, /Sessão|Sessões|Usuários Ativos/)
})
test('employees and inactive administrators never request administrative counts', () => {
  let calls = 0
  const ui = harness(async () => { calls++; return { admins: 1, employees: 1 } })
  for (const user of [{ ...admin, role: 'employee' }, { ...admin, status: 'inactive' }]) {
    assert.equal(ui.render(user), '')
    ui.mount()
  }
  assert.equal(calls, 0)
})
test('old session count responses are aborted and cannot populate a newer session', async () => {
  let resolve
  let signal
  const ui = harness(value => { signal = value; return new Promise(done => { resolve = done }) })
  ui.render(admin); ui.mount(); ui.unmount()
  assert.equal(signal.aborted, true)
  resolve({ admins: 8, employees: 9 }); await Promise.resolve()
  assert.match(ui.render({ ...admin, id: 'admin-two' }), /Carregando/)
})
test('changed accounts invalidate counts and errors display absence rather than fictitious zeros', async () => {
  const ui = harness(async () => { throw Error('database unavailable') })
  ui.render(admin); ui.mount()
  await Promise.resolve(); await Promise.resolve()
  assert.match(ui.render(admin), /Não foi possível/)
  assert.doesNotMatch(ui.render(admin), />0</)
  assert.match(ui.render(admin, 1), /Carregando/)
})
