import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToString } from 'react-dom/server'

const require = createRequire(import.meta.url)
const babel = require('next/dist/compiled/babel/core')

test('real provider and Settings render on the server without reading browser storage', () => {
  const modules = new Map()
  let browserReads = 0
  const context = vm.createContext({})
  for (const name of ['window', 'document', 'localStorage']) {
    Object.defineProperty(context, name, { get() {
      browserReads += 1
      throw new Error(`SSR accessed ${name}`)
    } })
  }
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative).exports
    const filename = new URL(`../${relative}`, import.meta.url)
    const code = babel.transformSync(readFileSync(filename, 'utf8'), {
      filename: filename.pathname, babelrc: false, configFile: false,
      presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'automatic' }]],
      plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
    }).code
    const loadedModule = { exports: {} }
    modules.set(relative, loadedModule)
    function localRequire(specifier) {
      if (specifier === '@/lib/supabase') return { supabase: {} }
      if (specifier === '@/data/mockData') return { initialTasks: [] }
      if (specifier === '@/services/backend' || specifier === '@/utils/formatters' ||
          specifier === '@/utils/operationalCache') return {}
      if (specifier === 'lucide-react') return new Proxy({}, {
        get: (_target, name) => name === '__esModule' ? true : () => null,
      })
      if (specifier.startsWith('@/')) return load(`src/${specifier.slice(2)}.js`)
      return require(specifier)
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  const { AppProvider, useApp } = load('src/context/AppContext.js')
  const Settings = load('src/components/settings/SystemPreferences.js').default
  function Probe() {
    const app = useApp()
    assert.equal(app.authLoading, true)
    assert.equal(app.currentUser, null)
    assert.equal(app.preferences.theme, 'light')
    return React.createElement(Settings)
  }
  const render = () => renderToString(React.createElement(AppProvider, null, React.createElement(Probe)))
  const first = render()
  assert.match(first, /Salvar Preferências/)
  assert.equal(render(), first, 'initial markup is deterministic for hydration')
  assert.equal(browserReads, 0)
})

test('the default light theme cannot be overridden by an operating-system dark media query', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /@media\s*\(prefers-color-scheme:\s*dark\)/)
  assert.match(css, /\.modus-dark body/)
})
