import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const original = readFileSync(new URL('../src/components/settings/ProfileSection.js', import.meta.url), 'utf8')
const logic = original.slice(0, original.indexOf('  const primeiraLetra'))
  .replace(/import\s+[\s\S]*?\s+from\s+"[^"]+"\s*/g, '')
  .replace('export default function', 'function') +
  '\nreturn { startEditing, handleSave, cancelEditing, isEditing, saving, success, error, setName }\n}'

function harness(onSaveName) {
  const slots = []
  let cursor = 0
  const currentUser = { id: 'A', name: 'Original', email: 'a@example.test' }
  const context = vm.createContext({
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: initial }
      return [slots[index].value, next => { slots[index].value = next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: initial }
      return slots[index]
    },
  })
  vm.runInContext(logic, context)
  return { currentUser, render() {
    cursor = 0
    return context.ProfileSection({ currentUser, onSaveName })
  } }
}

test('profile form waits for API confirmation and prevents duplicate saves', async () => {
  let resolve
  let calls = 0
  const pending = new Promise(r => { resolve = r })
  const h = harness(async name => {
    calls += 1
    assert.equal(name, 'Updated')
    await pending
  })
  let form = h.render()
  form.startEditing()
  form.setName('  Updated  ')
  form = h.render()
  const saving = form.handleSave({ preventDefault() {} })
  await form.handleSave({ preventDefault() {} })
  form = h.render()
  assert.equal(calls, 1)
  assert.equal(form.saving, true)
  assert.equal(form.success, false)
  assert.equal(form.isEditing, true)
  resolve()
  await saving
  form = h.render()
  assert.equal(form.saving, false)
  assert.equal(form.success, true)
  assert.equal(form.isEditing, false)
})

test('API failure keeps the prior displayed name and never confirms success', async () => {
  const h = harness(async () => { throw Error('API unavailable') })
  h.render().startEditing()
  h.render().setName('Attempt')
  await h.render().handleSave({ preventDefault() {} })
  const form = h.render()
  assert.equal(form.error, 'API unavailable')
  assert.equal(form.success, false)
  assert.equal(form.saving, false)
  assert.equal(form.isEditing, true)
  assert.equal(h.currentUser.name, 'Original')
})

test('empty or overlong profile names never call the API', async () => {
  let calls = 0
  const h = harness(async () => { calls += 1 })
  for (const name of ['   ', 'x'.repeat(121)]) {
    h.render().setName(name)
    await h.render().handleSave({ preventDefault() {} })
    assert.ok(h.render().error)
    assert.equal(h.render().success, false)
  }
  assert.equal(calls, 0)
})
