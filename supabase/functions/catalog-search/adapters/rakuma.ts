import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage, rakumaTagsFromBlock } from '../normalize.ts'
import {
  collectImageCandidates,
  extractRakumaHitsFromHtmlRegex,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isRakumaProductUrl,
  JINA_TIMEOUT_MS,
  matchesQuery,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'rakuma'
const STORE_NAME = 'Rakuma'

function extractFrilPrice(block: string): string | null {
  const dataContent = block.match(/<span[^>]+data-content=["'](\d+)["'][^>]*>[\d,]+<\/span>/i)?.[1]
  if (dataContent) return dataContent

  return (
    block.match(/data-rat-price=["'](\d+)["']/i)?.[1] ||
    block.match(/data-rat-cp-price=["'](\d+)["']/i)?.[1] ||
    block.match(/<p[^>]*class=["'][^"']*item-box__item-price[^"']*["'][^>]*>[\s\S]*?([\d,]+)/i)?.[1] ||
    block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
    block.match(/([\d,]+(?:\.\d+)?)\s*円/)?.[1] ||
    block.match(/"price"\s*:\s*(\d+)/i)?.[1] ||
    block.match(/&quot;price&quot;\s*:\s*(\d+)/i)?.[1] ||
    block.match(/data-price=["']([\d.,]+)["']/i)?.[1] ||
    null
  )
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

function hitsFromItemBoxes(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const blockMatches = Array.from(
    html.matchAll(/<div class="item-box">[\s\S]*?item-box__item-price[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi),
  ).slice(0, pageSize * 3)
  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []

  for (let i = 0; i < blockMatches.length; i += 1) {
    const block = blockMatches[i]?.[0] || ''
    const link =
      block.match(
        /<a[^>]+href=["'](https?:\/\/item\.fril\.jp\/[a-f0-9]+)["'][^>]*title=["']([^"']{3,220})["']/i,
      ) ||
      block.match(/<a[^>]+href=["'](https?:\/\/item\.fril\.jp\/[a-f0-9]+)["']/i)
    const href = link?.[1]
    const titleFromAttr = link?.[2]
    const productUrl = href ? new URL(href, 'https://fril.jp').toString() : null
    const idFromPath = productUrl?.split('/').pop()
    const title =
      titleFromAttr ||
      block.match(/alt=["']([^"']{3,180})["']/i)?.[1] ||
      block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, ' ').trim() ||
      (idFromPath ? `Item ${idFromPath.slice(0, 8)}` : null)
    const rawPrice = extractFrilPrice(block)
    const preferredImg =
      block.match(/<img[^>]+(?:data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["']/i)?.[1] ||
      block.match(/<img[^>]+srcset=["']([^"']+)["']/i)?.[1]?.split(',')?.[0]?.trim()?.split(/\s+/)?.[0] ||
      null
    const imageUrl = pickBestImage(
      [preferredImg, block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
      'https://fril.jp'
    )

    if (!title || !productUrl) continue
    if (!isRakumaProductUrl(productUrl)) continue
    const blockTags = rakumaTagsFromBlock(block)
    const built = buildHit({
      id: `${STORE_ID}-box-${i}-${productUrl}`,
      title,
      price: parsePrice(rawPrice),
      currency: 'JPY',
      imageUrl,
      productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'html',
      tags: blockTags.length ? blockTags : undefined,
    })
    if (matchesQuery(title, query)) strictHits.push(built)
    else looseHits.push(built)
  }

  if (strictHits.length > 0) return strictHits.slice(0, pageSize)
  if (looseHits.length > 0) return looseHits.slice(0, pageSize)
  return []
}

function collectFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const collected: UnifiedSearchHit[] = []
  collected.push(...hitsFromItemBoxes(html, pageSize, query))

  const regexHits = extractRakumaHitsFromHtmlRegex(html, pageSize)
  for (let idx = 0; idx < regexHits.length; idx += 1) {
    const hit = regexHits[idx]
    collected.push(
      buildHit({
        id: `${STORE_ID}-rx-${idx}-${hit.productUrl}`,
        title: hit.title,
        price: hit.price,
        currency: 'JPY',
        imageUrl: hit.imageUrl,
        productUrl: hit.productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'html',
      }),
    )
  }

  return dedupeByUrl(collected)
}

function collectFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const jinaParsed = parseJinaHits(jinaText, 'https://fril.jp', 'JPY').filter((hit) =>
    isRakumaProductUrl(hit.productUrl),
  )
  const strictJ = jinaParsed.filter((hit) => matchesQuery(hit.title, query))
  const jinaUse = strictJ.length > 0 ? strictJ : jinaParsed
  const collected: UnifiedSearchHit[] = []
  for (let idx = 0; idx < jinaUse.length; idx += 1) {
    const hit = jinaUse[idx]
    collected.push(
      buildHit({
        id: `${STORE_ID}-jina-${idx}-${hit.productUrl}`,
        title: hit.title,
        price: hit.price,
        currency: hit.currency,
        imageUrl: null,
        productUrl: hit.productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'jina',
      }),
    )
  }
  return collected.slice(0, pageSize)
}

export async function searchRakuma(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {
  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const encoded = encodeURIComponent(query)
  const pageParam = storePage > 1 ? `&page=${storePage}` : ''
  const searchUrl = `https://fril.jp/s?query=${encoded}${pageParam}`

  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: 'https://fril.jp/' }).catch(() => '')
  const fromHtml = collectFromHtml(html, pageSize, query)
  if (fromHtml.length >= Math.min(pageSize, 4)) {
    return fromHtml.slice(0, pageSize)
  }

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) {
    return fromHtml.slice(0, pageSize)
  }

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...collectFromJina(jinaText, pageSize, query)])
  return merged.slice(0, pageSize)
}
