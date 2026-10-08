import type { UnifiedSearchHit } from './types.ts'

export const INDEX_FRESH_MS = 20 * 60 * 1000
export const INDEX_MIN_FRESH_HITS = 6

export function indexHitFresh(hit: UnifiedSearchHit | null, now = Date.now()): boolean {
  const ts = Date.parse(String(hit?.fetchedAt || ''))
  return Number.isFinite(ts) && now - ts <= INDEX_FRESH_MS
}

export function evaluateIndexSufficiency(
  hits: UnifiedSearchHit[],
  pageSize: number,
  now = Date.now(),
): { sufficient: boolean; indexFresh: boolean; hasMore: boolean } {
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
