import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  fetchText,
  fetchViaJina,
  isRakumaProductUrl,
  matchesQuery,
  parseJinaHits,
} from './common.ts'

const STORE_ID = 'rakuma'
const STORE_NAME = 'Rakuma'

function extractFrilPrice(block: string): string | null {
  return (
    block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
    block.match(/([\d,]+(?:\.\d+)?)\s*円/)?.[1] ||
    block.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1] ||
    block.match(/data-price=["']([\d.,]+)["']/i)?.[1] ||
    null
  )
}

export async function searchRakuma(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `https://fril.jp/s?query=${encoded}`

  try {
    const html = await fetchText(searchUrl)
    const blockMatches = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi)).slice(0, pageSize * 2)
    const strictHits: UnifiedSearchHit[] = []
    const looseHits: UnifiedSearchHit[] = []

    for (let i = 0; i < blockMatches.length && hits.length < pageSize; i += 1) {
      const block = blockMatches[i]?.[0] || ''
      const href = block.match(/<a[^>]+href=["']([^"']+\/item\/[^"']+)["']/i)?.[1]
      const title =
        block.match(/alt=["']([^"']{3,180})["']/i)?.[1] ||
        block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, ' ').trim()
      const rawPrice = extractFrilPrice(block)
      const imageUrl = pickBestImage(
        [block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
        'https://fril.jp'
      )
      const productUrl = href ? new URL(href, 'https://fril.jp').toString() : null

      if (!title || !productUrl) continue
      if (!isRakumaProductUrl(productUrl)) continue
      const built = buildHit({
        id: `${STORE_ID}-${i}-${productUrl}`,
        title,
        price: parsePrice(rawPrice),
        currency: 'JPY',
        imageUrl,
        productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'html',
      })
      if (matchesQuery(title, query)) strictHits.push(built)
      else looseHits.push(built)
    }

    if (strictHits.length > 0) return strictHits.slice(0, pageSize)
    if (looseHits.length > 0) return looseHits.slice(0, pageSize)
  } catch {
    // fallback below
  }

  const jinaText = await fetchViaJina(searchUrl)
  const parsed = parseJinaHits(jinaText, 'https://fril.jp', 'JPY').filter((hit) =>
    isRakumaProductUrl(hit.productUrl)
  )
  const strictFallback = parsed.filter((hit) => matchesQuery(hit.title, query))
  const fallbackHits = strictFallback.length > 0 ? strictFallback : parsed
  return fallbackHits.slice(0, pageSize).map((hit, idx) =>
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
    })
  )
}
