import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const inventory = readFileSync(new URL("../src/components/dashboard/InventoryTable.js", import.meta.url), "utf8")
const productModal = readFileSync(new URL("../src/components/dashboard/ProductEditModal.js", import.meta.url), "utf8")
const orderModal = readFileSync(new URL("../src/components/Orders/OrderModal.js", import.meta.url), "utf8")
const dashboard = readFileSync(new URL("../src/components/Dashboard.js", import.meta.url), "utf8")
const legacyRoute = readFileSync(new URL("../src/app/estoque/[id]/editar/page.js", import.meta.url), "utf8")

test("inventory opens the product edit modal instead of navigating or rendering an inline edit form", () => {
  assert.match(inventory, /setEditingProduct\(item\)/)
  assert.match(inventory, /<ProductEditModal/)
  assert.doesNotMatch(inventory, /router\.push\(/)
  assert.doesNotMatch(inventory, /setEditing\(|editing\s*!==/)
})

test("product modal is admin-only, labelled and uses the stock movement flow only for quantity differences", () => {
  assert.match(productModal, /canViewFinancials\(currentUser\)/)
  assert.match(productModal, /role="dialog"/)
  assert.match(productModal, /aria-modal="true"/)
  for (const id of ["edit-product-name", "edit-product-quantity", "edit-product-min", "edit-product-max", "edit-product-price"]) {
    assert.match(productModal, new RegExp(`htmlFor=\"${id}\"`))
  }
  assert.match(productModal, /await saveProduct\(\{ id: original\.id, \.\.\.next, quantity: original\.quantity \}\)/)
  assert.match(productModal, /await changeStock\(original\.id, quantityDelta\)/)
  assert.match(productModal, /fieldset disabled=\{saving\}/)
})

test("order modal waits for saving and dashboard closes it only after saveOrder succeeds", () => {
  assert.match(orderModal, /await onSave\?\.\(/)
  assert.match(orderModal, /catch \(saveError\)/)
  assert.match(orderModal, /fieldset disabled=\{saving\}/)
  assert.match(orderModal, /Editar Pedido/)
  assert.match(dashboard, /async function handleSaveOrder\(order\)/)
  assert.match(dashboard, /await saveOrder\(order\)/)
  assert.match(dashboard, /setIsModalOpen\(false\)/)
})

test("the former product edit URL redirects to stock without keeping another edit screen", () => {
  assert.match(legacyRoute, /redirect\("\/estoque"\)/)
  assert.doesNotMatch(legacyRoute, /<form/)
})
