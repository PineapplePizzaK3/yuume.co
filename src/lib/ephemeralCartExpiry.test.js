import { describe, expect, it } from 'vitest'
import {
  dropExpiredEphemeralCartItems,
  isEphemeralListingExpired,
  nextEphemeralExpiryDelayMs,
  partitionEphemeralCartRows,
} from './ephemeralCartExpiry.js'

const now = Date.parse('2026-09-29T12:00:00.000Z')

describe('ephemeral cart expiry', () => {
  it('treats a listing as expired at the exact expires_at instant', () => {
    expect(isEphemeralListingExpired('2026-09-29T12:00:00.000Z', now)).toBe(true)
    expect(isEphemeralListingExpired('2026-09-29T12:00:01.000Z', now)).toBe(false)
    expect(isEphemeralListingExpired(null, now)).toBe(false)
  })

  it('splits raw cart rows into live and expired', () => {
    const { live, expired } = partitionEphemeralCartRows([
      { ephemeral_token: 'a', expires_at: '2026-09-29T11:00:00.000Z' },
      { ephemeral_token: 'b', expires_at: '2026-09-29T13:00:00.000Z' },
    ], now)
    expect(expired.map((row) => row.ephemeral_token)).toEqual(['a'])
    expect(live.map((row) => row.ephemeral_token)).toEqual(['b'])
  })

  it('drops expired temporary lines and keeps catalog lines', () => {
    const { live, removedCount } = dropExpiredEphemeralCartItems([
      { line_type: 'catalog', products: { name: 'Vitrine' } },
      { line_type: 'ephemeral', products: { expires_at: '2026-09-29T11:00:00.000Z' } },
      { line_type: 'ephemeral', products: { expires_at: '2026-09-29T15:00:00.000Z' } },
    ], now)
    expect(removedCount).toBe(1)
    expect(live).toHaveLength(2)
  })

  it('returns the delay until the soonest temporary listing expires', () => {
    const delay = nextEphemeralExpiryDelayMs([
      { products: { expires_at: '2026-09-29T12:05:00.000Z' } },
      { products: { expires_at: '2026-09-29T12:02:00.000Z' } },
      { products: { expires_at: '2026-09-29T11:00:00.000Z' } },
    ], now)
    expect(delay).toBe(2 * 60 * 1000)
    expect(nextEphemeralExpiryDelayMs([{ products: { name: 'plain' } }], now)).toBe(null)
  })
})
