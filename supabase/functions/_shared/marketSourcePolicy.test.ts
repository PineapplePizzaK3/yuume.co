import { describe, expect, it } from 'vitest'
import {
  decidePermission,
  evaluateSourcePermission,
  resolveSourceIdByHost,
  type MarketSourceRow,
} from './marketSourcePolicy.ts'

function row(overrides: Partial<MarketSourceRow> = {}): MarketSourceRow {
  return {
    id: 'x',
    enabled: true,
    review_status: 'in_review',
    can_search_automated: false,
    can_display_price: false,
    can_display_images: false,
    max_cache_hours: 0,
    can_link: true,
    can_purchase_sourcing: true,
    can_automate_snapshots: false,
    legacy_search_allowed: false,
    legacy_automation_allowed: false,
    hosts: [],
    ...overrides,
  }
}

const legacyScraped = row({ id: 'mercari', legacy_search_allowed: true, hosts: ['jp.mercari.com'] })
const snkrdunk = row({
  id: 'snkrdunk',
  review_status: 'rejected',
  legacy_search_allowed: true,
  legacy_automation_allowed: true,
  hosts: ['snkrdunk.com'],
})
const apiInReview = row({
  id: 'yahoo_shopping',
  can_search_automated: true,
  can_display_price: true,
  max_cache_hours: 24,
  can_automate_snapshots: true,
})
const ownStock = row({
  id: 'own_stock',
  review_status: 'cleared',
  can_search_automated: true,
  can_display_price: true,
  can_display_images: true,
  max_cache_hours: 24,
  can_automate_snapshots: true,
})

describe('evaluateSourcePermission', () => {
  it('keeps legacy scraping working through the legacy flag', () => {
    expect(evaluateSourcePermission(legacyScraped, 'search', 'legacy_public')).toBe(true)
    expect(evaluateSourcePermission(legacyScraped, 'display_images', 'legacy_admin')).toBe(true)
  })

  it('never lets legacy flags leak into collector or snapshot contexts', () => {
    expect(evaluateSourcePermission(legacyScraped, 'search', 'collector')).toBe(false)
    expect(evaluateSourcePermission(snkrdunk, 'search', 'collector')).toBe(false)
    expect(evaluateSourcePermission(snkrdunk, 'snapshot', 'snapshot_job')).toBe(false)
    expect(evaluateSourcePermission(legacyScraped, 'snapshot', 'legacy_public')).toBe(false)
  })

  it('requires cleared review for collector use even when capabilities are set', () => {
    expect(evaluateSourcePermission(apiInReview, 'search', 'collector')).toBe(false)
    expect(evaluateSourcePermission({ ...apiInReview, review_status: 'cleared' }, 'search', 'collector')).toBe(true)
  })

  it('allows own stock snapshots and blocks everything when disabled', () => {
    expect(evaluateSourcePermission(ownStock, 'snapshot', 'snapshot_job')).toBe(true)
    expect(evaluateSourcePermission({ ...ownStock, enabled: false }, 'search', 'collector')).toBe(false)
    expect(evaluateSourcePermission({ ...legacyScraped, enabled: false }, 'search', 'legacy_public')).toBe(false)
  })

  it('treats links and staff sourcing independently of automation review', () => {
    expect(evaluateSourcePermission(snkrdunk, 'link', 'collector')).toBe(true)
    expect(evaluateSourcePermission(snkrdunk, 'purchase_sourcing', 'collector')).toBe(true)
  })

  it('lets the database kill switch stop grandfathered automation', () => {
    expect(evaluateSourcePermission(snkrdunk, 'automation', 'legacy_admin')).toBe(true)
    expect(
      evaluateSourcePermission({ ...snkrdunk, legacy_automation_allowed: false }, 'automation', 'legacy_admin'),
    ).toBe(false)
  })
})

describe('decidePermission fallback', () => {
  it('keeps legacy behavior and fails closed for collector when the registry is unavailable', () => {
    expect(decidePermission(null, 'mercari', 'search', 'legacy_public')).toBe(true)
    expect(decidePermission(null, 'own_stock', 'search', 'collector')).toBe(false)
    expect(decidePermission(null, 'own_stock', 'snapshot', 'snapshot_job')).toBe(false)
  })

  it('treats unknown sources like an unavailable registry', () => {
    const registry = new Map([[ownStock.id, ownStock]])
    expect(decidePermission(registry, 'unknown_shop', 'search', 'legacy_public')).toBe(true)
    expect(decidePermission(registry, 'unknown_shop', 'search', 'collector')).toBe(false)
  })
})

describe('resolveSourceIdByHost', () => {
  const registry = new Map([
    [legacyScraped.id, legacyScraped],
    [snkrdunk.id, snkrdunk],
  ])

  it('matches exact hosts, www prefixes and subdomains', () => {
    expect(resolveSourceIdByHost(registry, 'jp.mercari.com')).toBe('mercari')
    expect(resolveSourceIdByHost(registry, 'www.snkrdunk.com')).toBe('snkrdunk')
    expect(resolveSourceIdByHost(registry, 'img.snkrdunk.com')).toBe('snkrdunk')
  })

  it('does not match look-alike hosts', () => {
    expect(resolveSourceIdByHost(registry, 'notsnkrdunk.com')).toBe(null)
    expect(resolveSourceIdByHost(null, 'jp.mercari.com')).toBe(null)
  })
})
