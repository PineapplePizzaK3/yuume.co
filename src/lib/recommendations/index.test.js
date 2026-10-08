import { describe, expect, it } from 'vitest'
import { buildRecommendations } from './index.js'

const base = {
  catalog_item_id: 'a1',
  set_id: 's1',
  set_code: 'M2a',
  set_name_ja: 'MEGAドリームex',
  set_status: 'VERIFIED',
  number: '250',
  name_ja: 'メガカイリューex',
  match_quality: 'exact',
  checked_at: new Date().toISOString(),
  listing_count: 4,
  best_price_jpy: 2800,
  source_id: 'own_stock',
  best_url: 'https://example.test/x',
  is_owned: false,
  is_held: false,
  in_active_order: false,
}

describe('buildRecommendations', () => {
  it('puts below-target wishlist items into goodTiming and strips score', () => {
    const result = buildRecommendations(
      [
        {
          ...base,
          candidate_kind: 'wishlist',
          target_price_jpy: 3000,
        },
      ],
      {}
    )
    expect(result.goodTiming[0]?.type).toBe('opportunity')
    expect(result.goodTiming[0]?.reasons.some((r) => r.code === 'below_target')).toBe(true)
    expect(result.goodTiming[0]?._score).toBeUndefined()
  })

  it('excludes owned, held, dismissed and unverified missing', () => {
    const result = buildRecommendations(
      [
        { ...base, candidate_kind: 'missing', is_owned: true },
        { ...base, catalog_item_id: 'b', candidate_kind: 'missing', is_held: true },
        { ...base, catalog_item_id: 'c', candidate_kind: 'missing', set_status: 'VALIDATING' },
        { ...base, catalog_item_id: 'd', candidate_kind: 'wishlist' },
      ],
      { dismissed_items: ['d'] }
    )
    expect(result.foundForYou).toEqual([])
    expect(result.goodTiming).toEqual([])
    expect(result.related).toEqual([])
  })

  it('groups missing items into finishYourSet', () => {
    const result = buildRecommendations(
      [
        { ...base, candidate_kind: 'missing', best_price_jpy: null, listing_count: 0, match_quality: null },
        { ...base, catalog_item_id: 'a2', candidate_kind: 'missing', number: '249', best_price_jpy: null, listing_count: 0 },
      ],
      {}
    )
    expect(result.finishYourSet[0]?.items?.length).toBe(2)
  })
})
