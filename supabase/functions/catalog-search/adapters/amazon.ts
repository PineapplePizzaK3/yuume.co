import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage, amazonTagsFromBlock } from '../normalize.ts'
import { collectImageCandidates, fetchText, FETCH_TIMEOUT_MS } from './common.ts'

const STORE_ID = 'amazon'
const STORE_NAME = 'Amazon JP'
const BASE = 'https://www.amazon.co.jp'

/** Blocos de resultado com ASIN (estrutura atual da busca Amazon JP). */
const SEARCH_RESULT_BLOCK_RE =
  /<div[^>]+data-asin=["']([A-Z0-9]{10})["'][^>]*data-component-type=["']s-search-result["'][\s\S]*?(?=<div[^>]+data-asin=["'][A-Z0-9]{10}["'][^>]*data-component-type=["']s-search-result["']|$)/gi

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function extractAmazonTitle(block: string): string | null {
  const span = block
    .match(/<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    ?.replace(/<[^>]+>/g, ' ')
    .trim()
  const aria = block.match(/<h2[^>]+aria-label=["']([^"']+)["']/i)?.[1]?.trim()
  let title = span || aria || null
  if (!title) return null

  title = decodeHtmlEntities(title)
    .replace(/^(スポンサー広告\s*[-–—|:]\s*|スポンサー\s*[-–—|:]\s*)/i, '')
    .replace(/^(Sponsored\s*[-–—|:]\s*)/i, '')
    .trim()

  if (/スポンサー情報を表示|広告フィードバック|sponsored ad feedback/i.test(title)) return null
  if (/^!\[|^\[Image\s+\d/i.test(title)) return null
  if (title.length < 3) return null
  return title
}

function extractAmazonPrice(block: string): number | null {
  const offscreen = block.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<]+)/i)?.[1]
  if (offscreen) {
    const parsed = parsePrice(offscreen)
    if (parsed != null) return parsed
  }
  const whole = block.match(/a-price-whole[^>]*>([\d,]+)/i)?.[1]
  const frac = block.match(/a-price-fraction[^>]*>(\d+)/i)?.[1]
  if (whole != null) {
    const raw = frac != null ? `${whole}.${frac}` : whole
    return parsePrice(raw)
  }
  const yen = block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1]
  return parsePrice(yen)
}

function extractAmazonImage(block: string): string | null {
  const srcsetFirst = block
    .match(/<img[^>]+class=["'][^"']*s-image[^"']*["'][^>]+srcset=["']([^"']+)["']/i)?.[1]
    ?.split(',')?.[0]
    ?.trim()
    ?.split(/\s+/)?.[0]
  const candidates = [
    block.match(/<img[^>]+class=["'][^"']*s-image[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1],
    block.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*s-image/i)?.[1],
    srcsetFirst,
    block.match(/data-image-source-src=["']([^"']+)["']/i)?.[1],
    ...collectImageCandidates(block),
  ]
  return pickBestImage(candidates, BASE)
}

function isAmazonBlockedPage(html: string): boolean {
  if (html.length < 20_000 && /captcha|robot check|type the characters you see/i.test(html)) return true
  if (html.length < 8_000 && /continue-shopping\.gif/i.test(html)) return true
  return false
}

function hitsFromSearchHtml(html: string, pageSize: number): UnifiedSearchHit[] {
  const hits: UnifiedSearchHit[] = []
  const seenAsin = new Set<string>()

  for (const match of html.matchAll(SEARCH_RESULT_BLOCK_RE)) {
    const asin = match[1]
    if (!asin || asin === '0000000000' || seenAsin.has(asin)) continue

    const block = match[0]
    const title = extractAmazonTitle(block)
    if (!title) continue

    const productUrl = `${BASE}/dp/${asin}`
    const price = extractAmazonPrice(block)
    const imageUrl = extractAmazonImage(block)
    const tags = amazonTagsFromBlock(block)

    seenAsin.add(asin)
    hits.push(
      buildHit({
        id: `${STORE_ID}-${asin}`,
        title,
        price,
        currency: 'JPY',
        imageUrl,
        productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'html',
        tags: tags.length ? tags : undefined,
      }),
    )

    if (hits.length >= pageSize) break
  }

  return hits
}

export async function searchAmazon(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `${BASE}/s?k=${encoded}`

  try {
    const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, {
      Referer: `${BASE}/`,
    })
    if (isAmazonBlockedPage(html)) {
      throw new Error('Amazon bloqueou ou limitou a consulta (página de verificação).')
    }
    const hits = hitsFromSearchHtml(html, pageSize)
    if (hits.length > 0) return hits
  } catch {
    // sem fallback Jina: respostas da Jina para Amazon costumam ser página de bloqueio
    // com markdown ![Image 1] e sem preço/imagem úteis
  }

  return []
}
