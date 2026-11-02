import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const babel = require("next/dist/compiled/babel/core")
const source = readFileSync(new URL("../src/utils/operationalNotifications.js", import.meta.url), "utf8")
const compiled = babel.transformSync(source, {
  filename: "operationalNotifications.js",
  babelrc: false,
  configFile: false,
  plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
}).code
const loadedModule = { exports: {} }
vm.runInThisContext(`(function(module,exports){${compiled}\n})`, { filename: "operationalNotifications.js" })(loadedModule, loadedModule.exports)
const { buildOperationalNotifications } = loadedModule.exports

test("operational notifications summarize real order states and low stock without financial fields", () => {
  const summary = buildOperationalNotifications(
    [{ status: "waiting" }, { status: "separating" }, { status: "completed" }, { status: "cancelled" }],
    [{ quantity: 2, min: 2 }, { quantity: 5, min: 1 }]
  )

  assert.equal(summary.actionableCount, 3)
  assert.deepEqual(summary.items.map(({ kind, count }) => ({ kind, count })), [
    { kind: "lowStock", count: 1 },
    { kind: "waiting", count: 1 },
    { kind: "separating", count: 1 },
    { kind: "completed", count: 1 },
    { kind: "cancelled", count: 1 },
  ])
  assert.doesNotMatch(JSON.stringify(summary), /price|total|valor|R\$/i)
})

test("operational notifications remain empty when there are no relevant records", () => {
  assert.deepEqual(buildOperationalNotifications([], []), { items: [], actionableCount: 0 })
})

test("top bar uses a dropdown instead of alert and has accessible close controls", () => {
  const topBar = readFileSync(new URL("../src/components/dashboard/TopBar.js", import.meta.url), "utf8")
  assert.doesNotMatch(topBar, /window\.alert/)
  assert.match(topBar, /buildOperationalNotifications\(orders, inventory\)/)
  assert.match(topBar, /pointerdown/)
  assert.match(topBar, /event\.key !== "Escape"/)
  assert.match(topBar, /aria-expanded=\{isNotificationsOpen\}/)
})
