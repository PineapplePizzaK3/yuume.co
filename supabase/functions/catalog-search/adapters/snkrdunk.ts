import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isSnkrdunkProductUrl,
  JINA_TIMEOUT_MS,
  matchesQuery,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'snkrdunk'
const STORE_NAME = 'SNKRDUNK'
const BASE = 'https://snkrdunk.com'

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

function cleanText(text: string | null | undefined): string {
  return decodeHtmlEntities(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAriaLabel(label: string): { title: string; priceRaw: string | null } {
  const decoded = cleanText(label)
  const match = decoded.match(/^(.+?)\s*-\s*(?:¥|￥)\s*([\d,]+(?:\.\d+)?)\s*$/)
  if (match) return { title: match[1].trim(), priceRaw: match[2] }
  return { title: decoded, priceRaw: null }
}

function snkrdunkTagsFromContext(text: string): Array<'sold' | 'unavailable'> {
  if (/売り切れ|売切れ|sold\s*out|在庫なし/i.test(text)) return ['sold']
  if (/取引終了|公開停止|利用できません|unavailable/i.test(text)) return ['unavailable']
  return []
}

function sourceRank(s: UnifiedSearchHit['source']): number {
  return s === 'html' ? 2 : 1
}

function dedupeByUrl(hits: UnifiedSearchHit[]): UnifiedSearchHit[] {
  const m = new Map<string, UnifiedSearchHit>()
  for (const h of hits) {
    const prev = m.get(h.productUrl)
    if (!prev || sourceRank(h.source) > sourceRank(prev.source)) m.set(h.productUrl, h)
  }
  return [...m.values()]
}

function extractSnkrdunkHitsFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const tileRe =
    /<a href="(https:\/\/snkrdunk\.com\/(?:products|apparels)\/[^"]+)"[^>]*class="[^"]*productTile[^"]*"[^>]*aria-label="([^"]+)"/gi

  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(tileRe)) {
    const productUrl = match[1]
    if (!isSnkrdunkProductUrl(productUrl) || seen.has(productUrl)) continue
    seen.add(productUrl)

    const anchor = match[0]
    const { title, priceRaw } = parseAriaLabel(match[2])
    if (!title || title.length < 3) continue

    const idx = match.index ?? 0
    const context = html.slice(Math.max(0, idx - 400), Math.min(html.length, idx + anchor.length + 1200))

    const rawPrice =
      priceRaw ||
      anchor.match(/productPrice[^>]*>\s*([\d,]+)/i)?.[1] ||
      context.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
      null

    const imageUrl = pickBestImage(
      [
        anchor.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
        ...collectImageCandidates(anchor),
        ...collectImageCandidates(context),
      ],
      BASE,
    )

    const slug = productUrl.split('/').pop() || 'item'
    const tags = snkrdunkTagsFromContext(anchor + ' ' + context)
    const hit = buildHit({
      id: `${STORE_ID}-${slug}`,
      title,
      price: parsePrice(rawPrice),
      currency: 'JPY',
      imageUrl,
      productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'html',
      tags: tags.length ? tags : undefined,
    })

    if (matchesQuery(hit.title, query)) strictHits.push(hit)
    else looseHits.push(hit)
    if (strictHits.length + looseHits.length >= pageSize * 3) break
  }

  return (strictHits.length > 0 ? strictHits : looseHits).slice(0, pageSize)
}

function extractSnkrdunkHitsFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const parsed = parseJinaHits(jinaText, BASE, 'JPY').filter((h) => isSnkrdunkProductUrl(h.productUrl))
  const strict = parsed.filter((h) => matchesQuery(h.title, query))
  const useHits = strict.length > 0 ? strict : parsed
  return useHits.slice(0, pageSize).map((h, idx) =>
    buildHit({
      id: `${STORE_ID}-jina-${idx}-${h.productUrl}`,
      title: h.title,
      price: h.price,
      currency: h.currency,
      imageUrl: null,
      productUrl: h.productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'jina',
      tags: snkrdunkTagsFromContext(h.title),
    }),
  )
}

export async function searchSnkrdunk(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const searchUrl = `${BASE}/search?query=${encodeURIComponent(keyword)}`

  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: `${BASE}/` }).catch(() => '')
  const fromHtml = extractSnkrdunkHitsFromHtml(html, pageSize, keyword)
  if (fromHtml.length >= Math.min(pageSize, 4)) return fromHtml.slice(0, pageSize)

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) return fromHtml.slice(0, pageSize)

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...extractSnkrdunkHitsFromJina(jinaText, pageSize, keyword)])
  return merged.slice(0, pageSize)
}
