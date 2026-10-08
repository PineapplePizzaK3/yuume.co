function uniqueHttpUrls(values) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : [values]) {
    const url = String(value || '').trim()
    if (!url || !/^https?:\/\//i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/**
 * Identity of the listing's own photos. Related/recommended tiles on the
 * source page use a different id and must not enter the gallery.
 */
export function listingPhotoOwner(productUrl, coverUrl = '') {
  const pageRaw = String(productUrl || '').trim()
  const cover = String(coverUrl || '').trim()
  try {
    const page = pageRaw ? new URL(pageRaw) : null
    const host = page?.hostname.toLowerCase() || ''
    if (page && /(^|\.)mercari\.com$/.test(host)) {
      const id = page.pathname.match(/\/item\/(m\d+)/i)?.[1]
      return id ? { kind: 'mercari', id } : null
    }
    if (/(^|\.)fril\.jp$/i.test(host) || /img\.fril\.jp/i.test(cover)) {
      const id = cover.match(/img\.fril\.jp\/img\/(\d+)\//i)?.[1]
      return id ? { kind: 'rakuma', id } : null
    }
    if (page && /paypayfleamarket\.yahoo\.co\.jp$/.test(host)) {
      const id = page.pathname.split('/').filter(Boolean).pop()
      return id ? { kind: 'yahoo_flea', id } : null
    }
    if (page && /auctions\.yahoo\.co\.jp$/.test(host)) {
      const id = page.pathname.split('/').filter(Boolean).pop()
      return id ? { kind: 'yahoo', id } : null
    }
    if (page && /(^|\.)amazon\.(co\.jp|com)$/.test(host)) {
      const id = page.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1]
      return id ? { kind: 'amazon', id } : null
    }
    if (page && /(^|\.)snkrdunk\.com$/.test(host)) {
      const id = page.pathname.split('/').filter(Boolean).pop()
      return id ? { kind: 'snkrdunk', id } : null
    }
  } catch {
    return null
  }
  return null
}

export function imageBelongsToListing(url, owner) {
  if (!owner?.id || !url) return false
  const u = String(url)
  if (owner.kind === 'mercari') return /mercdn\.net/i.test(u) && u.includes(owner.id)
  if (owner.kind === 'rakuma') return new RegExp(`img\\.fril\\.jp/img/${owner.id}/`, 'i').test(u)
  if (owner.kind === 'yahoo_flea') return u.toLowerCase().includes(String(owner.id).toLowerCase())
  if (owner.kind === 'yahoo') return u.toLowerCase().includes(String(owner.id).toLowerCase())
  if (owner.kind === 'snkrdunk') {
    return u.includes(owner.id) && /cdn\.snkrdunk\.com/i.test(u) && !/\/assets\/|logo|icon/i.test(u)
  }
  if (owner.kind === 'amazon') {
    return /m\.media-amazon\.com|images-(?:na\.)?ssl-images-amazon/i.test(u) && /\/images\/I\//i.test(u)
  }
  return false
}

function withCoverFirst(cover, urls) {
  const list = uniqueHttpUrls(urls)
  if (cover && list.includes(cover)) return [cover, ...list.filter((url) => url !== cover)]
  if (cover) return [cover, ...list.filter((url) => url !== cover)]
  return list
}

/** Same Rakuma shot appears as /s/ /m/ /l/ — keep the largest. */
function dedupeRakumaByPhotoId(urls) {
  const order = []
  const best = new Map()
  for (const url of urls) {
    const match = String(url).match(/img\.fril\.jp\/img\/(\d+)\/([lms])\/(\d+)/i)
    const key = match ? `${match[1]}:${match[3]}` : url
    const rank = match ? (match[2] === 'l' ? 3 : match[2] === 'm' ? 2 : 1) : 1
    const prev = best.get(key)
    if (!prev) {
      best.set(key, { url, rank })
      order.push(key)
    } else if (rank > prev.rank) {
      best.set(key, { url, rank })
    }
  }
  return order.map((key) => best.get(key).url)
}

/**
 * Keep photos that belong to this listing. If extras cannot be proven,
 * keep only the cover — recommended tiles on the source page often share CDN hosts.
 */
export function filterOwnedListingImages(productUrl, urls, coverUrl = '') {
  const list = uniqueHttpUrls(urls)
  if (!list.length) return []
  const cover = String(coverUrl || list[0] || '').trim()
  const owner = listingPhotoOwner(productUrl, cover)

  if (!owner) return cover ? [cover] : list.slice(0, 1)

  // Amazon/Yahoo auction image URLs rarely include the listing id.
  // Search-hit extras are almost always neighbors; keep the cover only.
  if (owner.kind === 'amazon' || owner.kind === 'yahoo') {
    return cover ? [cover] : list.slice(0, 1)
  }

  const owned = list.filter((url) => imageBelongsToListing(url, owner))
  if (!owned.length) return cover ? [cover] : []
  const ordered = withCoverFirst(cover && imageBelongsToListing(cover, owner) ? cover : owned[0], owned)
  return owner.kind === 'rakuma' ? dedupeRakumaByPhotoId(ordered) : ordered
}

export const MIN_OWNED_PHOTOS_TO_SKIP_GALLERY = 2

export function hasEnoughOwnedListingPhotos(productUrl, urls, coverUrl = '') {
  return filterOwnedListingImages(productUrl, urls, coverUrl).length >= MIN_OWNED_PHOTOS_TO_SKIP_GALLERY
}

function isYahooProductPhoto(url) {
  return (
    /yimg\.jp/i.test(url)
    && /images\.auctions\.yahoo|auc-pctr|fleamarket|paypay|\/image\//i.test(url)
    && !/(icon|logo|avatar|sprite|loading|1x1|clear\.gif|spaceball|transparent)/i.test(url)
  )
}

function mentionsOtherFleaItem(url, itemId) {
  const other = String(url || '').match(/\/(z\d{6,})\b/i)?.[1]
  if (!other || !itemId) return false
  return other.toLowerCase() !== String(itemId).toLowerCase()
}

/**
 * Gallery scrape from the product page (colorImages / imagebox / item JSON).
 * Still drop URLs that mention a different listing id.
 */
export function filterTrustedGalleryImages(productUrl, urls, coverUrl = '') {
  const list = uniqueHttpUrls(urls)
  const cover = String(coverUrl || list[0] || '').trim()
  const owner = listingPhotoOwner(productUrl, cover)

  if (owner?.kind === 'amazon') {
    const extras = list.filter((url) =>
      /m\.media-amazon\.com|images-(?:na\.)?ssl-images-amazon/i.test(url) && /\/images\/I\//i.test(url)
    )
    return extras.length ? withCoverFirst(cover, extras) : (cover ? [cover] : [])
  }
  if (owner?.kind === 'yahoo') {
    const extras = list.filter((url) => isYahooProductPhoto(url))
    return extras.length ? withCoverFirst(cover, extras) : (cover ? [cover] : [])
  }
  if (owner?.kind === 'yahoo_flea') {
    const owned = list.filter((url) => imageBelongsToListing(url, owner))
    if (owned.length) return withCoverFirst(cover, owned)
    const safe = list.filter((url) => isYahooProductPhoto(url) && !mentionsOtherFleaItem(url, owner.id))
    return safe.length ? withCoverFirst(cover, safe) : (cover ? [cover] : [])
  }
  return filterOwnedListingImages(productUrl, list, cover)
}

/** Shown gallery: prove ownership when we can; do not strip trusted Amazon/Yahoo extras. */
export function displayListingImages(productUrl, urls, coverUrl = '') {
  const owner = listingPhotoOwner(productUrl, coverUrl)
  if (owner?.kind === 'amazon' || owner?.kind === 'yahoo') {
    return uniqueHttpUrls([coverUrl, ...(Array.isArray(urls) ? urls : [])])
  }
  return filterOwnedListingImages(productUrl, urls, coverUrl)
}
