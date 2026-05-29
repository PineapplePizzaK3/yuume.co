import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isYahooAuctionUrl,
  JINA_TIMEOUT_MS,
  matchesQuery,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'yahoo'
const STORE_NAME = 'Yahoo Auctions'
const BASE = 'https://auctions.yahoo.co.jp'

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

function isSoldContext(text: string): boolean {
  return /落札|終了(?:済み|しました)?|売り切れ|取引終了|SOLD/i.test(text)
}

function isUnavailableContext(text: string): boolean {
  return /入札できません|利用できません|unavailable|out of stock/i.test(text)
}

function yahooTagsFromContext(text: string): Array<'auction' | 'sold' | 'unavailable'> {
  const tags: Array<'auction' | 'sold' | 'unavailable'> = ['auction']
  if (isSoldContext(text)) tags.push('sold')
  else if (isUnavailableContext(text)) tags.push('unavailable')
  return [...new Set(tags)]
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

function extractYahooHitsFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const anchorRe =
    /<a[^>]+href=["'](https?:\/\/auctions\.yahoo\.co\.jp\/(?:jp\/auction|auction)\/[a-z0-9]+)["'][^>]*>[\s\S]*?<\/a>/gi

  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(anchorRe)) {
    const productUrl = match[1]
    if (!isYahooAuctionUrl(productUrl) || seen.has(productUrl)) continue
    seen.add(productUrl)

    const anchor = match[0]
    const idx = match.index ?? 0
    const context = html.slice(Math.max(0, idx - 1000), Math.min(html.length, idx + 1800))

    const title =
      cleanText(anchor.match(/title=["']([^"']+)["']/i)?.[1]) ||
      cleanText(anchor) ||
      cleanText(context.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1]) ||
      `Yahoo ${productUrl.split('/').pop()}`

    if (!title || title.length < 3) continue

    const currentBidRaw =
      anchor.match(/data-auction-price=["']([\d.,]+)["']/i)?.[1] ||
      context.match(/data-auction-price=["']([\d.,]+)["']/i)?.[1] ||
      context.match(/(?:現在価格|現在)[^\d]{0,10}([\d,]{2,})/i)?.[1] ||
      context.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
      null
    const buyoutRaw =
      context.match(/data-auction-buyout-price=["']([\d.,]+)["']/i)?.[1] ||
      context.match(/(?:即決価格|即決)[^\d]{0,10}([\d,]{2,})/i)?.[1] ||
      null
    const currentBidPrice = parsePrice(currentBidRaw)
    const buyoutPrice = parsePrice(buyoutRaw)

    const imageUrl = pickBestImage(
      [
        anchor.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
        context.match(/<img[^>]+class=["'][^"']*Product__imageData[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1],
        ...collectImageCandidates(context),
      ],
      BASE,
    )

    const tags = yahooTagsFromContext(anchor + ' ' + context)
    const hit = buildHit({
      id: `${STORE_ID}-${productUrl.split('/').pop()}`,
      title,
      price: currentBidPrice ?? buyoutPrice,
      currency: 'JPY',
      imageUrl,
      productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'html',
      tags,
      auctionCurrentBidPrice: currentBidPrice,
      auctionBuyoutPrice: buyoutPrice,
    })
    if (matchesQuery(hit.title, query)) strictHits.push(hit)
    else looseHits.push(hit)
    if (strictHits.length + looseHits.length >= pageSize * 3) break
  }

  return (strictHits.length > 0 ? strictHits : looseHits).slice(0, pageSize)
}

function extractYahooHitsFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const parsed = parseJinaHits(jinaText, BASE, 'JPY').filter((h) => isYahooAuctionUrl(h.productUrl))
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
      tags: yahooTagsFromContext(h.title),
      auctionCurrentBidPrice: h.price,
      auctionBuyoutPrice: null,
    }),
  )
}

export async function searchYahoo(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const pageParam = storePage > 1 ? `&b=${(storePage - 1) * 50 + 1}` : ''
  const searchUrl = `${BASE}/search/search?p=${encodeURIComponent(keyword)}${pageParam}`

  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: `${BASE}/` }).catch(() => '')
  const fromHtml = extractYahooHitsFromHtml(html, pageSize, keyword)
  if (fromHtml.length >= Math.min(pageSize, 4)) return fromHtml.slice(0, pageSize)

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) return fromHtml.slice(0, pageSize)

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...extractYahooHitsFromJina(jinaText, pageSize, keyword)])
  return merged.slice(0, pageSize)
}
