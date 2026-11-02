import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const babel = require("next/dist/compiled/babel/core")
const source = readFileSync(new URL("../src/utils/orderSeparationPresentation.js", import.meta.url), "utf8")
const compiled = babel.transformSync(source, { filename: "orderSeparationPresentation.js", babelrc: false, configFile: false, plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")] }).code
const loadedModule = { exports: {} }
vm.runInThisContext(`(function(module,exports){${compiled}\n})`, { filename: "orderSeparationPresentation.js" })(loadedModule, loadedModule.exports)
const { INITIAL_HISTORY_ORDER_LIMIT, filterHistoricalOrders, splitSeparationOrders, visibleHistoricalOrders } = loadedModule.exports

const orders = [
  { id: "A1", status: "waiting", customer: "Ana", supplier: "Origem", date: "2026-04-10", items: [] },
  { id: "A2", status: "separating", customer: "Bia", supplier: "Origem", date: "2026-04-09", items: [] },
  { id: "H1", status: "completed", customer: "Carlos", supplier: "Fornecedor Sul", date: "2026-04-08", items: [{ product: "Caderno" }] },
  { id: "H2", status: "cancelled", customer: null, supplier: "Fornecedor Norte", date: "2026-04-07", items: [{ product: "Caneta" }] },
  { id: "H3", status: "shipped", customer: "Dora", supplier: "Origem", date: "2026-04-06", items: [{ product: "Papel" }] },
  { id: "H4", status: "completed", customer: "Eva", supplier: "Origem", date: "2026-04-05", items: [] },
  { id: "H5", status: "completed", customer: "Fábio", supplier: "Origem", date: "2026-04-04", items: [] },
  { id: "H6", status: "completed", customer: "Gabi", supplier: "Origem", date: "2026-04-03", items: [] },
]

test("separation keeps active orders apart from completed, cancelled and shipped history", () => {
  const separated = splitSeparationOrders(orders)
  assert.deepEqual(separated.active.map((order) => order.id), ["A1", "A2"])
  assert.deepEqual(separated.history.map((order) => order.id), ["H1", "H2", "H3", "H4", "H5", "H6"])
})

test("history sorts by the real available order date and starts with five entries", () => {
  const history = filterHistoricalOrders(orders, { now: new Date("2026-04-10T12:00:00") })
  assert.equal(INITIAL_HISTORY_ORDER_LIMIT, 5)
  assert.deepEqual(visibleHistoricalOrders(history, false).map((order) => order.id), ["H1", "H2", "H3", "H4", "H5"])
  assert.equal(visibleHistoricalOrders(history, true).length, 6)
})

test("history search matches id, customer, supplier and product without financial data", () => {
  const now = new Date("2026-04-10T12:00:00")
  assert.deepEqual(filterHistoricalOrders(orders, { search: "h2", now }).map((order) => order.id), ["H2"])
  assert.deepEqual(filterHistoricalOrders(orders, { search: "norte", now }).map((order) => order.id), ["H2"])
  assert.deepEqual(filterHistoricalOrders(orders, { search: "caderno", now }).map((order) => order.id), ["H1"])
})

test("history period filters use a moving seven-day and one-month window", () => {
  const now = new Date("2026-04-10T12:00:00")
  assert.deepEqual(filterHistoricalOrders(orders, { period: "last7days", now }).map((order) => order.id), ["H1", "H2", "H3", "H4", "H5", "H6"])
  assert.deepEqual(filterHistoricalOrders([...orders, { id: "OLD", status: "completed", date: "2026-03-01", items: [] }], { period: "lastMonth", now }).map((order) => order.id), ["H1", "H2", "H3", "H4", "H5", "H6"])
})

test("separation components expose compact history controls and no history transition action", () => {
  const history = readFileSync(new URL("../src/components/separation/OrderSeparationHistory.js", import.meta.url), "utf8")
  const grid = readFileSync(new URL("../src/components/separation/OrderSeparationGrid.js", import.meta.url), "utf8")
  assert.match(history, /Histórico de pedidos/)
  assert.match(history, /Ver mais pedidos/)
  assert.match(history, /Ver menos/)
  assert.match(history, /Cliente não informado/)
  assert.match(history, /data do pedido disponível/i)
  assert.match(grid, /const activeOrders = orders\.filter/)
})
