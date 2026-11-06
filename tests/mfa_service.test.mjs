import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = (await readFile(new URL('../src/services/mfa.js', import.meta.url), 'utf8'))
  .replace('import { supabase } from "../lib/supabase.js"', 'const supabase = {}')
const { createMfaService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const admin = { id: 'A', role: 'admin', status: 'active' }
function fixture() {
  const calls = []
  let level = 'aal1'
  const factors = [{ id: 'F1', factor_type: 'totp', status: 'verified' }]
  const client = { auth: {
    getUser: async () => ({ data: { user: { id: 'A' } } }),
    getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'test-session' } } }),
    signOut: async () => { calls.push('signout') },
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: level } }),
      listFactors: async () => ({ data: { all: factors } }),
      challengeAndVerify: async args => {
        calls.push(args)
        level = 'aal2'
        return { data: { access_token: 'test-session', user: { id: 'A' } } }
      },
    },
  } }
  return { client, factors, calls, service: createMfaService(client) }
}

test('MFA service uses only a verified TOTP factor and official challengeAndVerify', async () => {
  const { service, factors, calls } = fixture()
  factors.unshift({ id: 'not-ready', factor_type: 'totp', status: 'unverified' })
  assert.deepEqual(await service.requirement(admin), { required: true, level: 'aal1', factorId: 'F1' })
  assert.equal(await service.verify(admin, '123456'), 'test-session')
  assert.deepEqual(calls, [{ factorId: 'F1', code: '123456' }])
  assert.deepEqual(await service.requirement(admin), { required: false, level: 'aal2' })
})

test('SDK failures, expired sessions and malformed responses never report MFA completion or raw errors', async () => {
  for (const method of ['getAuthenticatorAssuranceLevel', 'listFactors', 'challengeAndVerify']) {
    for (const failure of [async () => ({ error: { message: 'private-token', code: 'otp_expired' } }), async () => { throw Error('private-token') }, async () => ({ data: {} })]) {
      const { client, service } = fixture()
      client.auth.mfa[method] = failure
      await assert.rejects(service.verify(admin, '123456'), error => !error.message.includes('private-token'))
    }
  }
  const { client, service } = fixture()
  client.auth.getUser = async () => ({ error: { message: 'session expired' } })
  await assert.rejects(service.requirement(admin), /Não foi possível/)
})

test('removed, missing and unsupported factors cannot be used to verify', async () => {
  for (const replacement of [[], [{ id: 'F1', status: 'unverified', factor_type: 'totp' }], [{ id: 'F2', status: 'verified', factor_type: 'phone' }]]) {
    const { service, factors, calls } = fixture()
    factors.splice(0, factors.length, ...replacement)
    await assert.rejects(service.verify(admin, '123456'), /Não foi possível/)
    assert.equal(calls.length, 0)
  }
})

test('invalid code format never invokes Supabase and a wrong identity cannot verify', async () => {
  const { client, service, calls } = fixture()
  for (const code of ['', '12345', 'abcdef', '1234567', null]) await assert.rejects(service.verify(admin, code), /6 dígitos/)
  assert.equal(calls.length, 0)
  client.auth.getUser = async () => ({ data: { user: { id: 'B' } } })
  await assert.rejects(service.verify(admin, '123456'), /Não foi possível/)
  assert.equal(calls.length, 0)
})

test('stale verification cleanup never signs out a newer session', async () => {
  const { service, calls, client } = fixture()
  await service.discardStaleSession('A', 'old-session')
  assert.equal(calls.length, 0)
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'B' }, access_token: 'test-session' } } })
  await service.discardStaleSession('A', 'test-session')
  assert.equal(calls.length, 0)
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'test-session' } } })
  await service.discardStaleSession('A', 'test-session')
  assert.deepEqual(calls, ['signout'])
})
