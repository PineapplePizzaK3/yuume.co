import type { StoreId, UnifiedSearchHit } from './types.ts'

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export function scoreHit(hit: UnifiedSearchHit, query: string): number {
  const tokens = tokenize(query)
  const title = String(hit.title || '').toLowerCase()
  const store = String(hit.storeName || '').toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (title.includes(token)) score += 14
    if (title.startsWith(token)) score += 4
    if (store.includes(token)) score += 1
  }

  if (hit.price != null) score += 3
  if (hit.imageUrl) score += 4
  if (hit.source === 'html') score += 2
  if (hit.source === 'mixed') score += 1

  return score
}

export function rankHits(hits: UnifiedSearchHit[], query: string): UnifiedSearchHit[] {
  return [...hits]
    .map((hit) => ({ ...hit, score: scoreHit(hit, query) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

/** Evita que uma loja com score alto (ex.: Amazon + query em inglês) ocupe a página inteira. */
export function interleaveRankedByStore(
  hits: UnifiedSearchHit[],
  query: string,
  storeOrder: StoreId[],
): UnifiedSearchHit[] {
  const ranked = rankHits(hits, query)
  const buckets = new Map<string, UnifiedSearchHit[]>()
  for (const sid of storeOrder) buckets.set(sid, [])
  for (const h of ranked) {
    const arr = buckets.get(h.storeId)
    if (arr) arr.push(h)
  }
  const out: UnifiedSearchHit[] = []
  for (;;) {
    let progressed = false
    for (const sid of storeOrder) {
      const arr = buckets.get(sid)
      if (arr?.length) {
        out.push(arr.shift()!)
        progressed = true
      }
    }
    if (!progressed) break
  }
  return out
}
