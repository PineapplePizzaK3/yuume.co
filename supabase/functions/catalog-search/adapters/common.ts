import { parsePrice, toAbsoluteUrl } from '../lib/normalize.ts'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eiko-dls.com)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,pt-BR;q=0.7',
}

export async function fetchText(url: string, timeoutMs: number = 6000): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

export async function fetchViaJina(url: string, timeoutMs: number = 6000): Promise<string> {
  const parsed = new URL(url)
  const jinaUrl = `https://r.jina.ai/http://${parsed.hostname}${parsed.pathname}${parsed.search}`
  const res = await fetch(jinaUrl, {
    method: 'GET',
    headers: {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      'Accept': 'text/plain,text/markdown,*/*',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`JINA_HTTP_${res.status}`)
  return await res.text()
}

export function collectImageCandidates(html: string): string[] {
  const imgMatches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1])
  const metaMatches = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
  ].filter(Boolean) as string[]
  return [...imgMatches, ...metaMatches]
}

export function parseJinaHits(text: string, baseUrl: string, fallbackCurrency: string): Array<{
  title: string
  productUrl: string
  price: number | null
  currency: string
}> {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const hits: Array<{ title: string; productUrl: string; price: number | null; currency: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const linkMatch = line.match(/\[([^\]]{3,180})\]\((https?:\/\/[^\s)]+)\)/)
    if (!linkMatch) continue

    const title = linkMatch[1]?.trim()
    const productUrl = toAbsoluteUrl(linkMatch[2], baseUrl)
    if (!title || !productUrl) continue

    const windowText = [lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(' ')
    const rawPrice =
      windowText.match(/(?:¥|￥|JPY)\s*([\d.,]+)/i)?.[1] ||
      windowText.match(/(?:R\$|BRL)\s*([\d.,]+)/i)?.[1] ||
      null

    const currency = /R\$|BRL/i.test(windowText) ? 'BRL' : fallbackCurrency
    hits.push({
      title,
      productUrl,
      price: parsePrice(rawPrice),
      currency,
    })
  }

  return hits
}
