import type { UnifiedSearchHit } from './types.ts'

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
