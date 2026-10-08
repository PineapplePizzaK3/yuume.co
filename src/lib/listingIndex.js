import { applyCatalogFilters, sortCatalogHits, tagCatalogHitBatch } from './catalogSearchFilters.js'
import { canonicalListingUrl } from './ephemeralRecommendations.js'

export function listingIndexHitKey(hit) {
  return canonicalListingUrl(hit?.productUrl || hit?.external_url)
}

/** Live hits win. Index fills URLs the live parse did not return. */
export function mergeLiveHitsWithIndex(liveHits, indexHits) {
  const seen = new Set()
  const out = []
  for (const hit of [...(Array.isArray(liveHits) ? liveHits : []), ...(Array.isArray(indexHits) ? indexHits : [])]) {
    const key = listingIndexHitKey(hit)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}

export function listingIndexRowToHit(row) {
  if (!row || typeof row !== 'object') return null
  const productUrl = String(row.external_url || row.productUrl || '').trim()
  const title = String(row.title || '').trim()
  const storeId = String(row.store_id || row.storeId || '').trim()
  if (!productUrl || !title || !storeId) return null
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.map((url) => String(url || '').trim()).filter(Boolean)
    : []
  const imageUrl = String(row.image_url || imageUrls[0] || '').trim()
  const price = Number(row.price_jpy ?? row.price)
  return {
    storeId,
    store_id: storeId,
    productUrl,
    external_url: productUrl,
    title,
    price: Number.isFinite(price) && price > 0 ? price : null,
    price_jpy: Number.isFinite(price) && price > 0 ? price : 0,
    currency: String(row.currency || 'JPY').toUpperCase(),
    imageUrl: imageUrl || null,
    image_url: imageUrl || '',
    imageUrls,
    image_urls: imageUrls,
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: 'index',
    expires_at: row.expires_at || null,
    fetchedAt: row.last_seen_at || row.fetchedAt || null,
  }
}

export const INDEX_FRESH_MS = 20 * 60 * 1000
export const INDEX_MIN_FRESH_HITS = 6

export function indexHitFresh(hit, now = Date.now()) {
  const ts = Date.parse(String(hit?.fetchedAt || hit?.last_seen_at || ''))
  return Number.isFinite(ts) && now - ts <= INDEX_FRESH_MS
}

export function evaluateIndexSufficiency(hits, pageSize, now = Date.now()) {
  const list = Array.isArray(hits) ? hits : []
  const n = list.length
  const freshCount = list.filter((hit) => indexHitFresh(hit, now)).length
  const halfPage = Math.max(1, Math.floor(Math.max(1, pageSize) / 2))
  const sufficient = n >= halfPage || (n >= INDEX_MIN_FRESH_HITS && freshCount >= INDEX_MIN_FRESH_HITS)
  const indexFresh = n > 0 && freshCount >= Math.min(n, INDEX_MIN_FRESH_HITS)
  return {
    sufficient,
    indexFresh,
    hasMore: sufficient || n >= pageSize,
  }
}

/** Live refresh updates matching URLs in place and appends new ones. Visible order stays. */
export function mergeVisibleHitsWithLiveRefresh(visible, liveHits) {
  const byUrl = new Map()
  for (const hit of Array.isArray(liveHits) ? liveHits : []) {
    const key = listingIndexHitKey(hit)
    if (key) byUrl.set(key, hit)
  }
  const seen = new Set()
  const merged = []
  for (const hit of Array.isArray(visible) ? visible : []) {
    const key = listingIndexHitKey(hit)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const next = byUrl.get(key)
    merged.push(next ? { ...hit, ...next, loadedBatch: hit.loadedBatch } : hit)
  }
  for (const hit of Array.isArray(liveHits) ? liveHits : []) {
    const key = listingIndexHitKey(hit)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(hit)
  }
  return merged
}

/** First paint from the index while live marketplace parse is still running. */
export function prepareIndexSearchHits(hits, filters, loadedBatch = 0) {
  return tagCatalogHitBatch(
    sortCatalogHits(applyCatalogFilters(hits, filters), filters?.sort),
    loadedBatch,
  )
}
