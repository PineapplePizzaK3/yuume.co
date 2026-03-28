import type { StoreId, UnifiedSearchHit } from '../types.ts'

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
  const clean = String(raw).trim()
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
      if (/(small|thumb|thumbnail)/i.test(lower)) score -= 2
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
}): UnifiedSearchHit {
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
    fetchedAt: new Date().toISOString(),
  }
}
