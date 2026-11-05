import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import vm from 'node:vm'

const text = await readFile(new URL('../src/utils/passwordRecovery.js', import.meta.url), 'utf8')
const { createPasswordRecovery, readRecoveryCallback, shouldDetectApplicationSession, RECOVERY_MESSAGE } = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const recovery = { kind: 'token_hash', tokenHash: 'a'.repeat(64) }
const fixture = () => {
  const calls = []
  const diagnostics = []
  const profile = { id: 'test-id', role: 'employee', status: 'active' }
  const readProfile = async () => ({ data: profile })
  const client = { auth: {
    resetPasswordForEmail: async (...args) => { calls.push(['request', ...args]); return {} },
    verifyOtp: async args => { calls.push(['verify', args]); return { data: { user: { id: 'test-id' }, session: {} } } },
    getClaims: async () => ({ data: { claims: { sub: 'test-id' } } }),
    setSession: async args => { calls.push(['session', args]); return { data: { user: { id: 'test-id' }, session: {} } } },
    getUser: async () => ({ data: { user: { id: 'test-id' } } }),
    updateUser: async args => { calls.push(['update', args]); return { data: { user: { id: 'test-id' } } } },
    signOut: async args => { calls.push(['signout', args]); return {} },
  }, schema: schema => { assert.equal(schema, 'public'); return { from: table => {
    assert.equal(table, 'profiles')
    return { select: fields => {
      assert.equal(fields, 'id, role, status')
      return { eq: (key, id) => {
        assert.equal(key, 'id'); assert.equal(id, 'test-id')
        return { maybeSingle: readProfile }
      } }
    } }
  } } } }
  return { calls, client, profile, diagnostics, flow: createPasswordRecovery(client, category => diagnostics.push(category)) }
}

test('recovery request uses Supabase email flow and same response for known, unknown and provider errors', async () => {
  const { flow, calls, client, diagnostics } = fixture()
  assert.equal(await flow.request(' user@example.test ', 'https://example.test'), RECOVERY_MESSAGE)
  assert.deepEqual(calls[0], ['request', 'user@example.test', { redirectTo: 'https://example.test/reset-password' }])
  client.auth.resetPasswordForEmail = async () => ({ error: { message: 'unknown email' } })
  assert.equal(await flow.request('user@example.test', 'https://example.test'), RECOVERY_MESSAGE)
  assert.deepEqual(diagnostics, ['request_failed'])
  client.auth.resetPasswordForEmail = async () => { throw Error('internal error') }
  assert.equal(await flow.request('user@example.test', 'https://example.test'), RECOVERY_MESSAGE)
  assert.deepEqual(diagnostics, ['request_failed', 'request_failed'])
  await assert.rejects(flow.request('bad email', 'https://example.test'), /válido/)
})

test('SDK errors produce only fixed safe diagnostic categories and the same public message', async () => {
  const { flow, client, diagnostics } = fixture()
  for (const [status, category] of [[429, 'rate_limited'], [500, 'provider_unavailable'], [503, 'provider_unavailable'], [400, 'request_failed']]) {
    client.auth.resetPasswordForEmail = async () => ({ error: {
      status, code: 'account-does-not-exist', message: 'private-address@example.test private-token private-url',
    } })
    assert.equal(await flow.request('user@example.test', 'https://example.test'), RECOVERY_MESSAGE)
    assert.equal(diagnostics.at(-1), category)
  }
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|@|account-does-not-exist/)
})

test('email requests reuse the primary client without constructing Auth clients; callbacks own distinct memory clients', async () => {
  const require = createRequire(import.meta.url)
  const babel = require('next/dist/compiled/babel/core')
  const source = await readFile(new URL('../src/services/passwordRecovery.js', import.meta.url), 'utf8')
  const code = babel.transformSync(source, { babelrc: false, configFile: false,
    plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
  }).code
  const calls = []
  const constructed = []
  const primary = { auth: {
    resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null } },
  } }
  const loaded = { exports: {} }
  const localRequire = name => {
    if (name === '@supabase/supabase-js') return { createClient: (url, key, options) => {
      const client = fixture().client
      constructed.push({ options, client })
      return client
    } }
    if (name === '../lib/supabase.js') return { supabase: primary }
    if (name === '../utils/passwordRecovery.js') return { createPasswordRecovery }
    throw new Error('Unexpected module')
  }
  const context = vm.createContext({ crypto: { randomUUID }, process: { env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  } } })
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, loaded, loaded.exports)
  for (let index = 0; index < 2; index++) {
    assert.equal(await loaded.exports.requestPasswordRecovery('user@example.test', 'https://example.test'), RECOVERY_MESSAGE)
  }
  assert.equal(constructed.length, 0)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], ['user@example.test', { redirectTo: 'https://example.test/reset-password' }])
  const first = loaded.exports.newPasswordRecovery()
  const second = loaded.exports.newPasswordRecovery()
  assert.equal(constructed.length, 2)
  assert.notEqual(constructed[0].options.auth.storageKey, constructed[1].options.auth.storageKey)
  for (const { options } of constructed) {
    assert.equal(options.auth.persistSession, false)
    assert.equal(options.auth.autoRefreshToken, false)
    assert.equal(options.auth.detectSessionInUrl, false)
    assert.match(options.auth.storageKey, /^modus-password-recovery-/)
  }
  await first.verifyCallback(recovery)
  await first.dispose()
  await second.verifyCallback(recovery)
  await second.update('valid-test-password', 'valid-test-password')
  // The primary client implements only the email method: callback/session calls
  // against it would fail the test, rather than silently replacing its session.
  assert.equal(calls.length, 2)
  const page = await readFile(new URL('../src/app/forgotPass/page.js', import.meta.url), 'utf8')
  assert.match(page, /requestPasswordRecovery\(email, window.location.origin\)/)
  assert.doesNotMatch(page, /newPasswordRecovery\(/)
})

test('an existing application session or URL type alone never authorizes password reset', async () => {
  const { flow, calls } = fixture()
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
  await assert.rejects(flow.verifyCallback(null), /inválido/)
  assert.throws(() => readRecoveryCallback('?type=recovery', ''), /inválido/)
  assert.throws(() => readRecoveryCallback('?token_hash=' + recovery.tokenHash + '&type=email', ''), /inválido/)
  assert.equal(calls.filter(c => c[0] === 'update' || c[0] === 'verify').length, 0)
})

test('expired or rejected recovery code never enables a password update', async () => {
  const { flow, client, calls } = fixture()
  client.auth.verifyOtp = async () => ({ error: { message: 'raw expiry error' } })
  await assert.rejects(flow.verifyCallback(recovery), error => !error.message.includes('raw expiry'))
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
  assert.equal(calls.filter(c => c[0] === 'update').length, 0)
})

test('verified recovery validates confirmation, updates once, and disposes the temporary session', async () => {
  const { flow, calls } = fixture()
  await flow.verifyCallback(recovery)
  await assert.rejects(flow.update('short', 'short'), /8 a 128/)
  await assert.rejects(flow.update('valid-test-password', 'different'), /coincidem/)
  await flow.update('valid-test-password', 'valid-test-password')
  assert.deepEqual(calls.at(-2), ['update', { password: 'valid-test-password' }])
  assert.deepEqual(calls.at(-1), ['signout', { scope: 'local' }])
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
  assert.equal(calls.filter(c => c[0] === 'update').length, 1)
})

test('identity change and update failure cannot report password success', async () => {
  const { flow, calls, client } = fixture()
  await flow.verifyCallback(recovery)
  client.auth.getUser = async () => ({ data: { user: { id: 'another-user' } } })
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /Não foi possível/)
  assert.equal(calls.filter(c => c[0] === 'update').length, 0)
})

test('simultaneous password submissions do not duplicate updates', async () => {
  const { flow, client } = fixture()
  let release
  let count = 0
  client.auth.updateUser = async () => { count++; return new Promise(resolve => { release = resolve }) }
  await flow.verifyCallback(recovery)
  const pending = flow.update('valid-test-password', 'valid-test-password')
  while (!release) await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /andamento/)
  release({ data: { user: { id: 'test-id' } } })
  await pending
  assert.equal(count, 1)
})

test('recovery client is isolated in memory and local plaintext credential flows are removed', async () => {
  const service = await readFile(new URL('../src/services/passwordRecovery.js', import.meta.url), 'utf8')
  assert.match(service, /persistSession: false/)
  assert.match(service, /detectSessionInUrl: false/)
  assert.match(service, /flowType: "implicit"/)
  const primary = await readFile(new URL('../src/lib/supabase.js', import.meta.url), 'utf8')
  assert.match(primary, /detectSessionInUrl: shouldDetectApplicationSession/)
  const context = await readFile(new URL('../src/context/AppContext.js', import.meta.url), 'utf8')
  assert.doesNotMatch(context, /function (register|resetPassword|saveUser|updateUser|deleteUser)\(/)
  const page = await readFile(new URL('../src/app/reset-password/page.js', import.meta.url), 'utf8')
  assert.match(page, /history\.replaceState/)
  assert.match(page, /verification\.current/)
  assert.match(page, /readRecoveryCallback\(search, hash\)/)
  assert.match(page, /queueMicrotask/)
})

test('implicit recovery validates the supplied session and own system profile before updating', async () => {
  const { flow, calls } = fixture()
  const callback = readRecoveryCallback('', '#access_token=test-access&refresh_token=test-refresh&type=recovery&token_type=bearer&expires_in=3600')
  await flow.verifyCallback(callback)
  assert.deepEqual(calls[0], ['session', { access_token: 'test-access', refresh_token: 'test-refresh' }])
  await flow.update('valid-test-password', 'valid-test-password')
  assert.equal(calls.filter(c => c[0] === 'update').length, 1)
})

test('callback parser rejects direct access, missing credentials, errors, mixed formats and unsupported PKCE', () => {
  for (const [search, hash] of [
    ['', ''], ['?type=recovery', ''], ['', '#type=recovery'],
    ['', '#access_token=test&refresh_token=test&type=signup&token_type=bearer'],
    ['', '#access_token=test&type=recovery&token_type=bearer'],
    ['?error_code=otp_expired', ''], ['', '#error=access_denied&error_description=private-provider-detail'],
    ['?code=test-code', ''], ['?token_hash=test&type=recovery', '#access_token=test'],
    ['', '#type=recovery&type=recovery&access_token=test&refresh_token=test&token_type=bearer'],
  ]) assert.throws(() => readRecoveryCallback(search, hash), error => /inválido/.test(error.message) && !error.message.includes('private-provider-detail'))
  assert.deepEqual(readRecoveryCallback('?token_hash=' + recovery.tokenHash + '&type=recovery', ''), recovery)
})

test('primary Auth callback detection excludes recovery without changing other authentication callbacks', () => {
  for (const path of ['/reset-password', '/reset-password/']) {
    assert.equal(shouldDetectApplicationSession(new URL('https://example.test' + path), { access_token: 'test' }), false)
  }
  assert.equal(shouldDetectApplicationSession(new URL('https://example.test/login'), { access_token: 'test' }), true)
  assert.equal(shouldDetectApplicationSession(new URL('https://example.test/login'), {}), false)
})

test('Auth identities without a valid matching system profile cannot reset passwords', async () => {
  for (const change of [p => { p.id = 'another-id' }, p => { p.role = 'owner' }, p => { p.status = 'unknown' }]) {
    const { flow, profile, calls } = fixture()
    change(profile)
    await assert.rejects(flow.verifyCallback(recovery), /inválido/)
    await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
    assert.equal(calls.filter(c => c[0] === 'update').length, 0)
    assert.equal(calls.at(-1)[0], 'signout')
  }
  const { flow, client } = fixture()
  client.schema = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })
  await assert.rejects(flow.verifyCallback(recovery), /inválido/)
})

test('profile revocation after callback validation blocks the password update', async () => {
  const { flow, profile, calls } = fixture()
  await flow.verifyCallback(recovery)
  profile.role = 'invalid'
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /Não foi possível/)
  assert.equal(calls.filter(c => c[0] === 'update').length, 0)
})

test('provider rejects expired, invalid and already-used recovery credentials without exposing errors', async () => {
  for (const method of ['verifyOtp', 'getClaims', 'setSession']) {
    for (const reason of ['expired', 'invalid', 'already-used']) {
      const { flow, client, calls } = fixture()
      client.auth[method] = async () => ({ error: { message: reason + '-private-detail' } })
      await assert.rejects(flow.verifyCallback(method === 'verifyOtp' ? recovery : {
        kind: 'implicit', accessToken: 'test-access', refreshToken: 'test-refresh',
      }), error => /inválido/.test(error.message) && !error.message.includes(reason + '-private-detail'))
      await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
      assert.equal(calls.filter(c => c[0] === 'update').length, 0)
    }
  }
})

test('an expired implicit callback never reaches setSession or refreshes credentials', async () => {
  const { flow, client, calls } = fixture()
  client.auth.getClaims = async () => ({ error: { message: 'expired-private-detail' } })
  await assert.rejects(flow.verifyCallback({ kind: 'implicit', accessToken: 'expired-test', refreshToken: 'test-refresh' }), /inválido/)
  assert.equal(calls.filter(c => c[0] === 'session').length, 0)
})

test('disposal during verification cannot authorize a late password update', async () => {
  const { flow, client, calls } = fixture()
  let release
  client.auth.verifyOtp = () => new Promise(resolve => { release = resolve })
  const verification = flow.verifyCallback(recovery)
  await flow.dispose()
  release({ data: { user: { id: 'test-id' }, session: {} } })
  await assert.rejects(verification, /inválido/)
  await assert.rejects(flow.update('valid-test-password', 'valid-test-password'), /novo link/)
  assert.equal(calls.filter(c => c[0] === 'update').length, 0)
})
