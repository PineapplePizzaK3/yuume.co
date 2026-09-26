import { describe, expect, it } from 'vitest'
import { checkLegacyAutomationAllowed } from './marketSourceKillSwitch.mjs'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' }

function respond(body, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('checkLegacyAutomationAllowed', () => {
  it('stops only when the registry explicitly disables the source', async () => {
    const result = await checkLegacyAutomationAllowed('snkrdunk', {
      env,
      fetchImpl: respond([{ id: 'snkrdunk', legacy_automation_allowed: false }]),
    })
    expect(result).toEqual({ allowed: false, reason: 'disabled_in_registry' })
  })

  it('allows when the registry allows the source', async () => {
    const result = await checkLegacyAutomationAllowed('snkrdunk', {
      env,
      fetchImpl: respond([{ id: 'snkrdunk', legacy_automation_allowed: true }]),
    })
    expect(result.allowed).toBe(true)
  })

  it('fails open when unconfigured, unreachable, erroring or unregistered', async () => {
    expect((await checkLegacyAutomationAllowed('snkrdunk', { env: {} })).allowed).toBe(true)
    expect(
      (await checkLegacyAutomationAllowed('snkrdunk', {
        env,
        fetchImpl: async () => {
          throw new Error('offline')
        },
      })).allowed,
    ).toBe(true)
    expect((await checkLegacyAutomationAllowed('snkrdunk', { env, fetchImpl: respond({}, 404) })).allowed).toBe(true)
    expect((await checkLegacyAutomationAllowed('snkrdunk', { env, fetchImpl: respond([]) })).allowed).toBe(true)
  })
})
