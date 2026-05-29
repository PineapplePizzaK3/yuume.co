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
  return (
    u.startsWith('data:') ||
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
    u.endsWith('.svg')
  )
}

export function pickBestImage(candidates: Array<string | null | undefined>, baseUrl: string): string | null {
  const uniq = Array.from(
    new Set(
      candidates
        .map((c) => toAbsoluteUrl(c, baseUrl))
        .filter(Boolean) as string[]
    )
  )
  const scored = uniq
    .filter((u) => !isBadImage(u))
    .map((u) => {
      let score = 0
      const lower = u.toLowerCase()
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 2
      if (/images\/i\//i.test(lower)) score += 3
      if (/m\.media-amazon\.com|images-(?:na\.)?ssl-images-amazon/.test(lower)) score += 3
      if (/mercdn\.net|item\.fril\.jp|fril\.jp/.test(lower)) score += 2
      if (/(avatar|profile|icon|logo)/i.test(lower)) score -= 3
      return { u, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.u ?? null
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
  productUrl: string
  storeId: StoreId
  storeName: string
  source?: 'html' | 'jina' | 'mixed'
  tags?: CatalogHitTag[]
  auctionCurrentBidPrice?: number | null
  auctionBuyoutPrice?: number | null
}): UnifiedSearchHit {
  const tags = params.tags?.length ? [...new Set(params.tags)] : undefined
  return {
    id: params.id,
    title: normalizeTitle(params.title),
    price: params.price,
    currency: String(params.currency || 'JPY').toUpperCase(),
    imageUrl: params.imageUrl || null,
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
