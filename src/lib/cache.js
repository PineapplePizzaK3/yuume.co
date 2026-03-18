const PREFIX = 'platform_cache_v1:'

function now() {
  return Date.now()
}

export function cacheKey(userId, scope) {
  return `${PREFIX}${userId || 'anon'}:${scope}`
}

export function readCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.ts !== 'number') return null
    if (maxAgeMs != null && now() - parsed.ts > maxAgeMs) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: now(), data }))
  } catch {
    // ignore quota / private mode
  }
}

