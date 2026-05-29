import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isYahooFleaUrl,
  JINA_TIMEOUT_MS,
  matchesQuery,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'yahoo_flea'
const STORE_NAME = 'Yahoo Flea Market'
const BASE = 'https://paypayfleamarket.yahoo.co.jp'

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

function cleanText(text: string | null | undefined): string {
  return decodeHtmlEntities(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
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

function fleaTagsFromContext(text: string): Array<'sold' | 'unavailable'> {
  if (/売り切れ|売切れ|sold\s*out|取引終了/i.test(text)) return ['sold']
  if (/取引中|公開停止|利用できません|unavailable/i.test(text)) return ['unavailable']
  return []
}

function extractFleaHitsFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const anchorRe = /<a[^>]+href=["'](\/item\/[a-z0-9]+)["'][^>]*>[\s\S]*?<\/a>/gi

  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(anchorRe)) {
    const productUrl = new URL(match[1], BASE).toString()
    if (!isYahooFleaUrl(productUrl) || seen.has(productUrl)) continue
    seen.add(productUrl)

    const anchor = match[0]
    const idx = match.index ?? 0
    const context = html.slice(Math.max(0, idx - 700), Math.min(html.length, idx + 1800))

    const title =
      cleanText(anchor.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1]) ||
      cleanText(anchor.match(/title=["']([^"']+)["']/i)?.[1]) ||
      cleanText(anchor) ||
      `Yahoo Flea ${productUrl.split('/').pop()}`

    if (!title || title.length < 3) continue

    const rawPrice =
      anchor.match(/price:([\d.,]+)/i)?.[1] ||
      anchor.match(/>\s*([\d,]{2,})\s*円/i)?.[1] ||
      context.match(/>\s*([\d,]{2,})\s*円/i)?.[1] ||
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

    const tags = fleaTagsFromContext(anchor + ' ' + context)
    const hit = buildHit({
      id: `${STORE_ID}-${productUrl.split('/').pop()}`,
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

function extractFleaHitsFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const parsed = parseJinaHits(jinaText, BASE, 'JPY').filter((h) => isYahooFleaUrl(h.productUrl))
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
      tags: fleaTagsFromContext(h.title),
    }),
  )
}

export async function searchYahooFlea(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const pageParam = storePage > 1 ? `?page=${storePage}` : ''
  const searchUrl = `${BASE}/search/${encodeURIComponent(keyword)}${pageParam}`

  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: `${BASE}/` }).catch(() => '')
  const fromHtml = extractFleaHitsFromHtml(html, pageSize, keyword)
  if (fromHtml.length >= Math.min(pageSize, 4)) return fromHtml.slice(0, pageSize)

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) return fromHtml.slice(0, pageSize)

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...extractFleaHitsFromJina(jinaText, pageSize, keyword)])
  return merged.slice(0, pageSize)
}
