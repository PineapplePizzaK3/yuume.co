import type { CatalogHitTag, StoreId, UnifiedSearchHit } from './types.ts'

export function parsePrice(value: unknown): number | null {
  if (value == null) return null
  let text = String(value).trim()
  if (!text) return null
  text = text.replace(/[^\d.,-]/g, '')
  if (!text) return null

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandsSep = decimalSep === '.' ? ',' : '.'
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '')
    if (decimalSep === ',') text = text.replace(/,/g, '.')
  } else if (lastComma !== -1) {
    const parts = text.split(',')
    const tail = parts[parts.length - 1] ?? ''
    text = tail.length <= 2 ? `${parts.slice(0, -1).join('')}.${tail}` : parts.join('')
  } else if (lastDot !== -1) {
    const parts = text.split('.')
    const tail = parts[parts.length - 1] ?? ''
    if (tail.length > 2) text = parts.join('')
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1e9) return null
  return parsed
}

export function toAbsoluteUrl(raw: string | null | undefined, baseUrl: string): string | null {
  if (!raw) return null
  const clean = String(raw)
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\\+$/g, '')
    .trim()
  if (!clean) return null
  try {
    return new URL(clean, baseUrl).toString()
  } catch {
    return null
  }
}

function isBadImage(url: string): boolean {
  const u = url.toLowerCase()
  if (!/^https?:\/\//i.test(url)) return true
  if (u.startsWith('data:')) return true
  if (/(null|undefined|about:blank)$/i.test(u)) return true
  return (
    u.includes('sprite') ||
    u.includes('icon') ||
    u.includes('logo') ||
    u.includes('placeholder') ||
    u.includes('no_image') ||
    u.includes('noimage') ||
    u.includes('default') ||
    u.includes('blank') ||
    u.includes('loading') ||
    u.includes('spacer') ||
    u.includes('pixel') ||
    u.includes('transparent') ||
    u.includes('clear.gif') ||
    u.includes('spaceball') ||
    u.includes('1x1') ||
    u.includes('grey.gif') ||
    u.includes('gray.gif') ||
    u.includes('/np/') ||
    u.includes('no-image') ||
    u.endsWith('.svg') ||
    u.includes('.gif?') && u.includes('tracking')
  )
}

function scoreImage(url: string): number {
  let score = 0
  const lower = url.toLowerCase()
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 2
  if (/images\/i\//i.test(lower)) score += 3
  if (/m\.media-amazon\.com|images-(?:na\.)?ssl-images-amazon/.test(lower)) score += 3
  if (/mercdn\.net|img\.fril\.jp|fril\.jp|yimg\.jp|snkrdunk\.com/.test(lower)) score += 2
  if (/(avatar|profile|icon|logo|sprite)/i.test(lower)) score -= 5
  if (/orig|hires|\/l\/|size=l\b|pri=l|_sl1\d{3}/.test(lower)) score += 3
  if (/thumb|thumbnail|\/s\/|size=s\b|w=240\b|w=120\b/.test(lower)) score -= 1
  return score
}

/** Mesma foto em tamanhos diferentes (thumb, srcset, ?size=) vira uma só. */
function imageIdentity(url: string): string {
  try {
    const parsed = new URL(url)
    let path = parsed.pathname
    path = path.replace(/\/c!\/[^/]+\//g, '/')
    path = path.replace(/\/thumb\//g, '/')
    path = path.replace(/\/item\/detail\/orig\//g, '/')
    if (/fril\.jp$/i.test(parsed.hostname)) path = path.replace(/\/[lms]\//g, '/')
    path = path.replace(/\._[^/]+(?=\.(?:jpg|jpeg|png|webp)$)/i, '')
    const drop = ['size', 'w', 'h', 'width', 'height', 'pri', 'quality', 'imwidth', 'impolicy', 'fit', 'auto']
    for (const key of drop) parsed.searchParams.delete(key)
    const query = parsed.searchParams.toString()
    return `${parsed.hostname}${path}${query ? `?${query}` : ''}`
  } catch {
    return url
  }
}

/**
 * Todas as fotos distintas, na ordem em que aparecem.
 * Variações de tamanho da mesma foto ficam só na versão maior.
 */
export function pickProductImages(
  candidates: Array<string | null | undefined>,
  baseUrl: string,
  limit = 24,
): string[] {
  const ordered: Array<{ url: string; score: number }> = []
  const seen = new Map<string, number>()
  for (const raw of candidates) {
    const url = toAbsoluteUrl(raw, baseUrl)
    if (!url || isBadImage(url)) continue
    const score = scoreImage(url)
    if (score < 0) continue
    const identity = imageIdentity(url)
    const prevIndex = seen.get(identity)
    if (prevIndex == null) {
      seen.set(identity, ordered.length)
      ordered.push({ url, score })
    } else if (score > ordered[prevIndex].score) {
      ordered[prevIndex] = { url, score }
    }
  }
  return ordered.slice(0, Math.max(1, limit)).map((row) => row.url)
}

export function pickBestImage(candidates: Array<string | null | undefined>, baseUrl: string): string | null {
  return pickProductImages(candidates, baseUrl, 24)[0] ?? null
}

export function normalizeTitle(raw: string | null | undefined): string {
  const text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 'Produto'
  return text.length > 180 ? `${text.slice(0, 177)}...` : text
}

export function mergeCatalogTags(...groups: Array<CatalogHitTag[] | undefined>): CatalogHitTag[] {
  const tags: CatalogHitTag[] = []
  for (const group of groups) {
    if (!group?.length) continue
    tags.push(...group)
  }
  return [...new Set(tags)]
}

export function isMercariSoldStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  if (!s) return false
  return /SOLD_OUT|\bSOLD\b|売り切れ/.test(s)
}

export function isMercariUnavailableStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  if (!s || isMercariSoldStatus(s)) return false
  return /TRADING|STOP|CANCEL|ADMIN_CANCEL|UNAVAILABLE|DELETED|EXPIRED/.test(s)
}

export function mercariTagsFromRow(row: {
  auction?: unknown
  itemType?: unknown
  status?: unknown
}): CatalogHitTag[] {
  const tags: CatalogHitTag[] = []
  if (row.auction != null && typeof row.auction === 'object') tags.push('auction')
  const itemType = String(row.itemType ?? '')
  if (/AUCTION/i.test(itemType)) tags.push('auction')
  if (isMercariSoldStatus(row.status)) tags.push('sold')
  else if (isMercariUnavailableStatus(row.status)) tags.push('unavailable')
  return [...new Set(tags)]
}

export function mercariTagsFromText(text: string): CatalogHitTag[] {
  const tags: CatalogHitTag[] = []
  if (/オークション|入札(?:する|中)|現在(?:の)?(?:価格|入札)/i.test(text)) tags.push('auction')
  if (/売り切れ|売切れ|SOLD\s*OUT|ITEM_STATUS_SOLD_OUT|\bsold_out\b/i.test(text)) tags.push('sold')
  else if (/取引中|出品停止|取り下げ|unavailable|not available/i.test(text)) tags.push('unavailable')
  return [...new Set(tags)]
}

export function amazonTagsFromBlock(block: string): CatalogHitTag[] {
  const tags: CatalogHitTag[] = []
  if (/オークション|入札/i.test(block)) tags.push('auction')
  if (/売り切れ|sold out/i.test(block)) tags.push('sold')
  else if (
    /在庫切れ|在庫なし|現在お取扱いできません|Currently unavailable|temporarily out of stock|out of stock|利用できません/i.test(
      block,
    )
  ) {
    tags.push('unavailable')
  }
  return [...new Set(tags)]
}

export function rakumaTagsFromBlock(block: string): CatalogHitTag[] {
  const tags: CatalogHitTag[] = []
  if (/item-box--sold|sold-out|売り切れ|\bSOLD\b|売切れ/i.test(block)) tags.push('sold')
  else if (/取引中|unavailable|not available/i.test(block)) tags.push('unavailable')
  return [...new Set(tags)]
}

export function buildHit(params: {
  id: string
  title: string
  price: number | null
  currency?: string | null
  imageUrl?: string | null
  imageUrls?: Array<string | null | undefined>
  productUrl: string
  storeId: StoreId
  storeName: string
  source?: 'html' | 'jina' | 'mixed' | 'index'
  tags?: CatalogHitTag[]
  auctionCurrentBidPrice?: number | null
  auctionBuyoutPrice?: number | null
}): UnifiedSearchHit {
  const tags = params.tags?.length ? [...new Set(params.tags)] : undefined
  const imageUrls = pickProductImages(
    params.imageUrls?.length ? params.imageUrls : [params.imageUrl],
    params.productUrl,
  )
  return {
    id: params.id,
    title: normalizeTitle(params.title),
    price: params.price,
    currency: String(params.currency || 'JPY').toUpperCase(),
    imageUrl: imageUrls[0] || null,
    imageUrls,
    productUrl: params.productUrl,
    storeId: params.storeId,
    storeName: params.storeName,
    source: params.source || 'html',
    tags,
    auctionCurrentBidPrice: params.auctionCurrentBidPrice ?? null,
    auctionBuyoutPrice: params.auctionBuyoutPrice ?? null,
    fetchedAt: new Date().toISOString(),
  }
}
