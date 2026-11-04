import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const presentation = await readFile(new URL("../src/utils/activityPresentation.js", import.meta.url), "utf8")
const { ACTIVITY_ACTIONS, activityActorLabel, activityDetails, activityFilters } = await import(`data:text/javascript;base64,${Buffer.from(presentation).toString("base64")}`)
const polling = await readFile(new URL("../src/utils/activityPolling.js", import.meta.url), "utf8")
const { ACTIVITY_POLL_INTERVAL, shouldPollActivityPage } = await import(`data:text/javascript;base64,${Buffer.from(polling).toString("base64")}`)

test("all audit actions have Portuguese descriptions", () => {
  assert.equal(Object.keys(ACTIVITY_ACTIONS).length, 19)
  assert.equal(ACTIVITY_ACTIONS["employee.creation_outcome_unknown"], "Criação de funcionário pendente de confirmação")
})

test("details display allowed changes without arbitrary or nested secrets", () => {
  const result = activityDetails({ action: "product.updated", details: {
    password: "SECRET", error: "RAW ERROR", changes: {
      active: { before: true, after: false }, token: { before: "SECRET", after: "TOKEN" },
      name: { before: { password: "SECRET" }, after: "Produto" },
    },
    item_changes: [{ kind: "added", item: { password: "SECRET" } }],
  } })
  assert.ok(result.includes("Ativo: Sim → Não"))
  assert.ok(result.includes("Nome: — → Produto"))
  assert.doesNotMatch(result.join(" "), /SECRET|TOKEN|RAW ERROR|password/)
  assert.deepEqual(activityDetails({ action: "unknown", details: { name: "SECRET" } }), [])
})

test("compensation distinguishes an unattempted reversal from an unknown outcome", () => {
  for (const [compensation_result, message] of [
    ["not_attempted", "Reversão não realizada"],
    ["unknown", "Resultado da reversão desconhecido"],
    ["succeeded", "Cadastro desfeito com confirmação"],
  ]) {
    assert.deepEqual(activityDetails({
      action: "employee.creation_outcome_unknown", details: { compensation_result },
    }), [message])
  }
})

test("activity history prefers the returned profile name and falls back safely for historical actors", () => {
  const currentUser = { id: "current", name: "Administrator" }
  assert.equal(activityActorLabel({ actor_id: "employee", actor_role: "employee", actor_name: "Responsible employee" }, currentUser), "Responsible employee")
  assert.equal(activityActorLabel({ actor_id: "current", actor_role: "admin", actor_name: null }, currentUser), "Administrator")
  assert.equal(activityActorLabel({ actor_id: "deadbeef-1234", actor_role: "employee", actor_name: "   " }, currentUser), "Funcionário · deadbeef")
})

test("filters validate UUID and period, final day is inclusive in local time", () => {
  assert.throws(() => activityFilters({ user_id: "bad", start: "", end: "" }), /identificador/)
  assert.throws(() => activityFilters({ user_id: "", start: "2026-11-03", end: "2026-11-02" }), /data inicial/)
  const result = activityFilters({ user_id: "", action: "order.created", start: "2026-11-02", end: "2026-11-02" })
  assert.equal(result.date_from, new Date("2026-11-02T00:00:00").toISOString())
  assert.equal(result.date_to, new Date("2026-11-03T00:00:00").toISOString())
})

test("audit polling refreshes only the visible first page without concurrent requests", () => {
  assert.equal(ACTIVITY_POLL_INTERVAL, 30_000)
  assert.equal(shouldPollActivityPage({ cursor: null, hidden: false, inFlight: false }), true)
  assert.equal(shouldPollActivityPage({ cursor: "older-page", hidden: false, inFlight: false }), false)
  assert.equal(shouldPollActivityPage({ cursor: null, hidden: true, inFlight: false }), false)
  assert.equal(shouldPollActivityPage({ cursor: null, hidden: false, inFlight: true }), false)
})

const backendSource = await readFile(new URL("../src/services/backend.js", import.meta.url), "utf8")
const formatter = await readFile(new URL("../src/utils/formatters.js", import.meta.url), "utf8")
const moduleSource = backendSource.replace('import { supabase } from "../lib/supabase"',
  'const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: "mock-only" } } }) } }')
  .replace('"../utils/formatters.js"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(formatter).toString("base64")}`))
const { getActivityLogs } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`)

test("service preserves opaque cursor and filters, authenticates and forwards cancellation", async () => {
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    const query = new URL(url).searchParams
    assert.equal(query.get("cursor"), "opaque+/cursor=")
    assert.equal(query.get("limit"), "50")
    assert.equal(query.get("action"), "order.created")
    assert.equal(query.get("password"), null)
    assert.equal(options.headers.Authorization, "Bearer mock-only")
    assert.equal(options.signal, controller.signal)
    return Response.json({ events: [], has_more: false, next_cursor: null })
  }
  assert.deepEqual(await getActivityLogs({ action: "order.created", password: "secret" }, "opaque+/cursor=", controller.signal), { events: [], has_more: false, next_cursor: null })
})

test("service rejects inconsistent pagination", async () => {
  globalThis.fetch = async () => Response.json({ events: [], has_more: true, next_cursor: null })
  await assert.rejects(getActivityLogs(), /histórico/)
})

test("history integration preserves existing panels and resets ownership on account changes", async () => {
  const dashboard = await readFile(new URL("../src/components/Dashboard.js", import.meta.url), "utf8")
  const component = await readFile(new URL("../src/components/dashboard/ActivityHistory.js", import.meta.url), "utf8")
  assert.match(dashboard, /<StockMovementHistory \/>/)
  assert.match(dashboard, /<OrderSeparationHistory orders=/)
  assert.match(dashboard, /!authLoading && currentUser\?\.role === "admin" && currentUser\?\.status === "active"/)
  assert.match(dashboard, /<ActivityHistory key=\{currentUser.id\}/)
  assert.match(component, /alive = false\s+controller\.abort\(\)/)
  assert.match(component, /load\(query.filters, page.next_cursor\)/)
  assert.match(component, /activityActorLabel\(event, user\)/)
  assert.match(component, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/)
  assert.match(component, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/)
  assert.match(component, /ACTIVITY_POLL_INTERVAL/)
  assert.match(component, /query\.cursor !== null/)
  assert.match(component, /requestInFlight\.current/)
})
