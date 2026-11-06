import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { GoTrueClient } from '@supabase/auth-js'

const svgNamespace = 'http://www.w3.org/2000/svg'
const plainSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" /></svg>'
// Node has no browser DOMParser. Model its document results explicitly; never
// make every input succeed. Parsing itself is delegated to the browser in use.
const xmlDocuments = new Map([[plainSvg, { root: 'svg', namespace: svgNamespace }]])
globalThis.DOMParser = class {
  parseFromString(text, mime) {
    assert.equal(mime, 'image/svg+xml')
    assert.ok(xmlDocuments.has(text), 'XML document fixture must be registered')
    const { root, namespace, malformed = false } = xmlDocuments.get(text)
    return {
      documentElement: { localName: root, namespaceURI: namespace },
      getElementsByTagName: name => {
        assert.equal(name, 'parsererror')
        return malformed ? [{}] : []
      },
    }
  }
}

const source = (await readFile(new URL('../src/services/mfa.js', import.meta.url), 'utf8'))
  .replace('import { supabase } from "../lib/supabase.js"', 'const supabase = {}')
const { createMfaManagement } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const admin = { id: 'A', role: 'admin', status: 'active' }
function fixture(svg = plainSvg) {
  const state = { id: 'A', role: 'admin', status: 'active', level: 'aal1', factors: [] }
  const calls = []
  let sequence = 0
  const client = {
    from: table => {
      assert.equal(table, 'profiles')
      return { select: fields => {
        assert.equal(fields, 'role, status')
        return { eq: (field, id) => {
          assert.equal(field, 'id'); assert.equal(id, admin.id)
          return { single: async () => ({ data: { role: state.role, status: state.status } }) }
        } }
      } }
    },
    auth: {
      getUser: async () => ({ data: { user: { id: state.id } } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.level } }),
        listFactors: async () => ({ data: { all: state.factors.map(factor => ({ ...factor })) } }),
        enroll: async params => {
          calls.push({ method: 'enroll', params })
          const id = `new-factor-${++sequence}`
          state.factors.push({ id, factor_type: 'totp', status: 'unverified' })
          return { data: { id, type: 'totp', totp: {
            qr_code: 'data:image/svg+xml;utf-8,' + svg,
            secret: 'test-manual-secret', uri: 'otpauth://totp/test?secret=test-manual-secret',
          } } }
        },
        challengeAndVerify: async ({ factorId, code }) => {
          calls.push({ method: 'verify', factorId })
          if (code !== '123456') return { error: { message: 'private-provider-token' } }
          const factor = state.factors.find(item => item.id === factorId)
          if (!factor) return { error: { message: 'private-missing-factor' } }
          factor.status = 'verified'
          state.level = 'aal2'
          return { data: { user: { id: state.id } } }
        },
        unenroll: async ({ factorId }) => {
          calls.push({ method: 'unenroll', factorId })
          const factor = state.factors.find(item => item.id === factorId)
          if (factor?.status === 'verified' && state.level !== 'aal2') return { error: { message: 'private-aal-error' } }
          state.factors = state.factors.filter(item => item.id !== factorId)
          return { data: { id: factorId } }
        },
      },
    },
  }
  return { state, client, calls, service: createMfaManagement(client) }
}

test('management checks the real active admin profile and identity before every mutation', async () => {
  for (const patch of [{ role: 'employee' }, { status: 'inactive' }, { id: 'B' }]) {
    const { service, state, calls } = fixture()
    Object.assign(state, patch)
    await assert.rejects(service.enroll(admin))
    await assert.rejects(service.removeVerified(admin, 'F1'))
    assert.equal(calls.length, 0)
  }
  const { service, calls } = fixture()
  await assert.rejects(service.enroll({ ...admin, role: 'employee' }), /administrador ativo/)
  assert.equal(calls.length, 0)
})

test('enrollment returns an encoded SVG and official manual key, deduplicating simultaneous clicks', async () => {
  const { service, calls } = fixture()
  const first = service.enroll(admin)
  const repeated = service.enroll(admin)
  assert.equal(first, repeated)
  const setup = await first
  assert.equal(setup.secret, 'test-manual-secret')
  assert.match(setup.qrCode, /^data:image\/svg\+xml;utf-8,%3Csvg/)
  assert.match(decodeURIComponent(setup.qrCode), /fill="#000"/)
  assert.equal(calls.filter(call => call.method === 'enroll').length, 1)
  assert.deepEqual(calls[0].params, { factorType: 'totp' })
  await assert.rejects(service.enroll(admin), /configuração incompleta/)
  assert.equal(calls.filter(call => call.method === 'enroll').length, 1)
})

test('the real SDK enroll transport accepts SVG with XML declarations and a complete prolog without compensation', async t => {
  const documents = [
    ['direct SVG', plainSvg],
    ['XML declaration', '<?xml version="1.0" encoding="UTF-8"?>\n' + plainSvg],
    ['XML prolog', '<?xml version="1.0"?>\n<!-- QR -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + plainSvg],
  ]
  for (const [name, svg] of documents) await t.test(name, async () => {
    xmlDocuments.set(svg, { root: 'svg', namespace: svgNamespace })
    const { client, service, state, calls } = fixture()
    const requests = []
    const context = {
      url: 'https://example.invalid/auth/v1', headers: {},
      _useSession: async callback => callback({ data: { session: { access_token: 'test-only' } }, error: null }),
      _returnResult: result => result,
      fetch: async (url, options) => {
        assert.equal(url, 'https://example.invalid/auth/v1/factors')
        requests.push(options.method)
        assert.equal(options.method, 'POST')
        assert.equal(JSON.parse(options.body).factor_type, 'totp')
        state.factors.push({ id: 'sdk-factor', factor_type: 'totp', status: 'unverified' })
        return new Response(JSON.stringify({ id: 'sdk-factor', type: 'totp', totp: {
          qr_code: svg, secret: 'test-manual-secret', uri: 'otpauth://totp/test?secret=test-manual-secret',
        } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    }
    // Exercise the installed SDK's actual response processing and URL prefix.
    // All HTTP goes through the in-memory transport above, never the network.
    client.auth.mfa.enroll = params => GoTrueClient.prototype._enroll.call(context, params)
    const setup = await service.enroll(admin)
    assert.equal(setup.factorId, 'sdk-factor')
    assert.equal(decodeURIComponent(setup.qrCode), 'data:image/svg+xml;utf-8,' + svg)
    assert.deepEqual(requests, ['POST'])
    assert.equal(calls.filter(call => call.method === 'unenroll').length, 0)
    assert.equal(state.factors[0].status, 'unverified')
  })
})

test('non-SVG roots, wrong namespaces and XML parse failures remain rejected and compensated', async t => {
  const documents = [
    ['text', 'not an SVG document', { root: 'parsererror', malformed: true }],
    ['another root', '<html><svg xmlns="http://www.w3.org/2000/svg" /></html>', { root: 'html' }],
    ['wrong namespace', '<svg xmlns="https://example.invalid/not-svg" />', { root: 'svg', namespace: 'https://example.invalid/not-svg' }],
    ['malformed XML', '<svg xmlns="http://www.w3.org/2000/svg"><path></svg>', { root: 'parsererror', malformed: true }],
    ['multiple roots', plainSvg + plainSvg, { root: 'parsererror', malformed: true }],
  ]
  for (const [name, svg, document] of documents) await t.test(name, async () => {
    xmlDocuments.set(svg, document)
    const { service, state, calls } = fixture(svg)
    await assert.rejects(service.enroll(admin))
    assert.deepEqual(calls.filter(call => call.method === 'unenroll'), [{ method: 'unenroll', factorId: 'new-factor-1' }])
    assert.equal(state.factors.length, 0)
  })
})

test('a real post-enrollment validation failure compensates only its own still-unverified factor', async () => {
  const svg = '<invalid />'
  xmlDocuments.set(svg, { root: 'invalid' })
  for (const becameVerified of [false, true]) {
    const { service, state, client, calls } = fixture(svg)
    const enroll = client.auth.mfa.enroll
    client.auth.mfa.enroll = async params => {
      const result = await enroll(params)
      if (becameVerified) state.factors[0].status = 'verified'
      state.factors.push({ id: 'unrelated', factor_type: 'totp', status: 'verified' })
      return result
    }
    await assert.rejects(service.enroll(admin))
    assert.deepEqual(calls.filter(call => call.method === 'unenroll'), becameVerified
      ? [] : [{ method: 'unenroll', factorId: 'new-factor-1' }])
    assert.ok(state.factors.some(factor => factor.id === 'unrelated'))
    assert.equal(state.factors.some(factor => factor.id === 'new-factor-1'), becameVerified)
  }
})

test('unverified factors are not enabled; only official verification plus aal2 confirms enrollment', async () => {
  const { service } = fixture()
  const setup = await service.enroll(admin)
  assert.equal((await service.read(admin)).verified.length, 0)
  await assert.rejects(service.confirmEnrollment(admin, setup.factorId, '000000'), error => !error.message.includes('private-provider-token'))
  assert.equal((await service.read(admin)).verified.length, 0)
  const enabled = await service.confirmEnrollment(admin, setup.factorId, '123456')
  assert.equal(enabled.level, 'aal2')
  assert.equal(enabled.verified[0].id, setup.factorId)
  await assert.rejects(service.enroll(admin), /já está ativo/)
})

test('a successful-looking SDK response without aal2 or verified factor never enables 2FA', async () => {
  const { service, client } = fixture()
  const setup = await service.enroll(admin)
  client.auth.mfa.challengeAndVerify = async () => ({ data: { user: { id: 'A' } } })
  await assert.rejects(service.confirmEnrollment(admin, setup.factorId, '123456'))
  assert.equal((await service.read(admin)).verified.length, 0)
})

test('cancel removes only the unverified factor owned by this attempt and preserves others', async () => {
  const { service, state, calls } = fixture()
  const setup = await service.enroll(admin)
  state.factors.push({ id: 'unrelated', factor_type: 'totp', status: 'unverified' })
  await assert.rejects(service.cancelEnrollment(admin, 'unrelated'))
  await service.cancelEnrollment(admin, setup.factorId)
  assert.deepEqual(state.factors.map(factor => factor.id), ['unrelated'])
  assert.deepEqual(calls.filter(call => call.method === 'unenroll').map(call => call.factorId), [setup.factorId])
})

test('cancel never removes an enrollment that became verified', async () => {
  const { service, state, calls } = fixture()
  const setup = await service.enroll(admin)
  state.factors[0].status = 'verified'
  state.level = 'aal2'
  await assert.rejects(service.cancelEnrollment(admin, setup.factorId))
  assert.equal(calls.filter(call => call.method === 'unenroll').length, 0)
})

test('old incomplete enrollment blocks a new one until explicit safe discard', async () => {
  const { service, state, calls } = fixture()
  state.factors.push({ id: 'old', status: 'unverified', factor_type: 'totp' })
  await assert.rejects(service.enroll(admin), /configuração incompleta/)
  assert.equal(calls.length, 0)
  await service.discardPending(admin, 'old')
  await service.enroll(admin)
  assert.equal(calls.filter(call => call.method === 'enroll').length, 1)
})

test('verified removal refuses aal1; a current official challenge upgrades before unenroll', async () => {
  const { service, state, calls } = fixture()
  state.factors.push({ id: 'F1', status: 'verified', factor_type: 'totp' })
  await assert.rejects(service.removeVerified(admin, 'F1'), /Confirme um código/)
  assert.equal(calls.length, 0)
  await assert.rejects(service.verifyRemoval(admin, 'F1', '000000'))
  assert.equal(calls.filter(call => call.method === 'unenroll').length, 0)
  await service.verifyRemoval(admin, 'F1', '123456')
  const disabled = await service.removeVerified(admin, 'F1')
  assert.equal(disabled.verified.length, 0)
  assert.deepEqual(calls.filter(call => call.method === 'unenroll'), [{ method: 'unenroll', factorId: 'F1' }])
})

test('removing one factor preserves other verified factors and reports 2FA still active', async () => {
  const { service, state } = fixture()
  state.level = 'aal2'
  state.factors.push({ id: 'F1', status: 'verified', factor_type: 'totp' }, { id: 'F2', status: 'verified', factor_type: 'totp' }, { id: 'P1', status: 'verified', factor_type: 'phone' })
  const snapshot = await service.removeVerified(admin, 'F1')
  assert.deepEqual(snapshot.verified.map(factor => factor.id), ['F2', 'P1'])
  await assert.rejects(service.removeVerified(admin, 'P1'))
})

test('removal is confirmed from Auth, not assumed from the unenroll response', async () => {
  const { service, state, client } = fixture()
  state.level = 'aal2'
  state.factors.push({ id: 'F1', status: 'verified', factor_type: 'totp' })
  client.auth.mfa.unenroll = async () => ({ data: { id: 'F1' } })
  await assert.rejects(service.removeVerified(admin, 'F1'))
})

test('SDK errors are sanitized and malformed QR enrollment is compensated only if safe', async () => {
  const { service, client, state, calls } = fixture()
  client.auth.mfa.enroll = async () => {
    state.factors.push({ id: 'malformed', status: 'unverified', factor_type: 'totp' })
    return { data: { id: 'malformed', type: 'totp', totp: { qr_code: 'https://untrusted.example.test/qr', secret: 'private-secret' } } }
  }
  await assert.rejects(service.enroll(admin), error => !error.message.includes('private-secret'))
  assert.deepEqual(calls, [{ method: 'unenroll', factorId: 'malformed' }])
  assert.equal(state.factors.length, 0)
  client.auth.mfa.listFactors = async () => { throw Error('private-token private-email') }
  await assert.rejects(service.read(admin), error => !error.message.includes('private'))
})

test('change notifications contain only identity and never QR, secret or TOTP code', async () => {
  const { service } = fixture()
  const changes = []
  const unsubscribe = service.subscribe(value => changes.push(value))
  const setup = await service.enroll(admin)
  await service.confirmEnrollment(admin, setup.factorId, '123456')
  await service.removeVerified(admin, setup.factorId)
  assert.deepEqual(changes, ['A', 'A'])
  unsubscribe()
})
