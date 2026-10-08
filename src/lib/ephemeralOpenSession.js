const STORAGE_PREFIX = 'ephemeral_product_open_v1:'
const TTL_MS = 2 * 60 * 60 * 1000

function storage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function ephemeralOpenSid(productUrl) {
  const s = String(productUrl || '').trim()
  let hash = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `c${(hash >>> 0).toString(36)}`
}

function pruneExpired(store) {
  if (!store) return
  const now = Date.now()
  const toRemove = []
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue
    try {
      const parsed = JSON.parse(store.getItem(key) || '')
      const stashedAt = Number(parsed?.stashedAt) || 0
      if (!stashedAt || now - stashedAt > TTL_MS) toRemove.push(key)
    } catch {
      toRemove.push(key)
    }
  }
  for (const key of toRemove) {
    try {
      store.removeItem(key)
    } catch {
      // ignore
    }
  }
}

/** Compact hit used to create the ephemeral snapshot in any tab. */
export function normalizeEphemeralOpenItem(item) {
  if (!item || typeof item !== 'object') return null
  const productUrl = String(item.productUrl || item.external_url || '').trim()
  if (!productUrl) return null
  const imageUrls = Array.isArray(item.imageUrls)
    ? item.imageUrls.map((url) => String(url || '').trim()).filter(Boolean).slice(0, 8)
    : []
  const imageUrl = String(item.imageUrl || imageUrls[0] || '').trim() || null
  return {
    id: item.id || null,
    storeId: item.storeId || item.store_id || null,
    storeName: item.storeName || null,
    productUrl,
    title: item.title || null,
    price: item.price ?? null,
    currency: item.currency || 'JPY',
    imageUrl,
    imageUrls: imageUrls.length ? imageUrls : (imageUrl ? [imageUrl] : []),
    source: item.source || null,
    tags: Array.isArray(item.tags) ? item.tags : undefined,
    auctionCurrentBidPrice: item.auctionCurrentBidPrice ?? null,
    auctionBuyoutPrice: item.auctionBuyoutPrice ?? null,
  }
}

function utf8ToBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToUtf8(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const b64 = padded + '='.repeat(padLen)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Small enough for a URL hash; gallery photos are fetched on the bridge page. */
export function encodeEphemeralOpenPayload(item) {
  const normalized = normalizeEphemeralOpenItem(item)
  if (!normalized) return ''
  const compact = {
    storeId: normalized.storeId,
    productUrl: normalized.productUrl,
    title: normalized.title,
    price: normalized.price,
    currency: normalized.currency,
    imageUrl: normalized.imageUrl,
    source: normalized.source,
  }
  try {
    return utf8ToBase64Url(JSON.stringify(compact))
  } catch {
    return ''
  }
}

export function decodeEphemeralOpenPayload(encoded) {
  const raw = String(encoded || '').trim()
  if (!raw) return null
  try {
    return normalizeEphemeralOpenItem(JSON.parse(base64UrlToUtf8(raw)))
  } catch {
    return null
  }
}

export function stashEphemeralOpenPayload(item) {
  const store = storage()
  const normalized = normalizeEphemeralOpenItem(item)
  if (!normalized) return null
  const sid = ephemeralOpenSid(normalized.productUrl)
  if (!store) return sid
  try {
    pruneExpired(store)
    store.setItem(
      `${STORAGE_PREFIX}${sid}`,
      JSON.stringify({
        ...normalized,
        stashedAt: Date.now(),
      }),
    )
  } catch {
    // Open-in-new-tab can still use the URL hash fallback.
  }
  return sid
}

export function readEphemeralOpenPayload(sid) {
  const store = storage()
  if (!store) return null
  const key = String(sid || '').trim()
  if (!key) return null
  try {
    const raw = store.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const stashedAt = Number(parsed.stashedAt) || 0
    if (!stashedAt || Date.now() - stashedAt > TTL_MS) {
      store.removeItem(`${STORAGE_PREFIX}${key}`)
      return null
    }
    return normalizeEphemeralOpenItem(parsed)
  } catch {
    return null
  }
}

export function clearEphemeralOpenPayload(sid) {
  const store = storage()
  if (!store) return
  const key = String(sid || '').trim()
  if (!key) return
  try {
    store.removeItem(`${STORAGE_PREFIX}${key}`)
  } catch {
    // ignore
  }
}

export function resolveEphemeralOpenItem({ sid, encodedPayload } = {}) {
  return readEphemeralOpenPayload(sid) || decodeEphemeralOpenPayload(encodedPayload)
}
