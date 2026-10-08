/** Pure helpers for cart lines that came from a temporary listing. */

export function ephemeralExpiryMs(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function isEphemeralListingExpired(expiresAt, now = Date.now()) {
  const ms = ephemeralExpiryMs(expiresAt)
  return ms != null && ms <= now
}

export function partitionEphemeralCartRows(rows, now = Date.now()) {
  const live = []
  const expired = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (isEphemeralListingExpired(row?.expires_at, now)) expired.push(row)
    else live.push(row)
  }
  return { live, expired }
}

function itemExpiresAt(item) {
  return item?.products?.expires_at ?? item?.expires_at ?? null
}

/** Milliseconds until the soonest still-valid temporary listing in the cart. */
export function nextEphemeralExpiryDelayMs(items, now = Date.now()) {
  let next = null
  for (const item of Array.isArray(items) ? items : []) {
    const ms = ephemeralExpiryMs(itemExpiresAt(item))
    if (ms == null || ms <= now) continue
    if (next == null || ms < next) next = ms
  }
  if (next == null) return null
  return Math.max(0, next - now)
}

export function dropExpiredEphemeralCartItems(items, now = Date.now()) {
  const source = Array.isArray(items) ? items : []
  const live = source.filter((item) => !isEphemeralListingExpired(itemExpiresAt(item), now))
  return { live, removedCount: source.length - live.length }
}
