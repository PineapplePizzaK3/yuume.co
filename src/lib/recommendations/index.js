import { FRESH_HOURS, NEWLY_AVAILABLE_DAYS, OPPORTUNITY_MEDIAN_PCT, WEIGHTS } from './weights.js'

function hoursAgo(iso, now) {
  if (!iso) return Infinity
  return (now.getTime() - new Date(iso).getTime()) / 36e5
}

export function buildSignals(row, prefs = {}, { now = new Date() } = {}) {
  const dismissed = new Set((prefs.dismissed_items || []).map((d) => (typeof d === 'string' ? d : d?.catalog_item_id)))
  const followedSets = new Set((prefs.followed_sets || []).map(String))
  const fresh = hoursAgo(row.checked_at, now) <= FRESH_HOURS
  const hasMarket = Boolean(row.best_price_jpy != null && row.listing_count > 0 && row.match_quality && row.match_quality !== 'loose')
  const belowTarget =
    row.target_price_jpy != null && row.best_price_jpy != null && Number(row.best_price_jpy) <= Number(row.target_price_jpy)
  const belowMedian =
    row.median_price_jpy != null &&
    row.best_price_jpy != null &&
    Number(row.best_price_jpy) <= Number(row.median_price_jpy) * (1 - OPPORTUNITY_MEDIAN_PCT)
  const newlyAvailable =
    row.first_available_at &&
    (now.getTime() - new Date(row.first_available_at).getTime()) / 864e5 <= NEWLY_AVAILABLE_DAYS
  const listingJump =
    row.previous_listing_count != null &&
    row.listing_count != null &&
    Number(row.listing_count) >= Number(row.previous_listing_count) * 2 &&
    Number(row.listing_count) >= 3

  return {
    catalogItemId: row.catalog_item_id,
    candidateKind: row.candidate_kind,
    dismissed: dismissed.has(String(row.catalog_item_id)),
    isOwned: Boolean(row.is_owned),
    isHeld: Boolean(row.is_held),
    inActiveOrder: Boolean(row.in_active_order),
    setVerified: row.set_status === 'VERIFIED',
    onWishlist: row.candidate_kind === 'wishlist',
    missing: row.candidate_kind === 'missing',
    followedSet: followedSets.has(String(row.set_id)),
    fresh,
    hasMarket,
    matchQuality: row.match_quality || null,
    belowTarget,
    belowMedian,
    newlyAvailable,
    listingJump,
    row,
  }
}

export function scoreSignals(signals) {
  if (signals.dismissed || signals.isOwned || signals.isHeld || signals.inActiveOrder) return null
  if (signals.missing && !signals.setVerified) return null

  let score = 0
  if (signals.onWishlist) score += WEIGHTS.onWishlist
  if (signals.missing) score += WEIGHTS.missingFromTracked
  if (signals.followedSet) score += WEIGHTS.followedSet
  if (signals.hasMarket && signals.fresh) score += WEIGHTS.availableInJapan
  if (signals.belowTarget && signals.fresh) score += WEIGHTS.belowTarget
  if (signals.belowMedian && signals.fresh) score += WEIGHTS.belowMedian
  if (signals.newlyAvailable && signals.fresh) score += WEIGHTS.newlyAvailable
  if (signals.listingJump && signals.fresh) score += WEIGHTS.listingJump
  if (!signals.fresh && signals.hasMarket) score += WEIGHTS.stalePenalty
  if (signals.matchQuality === 'loose') score += WEIGHTS.loosePenalty
  return score
}

export function buildReasons(signals) {
  const reasons = []
  const row = signals.row
  if (signals.onWishlist) reasons.push({ code: 'on_wishlist', params: {} })
  if (signals.missing) {
    reasons.push({
      code: 'missing_from_set',
      params: { setName: row.set_name_en || row.set_name_ja || row.set_code },
    })
  }
  if (signals.hasMarket && signals.fresh) {
    reasons.push({
      code: 'found_in_japan',
      params: { count: row.listing_count || 1, sources: row.source_id },
    })
  }
  if (signals.belowTarget) {
    reasons.push({ code: 'below_target', params: { targetJpy: row.target_price_jpy } })
  }
  if (signals.belowMedian) reasons.push({ code: 'below_typical', params: {} })
  if (signals.newlyAvailable) reasons.push({ code: 'new_listing', params: {} })
  if (signals.followedSet) {
    reasons.push({ code: 'followed_set', params: { setName: row.set_code } })
  }
  if (signals.fresh && row.checked_at) {
    reasons.push({ code: 'fresh_data', params: { checkedAt: row.checked_at } })
  }
  return reasons.slice(0, 3)
}

export function classifyPrimaryType(signals) {
  const opportunity =
    signals.hasMarket &&
    signals.fresh &&
    signals.matchQuality !== 'loose' &&
    (signals.belowTarget || signals.belowMedian || signals.newlyAvailable)
  if (opportunity) return 'opportunity'
  if (signals.onWishlist && signals.hasMarket && signals.fresh) return 'wishlist_found'
  if (signals.missing && signals.setVerified) return 'complete_set'
  return 'related'
}

/**
 * @returns {{ foundForYou: any[], goodTiming: any[], finishYourSet: any[], related: any[] }}
 */
export function buildRecommendations(candidates = [], prefs = {}, { now = new Date(), limit = 12 } = {}) {
  const scored = []
  for (const row of candidates) {
    const signals = buildSignals(row, prefs, { now })
    const score = scoreSignals(signals)
    if (score == null) continue
    const type = classifyPrimaryType(signals)
    const reasons = buildReasons(signals)
    if (!reasons.length) continue
    scored.push({
      catalogItemId: row.catalog_item_id,
      type,
      reasons,
      market: signals.hasMarket
        ? {
            bestPriceJpy: row.best_price_jpy,
            source: row.source_id,
            listingCount: row.listing_count,
            checkedAt: row.checked_at,
            url: row.best_url,
          }
        : null,
      primaryAction: signals.hasMarket ? 'open_listing' : 'find_in_japan',
      setId: row.set_id,
      setCode: row.set_code,
      setName: row.set_name_en || row.set_name_ja,
      number: row.number,
      nameJa: row.name_ja,
      nameEn: row.name_en,
      rarity: row.rarity,
      _score: score,
    })
  }

  scored.sort((a, b) => b._score - a._score)
  const used = new Set()
  const take = (type, n) => {
    const out = []
    for (const row of scored) {
      if (row.type !== type || used.has(row.catalogItemId)) continue
      const { _score, ...clean } = row
      out.push(clean)
      used.add(row.catalogItemId)
      if (out.length >= n) break
    }
    return out
  }

  // Roll up complete_set by set for finishYourSet
  const finishMap = new Map()
  for (const row of scored) {
    if (row.type !== 'complete_set' || used.has(row.catalogItemId)) continue
    if (!row.setId) continue
    const bucket = finishMap.get(row.setId) || {
      setId: row.setId,
      setCode: row.setCode,
      setName: row.setName,
      items: [],
    }
    if (bucket.items.length < 5) {
      const { _score, ...clean } = row
      bucket.items.push(clean)
      used.add(row.catalogItemId)
    }
    finishMap.set(row.setId, bucket)
  }

  return {
    foundForYou: [...take('wishlist_found', limit), ...take('complete_set', Math.max(2, Math.floor(limit / 2)))].slice(0, limit),
    goodTiming: take('opportunity', limit),
    finishYourSet: [...finishMap.values()].slice(0, 6),
    related: take('related', limit),
  }
}
