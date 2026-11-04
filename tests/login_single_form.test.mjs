import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const loginCard = readFileSync(new URL("../src/components/LoginCard.js", import.meta.url), "utf8")
const context = readFileSync(new URL("../src/context/AppContext.js", import.meta.url), "utf8")

test("login card contains one email/password form without manual administrator or employee selection", () => {
  assert.match(loginCard, /id="login-email"/)
  assert.match(loginCard, /type="email"/)
  assert.match(loginCard, /id="login-password"/)
  assert.match(loginCard, /type="password"/)
  assert.match(loginCard, /login\(email, password\)/)
  assert.doesNotMatch(loginCard, /setRole|\[role, setRole\]|role === "admin"|role === "employee"/)
})

test("context login accepts credentials only and derives the role from profiles", () => {
  assert.match(context, /async function login\(email, password\)/)
  assert.match(context, /supabase\.auth\.signInWithPassword/)
  assert.match(context, /\.from\("profiles"\)/)
  assert.match(context, /role: profile\.role/)
  assert.doesNotMatch(context, /profile\.role !== type/)
})
