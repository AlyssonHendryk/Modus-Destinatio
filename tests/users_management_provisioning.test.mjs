import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/components/settings/UsersManagement.js', import.meta.url), 'utf8')
const contextSource = await readFile(new URL('../src/context/AppContext.js', import.meta.url), 'utf8')

test('user management has an employee-only remote creation flow and no default password', () => {
  assert.match(source, /createEmployee\(\{ name, email, password: form\.password \}\)/)
  assert.match(source, /Novo Funcionário/)
  assert.match(source, /type="password"/)
  assert.match(source, /autoComplete="new-password"/)
  assert.doesNotMatch(source, /saveUser|updateUser|deleteUser|openEdit/)
  assert.doesNotMatch(source, /<select|value="admin"|role:|status:/)
  assert.doesNotMatch(source, /123456/)
})

test('user directory has real-list states, pagination and no local account mutations', () => {
  assert.match(source, /getAdminUsers/)
  assert.match(source, /loadUsers\(1\)/)
  assert.match(source, /Carregando usuários/)
  assert.match(source, /Nenhum usuário encontrado/)
  assert.match(source, /Tentar novamente/)
  assert.match(source, /Página \{page\} de \{totalPages\}/)
  assert.match(source, /directoryRequest\.current/)
  assert.match(source, /userType !== "admin"/)
  assert.doesNotMatch(source, /saveUser|updateUser|deleteUser|openEdit/)
})

test('password is cleared, registration reloads the real list and legacy local users are not restored', () => {
  assert.match(source, /setForm\(EMPTY_FORM\)/)
  assert.match(source, /password: ""/)
  assert.match(source, /submissionPending\.current/)
  assert.match(source, /disabled=\{submitting\}/)
  assert.match(source, /await loadUsers\(1\)/)
  assert.match(source, /createdEmployee\?\.ownerId === userId/)
  assert.match(source, /Edição, desativação, redefinição de senha e exclusão ainda não estão disponíveis/i)
  assert.doesNotMatch(contextSource, /setUsers\(initialUsers\)/)
})
