import { parsePrice, toAbsoluteUrl } from '../normalize.ts'

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,pt-BR;q=0.7',
}

/** HTML direto: lojas no Japão costumam responder lentas; Jina costuma ser ainda mais lenta. */
export const FETCH_TIMEOUT_MS = 18_000
export const JINA_TIMEOUT_MS = 32_000

function isTimeoutError(e: unknown): boolean {
  const s = String(e ?? '')
  const name = (e as Error)?.name ?? ''
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /timeout|aborted|signal/i.test(s)
  )
}

export async function fetchText(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string> {
  const run = async (ms: number) => {
    const res = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(ms),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  }
  try {
    return await run(timeoutMs)
  } catch (e) {
    if (isTimeoutError(e)) {
      return await run(Math.min(timeoutMs + 14_000, 40_000))
    }
    throw e
  }
}

export async function fetchViaJina(url: string, timeoutMs: number = JINA_TIMEOUT_MS): Promise<string> {
  const parsed = new URL(url)
  const jinaUrl = `https://r.jina.ai/http://${parsed.hostname}${parsed.pathname}${parsed.search}`
  const run = async (ms: number) => {
    const res = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        'Accept': 'text/plain,text/markdown,*/*',
      },
      signal: AbortSignal.timeout(ms),
    })
    if (!res.ok) throw new Error(`JINA_HTTP_${res.status}`)
    return await res.text()
  }
  try {
    return await run(timeoutMs)
  } catch (e) {
    if (isTimeoutError(e)) {
      return await run(Math.min(timeoutMs + 16_000, 55_000))
    }
    throw e
  }
}

export function collectImageCandidates(html: string): string[] {
  const imgMatches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1])
  const metaMatches = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
  ].filter(Boolean) as string[]
  return [...imgMatches, ...metaMatches]
}

export function queryTokens(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

function hasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
}

function latinCoverage(text: string): number {
  const chars = String(text || '').replace(/\s+/g, '')
  if (!chars) return 0
  const latin = chars.match(/[a-z0-9]/gi)?.length ?? 0
  return latin / chars.length
}

export function matchesQuery(title: string, query: string): boolean {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return true
  const text = String(title || '').toLowerCase()
  if (!text) return false
  const matched = tokens.filter((t) => text.includes(t)).length
  // Regra mais rígida para reduzir falsos positivos:
  // - 1 token: 1
  // - 2 tokens: 2
  // - 3+ tokens: ~75% dos tokens
  let needed =
    tokens.length <= 2
      ? tokens.length
      : Math.max(2, Math.ceil(tokens.length * 0.75))

  // Quando a query é latina e o título vem majoritariamente em JP (CJK),
  // relaxa 1 ponto para não perder resultados legítimos traduzidos/romanizados.
  const queryLooksLatin = /^[a-z0-9\s\-_.]+$/i.test(String(query || '').trim())
  const titleMostlyNonLatin = hasCjk(text) && latinCoverage(text) < 0.45
  if (queryLooksLatin && titleMostlyNonLatin) {
    needed = Math.max(1, needed - 1)
  }
  return matched >= needed
}

function hasImageLikeExt(url: string): boolean {
  return /\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?|$)/i.test(url)
}

export function isMercariProductUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!/(^|\.)mercari\.com$/i.test(u.hostname)) return false
    if (!/^\/item\/m[a-z0-9]+$/i.test(u.pathname)) return false
    if (hasImageLikeExt(u.pathname)) return false
    return true
  } catch {
    return false
  }
}

export function isRakumaProductUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!/(^|\.)fril\.jp$/i.test(u.hostname)) return false
    if (!/^\/item\/[a-z0-9]+$/i.test(u.pathname)) return false
    if (hasImageLikeExt(u.pathname)) return false
    return true
  } catch {
    return false
  }
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

  const priceFrom = (chunk: string) =>
    chunk.match(/(?:¥|￥|JPY)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
    chunk.match(/([\d,]+(?:\.\d+)?)\s*(?:円|yen)/i)?.[1] ||
    chunk.match(/(?:R\$|BRL)\s*([\d.,]+)/i)?.[1] ||
    null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const linkMatch = line.match(/\[([^\]]{3,180})\]\((https?:\/\/[^\s)]+)\)/)
    if (!linkMatch) continue

    const title = linkMatch[1]?.trim()
    const productUrl = toAbsoluteUrl(linkMatch[2], baseUrl)
    if (!title || !productUrl) continue

    const windowText = [lines[i - 1], lines[i], lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean).join(' ')
    const rawPrice = priceFrom(windowText)

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

/** Mercari JP entrega dados em __NEXT_DATA__; o HTML estático quase não tem preço. */
export function extractMercariHitsFromNextData(html: string, pageSize: number, query: string): Array<{
  title: string
  productUrl: string
  price: number | null
  imageUrl: string | null
}> {
  const raw = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (!raw) return []

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }

  const out: Array<{ title: string; productUrl: string; price: number | null; imageUrl: string | null }> = []
  const seen = new Set<string>()

  const thumb = (o: Record<string, unknown>): string | null => {
    const th = o.thumbnails
    if (Array.isArray(th) && typeof th[0] === 'string') return th[0]
    const ph = o.photos
    if (Array.isArray(ph) && ph[0] && typeof ph[0] === 'object') {
      const p0 = ph[0] as Record<string, unknown>
      const u = p0.imageUrl ?? p0.uri ?? p0.url
      if (typeof u === 'string') return u
    }
    return null
  }

  const visit = (obj: unknown, depth: number) => {
    if (depth > 28 || out.length >= pageSize * 3) return
    if (obj == null || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const x of obj) visit(x, depth + 1)
      return
    }
    const o = obj as Record<string, unknown>
    const rawId = o.itemId ?? o.id
    const name = o.name ?? o.title
    let priceVal: unknown = o.price ?? o.itemPrice ?? o.instantPrice ?? o.salePrice
    if (typeof priceVal === 'string') priceVal = Number(priceVal.replace(/[^\d.]/g, ''))

    let mercariPath: string | null = null
    if (typeof rawId === 'string' && /^m\d+$/.test(rawId)) mercariPath = rawId
    else if (typeof rawId === 'string' && /^\d+$/.test(rawId)) mercariPath = `m${rawId}`
    else if (typeof rawId === 'number' && rawId > 0) mercariPath = `m${rawId}`

    if (
      typeof name === 'string' &&
      name.length >= 2 &&
      mercariPath != null &&
      typeof priceVal === 'number' &&
      Number.isFinite(priceVal) &&
      priceVal > 0
    ) {
      const url = `https://jp.mercari.com/item/${mercariPath}`
      if (!isMercariProductUrl(url)) return
      if (!matchesQuery(name, query)) return
      if (seen.has(url)) return
      seen.add(url)
      out.push({
        title: name.trim(),
        productUrl: url,
        price: Math.round(priceVal),
        imageUrl: thumb(o),
      })
    }
    for (const v of Object.values(o)) visit(v, depth + 1)
  }

  visit(data, 0)
  return out.slice(0, pageSize * 2)
}
