interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const CACHE = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL_MS = 10 * 60 * 1000

export function getCache<T>(key: string): T | null {
  const entry = CACHE.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key)
    return null
  }
  return entry.value as T
}

export function setCache<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS): void {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1000, ttlMs),
  })
}

export function buildCacheKey(parts: Record<string, unknown>): string {
  return Object.entries(parts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|')
}
