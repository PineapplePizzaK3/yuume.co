import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../lib/normalize.ts'
import { collectImageCandidates, fetchText, fetchViaJina, parseJinaHits } from './common.ts'

const STORE_ID = 'rakuma'
const STORE_NAME = 'Rakuma'

export async function searchRakuma(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `https://fril.jp/s?query=${encoded}`

  try {
    const html = await fetchText(searchUrl, 7000)
    const blockMatches = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi)).slice(0, pageSize * 2)
    const hits: UnifiedSearchHit[] = []

    for (let i = 0; i < blockMatches.length && hits.length < pageSize; i += 1) {
      const block = blockMatches[i]?.[0] || ''
      const href = block.match(/<a[^>]+href=["']([^"']+\/item\/[^"']+)["']/i)?.[1]
      const title =
        block.match(/alt=["']([^"']{3,180})["']/i)?.[1] ||
        block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, ' ').trim()
      const rawPrice =
        block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
        block.match(/"price"\s*:\s*"([\d.,]+)"/i)?.[1] ||
        null
      const imageUrl = pickBestImage(
        [block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
        'https://fril.jp'
      )
      const productUrl = href ? new URL(href, 'https://fril.jp').toString() : null

      if (!title || !productUrl) continue
      hits.push(
        buildHit({
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
      )
    }

    if (hits.length > 0) return hits
  } catch {
    // fallback below
  }

  const jinaText = await fetchViaJina(searchUrl, 7000)
  const fallbackHits = parseJinaHits(jinaText, 'https://fril.jp', 'JPY')
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
