import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/components/settings/UsersManagement.js', import.meta.url), 'utf8')
const contextSource = await readFile(new URL('../src/context/AppContext.js', import.meta.url), 'utf8')

test('user management creates accounts through the authorized API with an explicit role and no default password', () => {
  assert.match(source, /createAdminUser\(\{ name, email, password: form\.password, role: form\.role \}\)/)
  assert.match(source, /Novo Usuário/)
  assert.match(source, /type="password"/)
  assert.match(source, /autoComplete="new-password"/)
  assert.doesNotMatch(source, /saveUser|updateUser|deleteUser|openEdit/)
  assert.match(source, /value="employee"/)
  assert.match(source, /value="admin"/)
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

test('status changes require confirmation, are employee-only, and refresh the real directory', () => {
  assert.match(source, /updateEmployeeStatus/)
  assert.match(source, /window\.confirm\(confirmation\)/)
  assert.match(source, /perder\\u00e1 acesso ao sistema/)
  assert.match(source, /user\.role === "employee"/)
  assert.match(source, /user\.status === "active" \? "Desativar" : "Reativar"/)
  assert.match(source, /statusPending\.current/)
  assert.match(source, /statusRequest\.current/)
  assert.match(source, /await loadUsers\(page\)/)
  assert.match(source, /statusMessage\?\.ownerId === userId/)
  assert.match(source, /statusError\?\.ownerId === userId/)
  assert.doesNotMatch(source, /setUsers\(\s*current/)
})

test('permanent deletion is restricted to inactive employees and requires typed confirmation', () => {
  assert.match(source, /deleteEmployee/)
  assert.match(source, /user\.role === "employee"/)
  assert.match(source, /user\.status === "inactive"/)
  assert.match(source, /Excluir permanentemente/)
  assert.match(source, /Digite <strong>EXCLUIR<\/strong> para confirmar/)
  assert.match(source, /deleteConfirmation !== "EXCLUIR"/)
  assert.match(source, /deletePending\.current/)
  assert.match(source, /deleteRequest\.current/)
  assert.match(source, /await loadUsers\(requestedPage\)/)
  assert.match(source, /\[502, 503\]\.includes\(requestError\?\.status\)/)
  assert.match(source, /resultado da exclusão pode ser incerto/)
  assert.match(source, /page > 1 && users\.length === 1 \? page - 1 : page/)
  assert.doesNotMatch(source, /setUsers\(\s*current/)
})

test('password is cleared, registration reloads the real list and legacy local users are not restored', () => {
  assert.match(source, /setForm\(EMPTY_FORM\)/)
  assert.match(source, /password: ""/)
  assert.match(source, /submissionPending\.current/)
  assert.match(source, /disabled=\{submitting\}/)
  assert.match(source, /await loadUsers\(1\)/)
  assert.match(source, /createdEmployee\?\.ownerId === userId/)
  assert.match(source, /Edição e redefinição de senha ainda não estão disponíveis/i)
  assert.doesNotMatch(contextSource, /setUsers\(initialUsers\)/)
})
