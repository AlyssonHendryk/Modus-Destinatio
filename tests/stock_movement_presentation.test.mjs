import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const babel = require("next/dist/compiled/babel/core")
const source = readFileSync(new URL("../src/utils/stockMovementPresentation.js", import.meta.url), "utf8")
const compiled = babel.transformSync(source, { filename: "stockMovementPresentation.js", babelrc: false, configFile: false, plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")] }).code
const loadedModule = { exports: {} }
vm.runInThisContext(`(function(module,exports){${compiled}\n})`, { filename: "stockMovementPresentation.js" })(loadedModule, loadedModule.exports)
const { INITIAL_MOVEMENT_LIMIT, filterStockMovements, visibleStockMovements } = loadedModule.exports

const movements = Array.from({ length: 7 }, (_, index) => ({ id: `M${index}`, product_id: index % 2 ? "P2" : "P1", delta: index % 2 ? -1 : 1, created_at: `2026-01-0${index + 1}T12:00:00Z` }))
const inventory = [{ id: "P1", name: "Produto A" }, { id: "P2", name: "Produto B" }]

test("movement history starts with the five most recent loaded results and can expand", () => {
  const filtered = filterStockMovements(movements, inventory)
  assert.equal(INITIAL_MOVEMENT_LIMIT, 5)
  assert.deepEqual(visibleStockMovements(filtered, false).map((movement) => movement.id), ["M6", "M5", "M4", "M3", "M2"])
  assert.equal(visibleStockMovements(filtered, true).length, 7)
})

test("filters apply before the visual limit and return only matching movement types and dates", () => {
  const filtered = filterStockMovements(movements, inventory, { search: "Produto B", movementType: "exit", startDate: "2026-01-02", endDate: "2026-01-06" })
  assert.deepEqual(filtered.map((movement) => movement.id), ["M5", "M3", "M1"])
  assert.equal(visibleStockMovements(filtered, false).length, 3)
})

test("history component exposes labelled aligned controls and an expand control only for loaded results", () => {
  const component = readFileSync(new URL("../src/components/dashboard/StockMovementHistory.js", import.meta.url), "utf8")
  for (const label of ["Buscar produto ou ID", "Tipo de movimentação", "Data inicial", "Data final"]) assert.match(component, new RegExp(label))
  assert.match(component, /setExpanded\(false\)/)
  assert.match(component, /filteredMovements\.length > INITIAL_MOVEMENT_LIMIT/)
  assert.match(component, /Ver mais movimentações/)
  assert.match(component, /Ver menos/)
})
