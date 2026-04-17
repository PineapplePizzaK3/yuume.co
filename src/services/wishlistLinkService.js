/**
 * Wishlist links - itens adicionados por URL com scraping de nome/preço.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const FUNCOES_SCRAPE = ['scrape-product', 'scrape_product']
const LOW_CONFIDENCE_THRESHOLD = 0.66
const SCRAPE_BLOCK_PATTERNS = [
  /ご迷惑をおかけしています/i,
  /enter the characters you see below/i,
  /type the characters you see in this image/i,
  /robot check/i,
  /captcha/i,
  /access denied/i,
  /temporarily unavailable/i,
  /申し訳ございません/i,
]

function buildScrapeMeta(overrides = {}) {
  return {
    confidence: 0,
    source: 'unknown',
    warnings: [],
    requiresReview: true,
    lowConfidence: true,
    layersTried: [],
    failureCode: null,
    ...overrides,
  }
}

function parsePriceLoose(value) {
  if (value == null) return null
  let text = String(value).trim()
  if (!text) return null
  text = text.replace(/[^\d.,-]/g, '')
  if (!text) return null
  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function hasScrapeBlockSignals(text) {
  const content = String(text || '')
  return SCRAPE_BLOCK_PATTERNS.some((re) => re.test(content))
}

function isLikelyBadProductName(name) {
  const value = String(name || '').trim()
  if (!value) return true
  if (value.length < 4) return true
  const generic = [
    /^produto$/i,
    /^item$/i,
    /^home$/i,
    /^amazon(\.[a-z.]+)?$/i,
    /^error$/i,
    /^access denied$/i,
    /^sorry!?/i,
  ]
  return generic.some((re) => re.test(value))
}

function getProductHints(pageUrl) {
  const path = String(pageUrl?.pathname || '').toLowerCase()
  const slug = path.split('/').filter(Boolean).pop() || ''
  const codes = [...slug.matchAll(/(\d{5,})/g)].map((m) => m[1])
  const words = slug
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
  return {
    slug,
    codes,
    words,
  }
}

function scorePriceContext(context) {
  const c = String(context || '').toLowerCase()
  let score = 0
  if (/(通常価格|セール価格|販売価格|price|preço|税込み|単価)/i.test(c)) score += 6
  if (/(cart|カートに入れる|購入手続き|商品コード|sku|在庫)/i.test(c)) score += 2
  if (/(以上|送料無料|送料|ノベルティ|特典|プレゼント)/i.test(c)) score -= 7
  if (/(faq|お問い合わせ|ガイド|site info|利用規約)/i.test(c)) score -= 3
  return score
}

function parsePriceNearProductCode(text, pageUrl) {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  for (const code of hints.codes) {
    const codeBlock = new RegExp(`(?:SKU\\s*[:：]?\\s*${code}|商品コード[^\\n]{0,40}${code})[\\s\\S]{0,260}?([\\d][\\d,.]*)\\s*円`, 'i')
    const codeBefore = content.match(codeBlock)
    if (codeBefore?.[1]) {
      const parsed = parsePriceLoose(codeBefore[1])
      if (parsed != null) return parsed
    }
    const priceBefore = new RegExp(`([\\d][\\d,.]*)\\s*円[\\s\\S]{0,220}(?:SKU\\s*[:：]?\\s*${code}|商品コード[^\\n]{0,40}${code})`, 'i')
    const codeAfter = content.match(priceBefore)
    if (codeAfter?.[1]) {
      const parsed = parsePriceLoose(codeAfter[1])
      if (parsed != null) return parsed
    }
  }
  return null
}

function pickBestJinaPrice(text, pageUrl) {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  const directPrice = parsePriceNearProductCode(content, pageUrl)
  if (directPrice != null) return { price: directPrice, currency: 'JPY', score: 999, index: 0 }
  const regex = /(?:¥|￥)?\s*([\d][\d,.]*)\s*円|(?:¥|JPY)\s*([\d,]+(?:\.\d+)?)|(?:R\$|BRL)\s*([\d.,]+)|(?:price|preço)\s*[:：]?\s*([\d.,]+)/gi
  const candidates = []
  let match
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1] || match[2] || match[3] || match[4]
    const parsed = parsePriceLoose(raw)
    if (!parsed) continue
    const start = Math.max(0, match.index - 110)
    const end = Math.min(content.length, match.index + 110)
    const context = content.slice(start, end)
    let score = scorePriceContext(context)
    if (context.toLowerCase().includes(pageUrl.pathname.toLowerCase())) score += 8
    if (hints.codes.some((code) => context.includes(code))) score += 4
    if (/\/products\/n-\d+-\d{5,}/i.test(context)) {
      const otherCodes = [...context.matchAll(/\/products\/n-\d+-(\d{5,})/gi)].map((m) => m[1])
      if (otherCodes.some((code) => !hints.codes.includes(code))) score -= 8
    }
    if (parsed > 0 && parsed <= 20000) score += 1
    if (parsed >= 50000) score -= 2
    candidates.push({
      price: parsed,
      score,
      currency: /R\$|BRL/i.test(match[0] || '') ? 'BRL' : 'JPY',
      index: match.index,
    })
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index)
  return candidates[0] || null
}

function pickJinaImages(text, pageUrl, limit = 10) {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  const markdownMatches = [...content.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)].map((m) => ({
    alt: m[1] || '',
    url: m[2],
    index: m.index || 0,
  }))
  const rawImageMatches = [...content.matchAll(/https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s)"']*)?/gi)].map((m) => ({
    alt: '',
    url: m[0],
    index: m.index || 0,
  }))
  const merged = [...markdownMatches, ...rawImageMatches]
  const seen = new Set()
  const keyOf = (input) => {
    try {
      const parsed = new URL(input)
      parsed.searchParams.delete('width')
      parsed.searchParams.delete('height')
      return `${parsed.origin}${parsed.pathname}`
    } catch {
      return input
    }
  }
  const candidates = merged.filter((entry) => {
    if (!entry?.url) return false
    const key = keyOf(entry.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const host = String(pageUrl?.hostname || '').toLowerCase()
  const scored = candidates
    .map((entry) => {
      const lower = entry.url.toLowerCase()
      const start = Math.max(0, entry.index - 120)
      const end = Math.min(content.length, entry.index + 120)
      const context = content.slice(start, end)
      let score = 0
      if (/\/images\/i\//i.test(lower)) score += 5
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 3
      if (/(cdn\.shopify\.com|\/cdn\/shop\/files\/|\/products\/)/i.test(lower)) score += 3
      if (/(menuimage|footer|banner|popup|totop|icon-|icon_|logo)/i.test(lower)) score -= 8
      if (/(small|thumb|thumbnail|sprite|icon|logo|placeholder|captcha|spinner|loading)/i.test(lower)) score -= 4
      if (host.includes('amazon.') && /(images-na\.ssl-images-amazon|m\.media-amazon)/i.test(lower)) score += 2
      if (/モーダルでメディア|media \(\d+\)|商品情報|商品コード|sku/i.test(context)) score += 6
      if (hints.codes.some((code) => lower.includes(code) || context.includes(code))) score += 6
      if (hints.words.some((w) => context.toLowerCase().includes(w) || lower.includes(w))) score += 2
      return { url: entry.url, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored
    .filter((entry) => entry.score >= 3)
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.url)
}

function extractFromJinaText(text, pageUrl) {
  const blocked = hasScrapeBlockSignals(text)
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let name = String(text || '').match(/(?:^|\n)Title:\s*(.+)/i)?.[1]?.trim() || 'Produto'
  const skipLine = /^(URL Source|Markdown Content|Warning|http[s]?:\/\/)/i
  if (!name || name === 'Produto') {
    for (const line of lines) {
      if (skipLine.test(line)) continue
      if (hasScrapeBlockSignals(line)) continue
      if (line.length >= 6 && line.length <= 180) {
        name = line.replace(/^#{1,6}\s*/, '').trim()
        break
      }
    }
  }
  if (blocked || hasScrapeBlockSignals(name)) name = 'Produto'

  const imageUrls = pickJinaImages(text, pageUrl, 10)
  const imageUrl = imageUrls[0] || null

  const bestPrice = pickBestJinaPrice(text, pageUrl)
  const price = bestPrice?.price ?? null
  const currency = bestPrice?.currency || 'JPY'
  return { name, price, currency, imageUrl, imageUrls, blocked, badName: isLikelyBadProductName(name) }
}

function normalizeProductName(rawName, pageUrl) {
  const raw = String(rawName || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Produto'
  let name = raw
  const host = pageUrl.hostname.toLowerCase()
  if (host.includes('amazon.')) {
    name = name.replace(/^amazon\.[^:]+:\s*/i, '')
    name = name.replace(/\s*[:|\-|｜]\s*amazon\.[^\s]+.*$/i, '')
  }
  if (host.includes('mercari.')) {
    name = name.replace(/\s*[:|\-|｜]\s*mercari.*$/i, '')
  }
  name = name
    .replace(/\s*[:|\-|｜]\s*(Amazon|Mercari|Rakuten|Yahoo!?\s*ショッピング|Yahoo!? Shopping).*$/i, '')
    .trim()
  return name.length >= 3 ? name : raw
}

async function scrapeFallbackViaJina(url) {
  try {
    const parsed = new URL(url)
    const jinaUrl = `https://r.jina.ai/http://${parsed.hostname}${parsed.pathname}${parsed.search}`
    const res = await fetch(jinaUrl, { method: 'GET' })
    if (!res.ok) return { data: null, error: { message: 'Fallback indisponível para este link.' } }
    const text = await res.text()
    const extracted = extractFromJinaText(text, parsed)
    extracted.name = normalizeProductName(extracted.name, parsed)
    const isMarketplaceStrict = /(^|\.)amazon\./i.test(parsed.hostname) || /(^|\.)mercari\./i.test(parsed.hostname)
    if (extracted.blocked) {
      return { data: null, error: { message: 'Página com bloqueio/CAPTCHA detectada. Use adição manual.', failureCode: 'blocked' } }
    }
    if (isMarketplaceStrict && (!extracted?.price || extracted.badName)) {
      return {
        data: null,
        error: {
          message: 'Não foi possível extrair dados confiáveis automaticamente deste link. Use adição manual.',
          failureCode: 'low_confidence',
        },
      }
    }
    if (!extracted?.price && (extracted?.name === 'Produto' || extracted.badName)) {
      return { data: null, error: { message: 'Não foi possível extrair dados desse link automaticamente.', failureCode: 'not_found' } }
    }
    return {
      data: {
        name: extracted.name,
        price: extracted.price,
        currency: extracted.currency,
        imageUrl: extracted.imageUrl || null,
        imageUrls: Array.isArray(extracted.imageUrls) ? extracted.imageUrls : [],
        meta: buildScrapeMeta({
          confidence: extracted.price ? 0.62 : 0.48,
          source: 'jina',
          warnings: extracted.price
            ? ['Dados obtidos por fallback textual (revisar).']
            : ['Preço ausente no fallback textual.'],
          requiresReview: true,
          lowConfidence: true,
          layersTried: ['client:jina'],
        }),
      },
      error: null,
    }
  } catch {
    return { data: null, error: { message: 'Não foi possível extrair dados desse link automaticamente.', failureCode: 'network' } }
  }
}

async function normalizeInvokeError(err) {
  const status = err?.context?.status
  const rawMessage = String(err?.message || '')
  const lowerMessage = rawMessage.toLowerCase()
  let backendMessage = ''
  try {
    if (err?.context) {
      const clone = err.context.clone?.() || err.context
      const asJson = await clone.json?.()
      backendMessage = asJson?.error || asJson?.message || ''
      if (!backendMessage) {
        const asText = await clone.text?.()
        backendMessage = asText || ''
      }
    }
  } catch {
    // ignore parse errors
  }

  if (status === 401 || status === 403) {
    return { message: 'Sessão expirada ou sem permissão para chamar o scraper. Faça login novamente.', failureCode: 'auth' }
  }
  if (status === 404) {
    return { message: 'Função scrape-product não encontrada no Supabase (deploy pendente ou nome divergente).', failureCode: 'not_found' }
  }
  if (
    lowerMessage.includes('failed to send a request to the edge function')
    || lowerMessage.includes('fetch failed')
    || lowerMessage.includes('networkerror')
    || lowerMessage.includes('network request failed')
  ) {
    return { message: 'Falha de rede ao chamar o scraper. Tentando fallback textual...', failureCode: 'network' }
  }
  if (backendMessage) return { message: backendMessage, failureCode: 'backend' }
  if (status) return { message: `Erro no scraper (HTTP ${status}).`, failureCode: 'http_error' }
  return { message: rawMessage || 'Erro ao buscar dados', failureCode: 'unknown' }
}

/**
 * Chama a Edge Function para extrair nome/preço de uma URL.
 * Timeout de 25s para evitar carregamento infinito.
 */
export async function scrapeProductUrl(url) {
  const TIMEOUT_MS = 25000
  const parsedUrl = new URL(url)
  const isMarketplaceStrict = /(^|\.)amazon\./i.test(parsedUrl.hostname) || /(^|\.)mercari\./i.test(parsedUrl.hostname)
  let lastError = null
  for (const funcName of FUNCOES_SCRAPE) {
    const invokePromise = supabase.functions.invoke(funcName, { body: { url } })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo esgotado. Tente novamente.')), TIMEOUT_MS)
    )
    try {
      const result = await Promise.race([invokePromise, timeoutPromise])
      const { data, error } = result ?? {}
      if (error) {
        lastError = await normalizeInvokeError(error)
        // tenta o próximo nome de função quando a rota não existir
        if (lastError?.message?.includes('não encontrada')) continue
      } else if (data?.error) {
        lastError = { message: data.error, failureCode: data?.error_code || 'backend' }
      } else {
        const normalized = {
          name: data?.name ? normalizeProductName(data.name, parsedUrl) : 'Produto',
          price: data?.price != null ? Number(data.price) : null,
          currency: data?.currency || 'JPY',
          imageUrl: data?.imageUrl || null,
          imageUrls: Array.isArray(data?.imageUrls)
            ? data.imageUrls.filter(Boolean)
            : (data?.imageUrl ? [data.imageUrl] : []),
          meta: buildScrapeMeta({
            confidence: Number.isFinite(Number(data?.confidence)) ? Number(data.confidence) : 0,
            source: data?.source || funcName,
            warnings: Array.isArray(data?.warnings) ? data.warnings.filter(Boolean) : [],
            requiresReview: Boolean(data?.diagnostics?.requiresReview),
            lowConfidence:
              typeof data?.diagnostics?.lowConfidence === 'boolean'
                ? data.diagnostics.lowConfidence
                : (Number(data?.confidence) || 0) < LOW_CONFIDENCE_THRESHOLD,
            layersTried: Array.isArray(data?.diagnostics?.layersTried) ? data.diagnostics.layersTried : [],
          }),
        }
        if (isMarketplaceStrict && (normalized.price == null || Number(normalized.price) <= 0)) {
          lastError = { message: 'Não foi possível extrair o preço automaticamente deste link. Use adição manual.' }
          continue
        }
        return { data: normalized, error: null }
      }
    } catch (e) {
      lastError = { message: e?.message || 'Erro ao buscar dados', failureCode: 'network' }
      if (!String(lastError.message).includes('Tempo esgotado')) continue
    }
  }

  // Fallback específico para sites que bloqueiam scraping server-side (ex.: Amazon/Mercari).
  const fallback = await scrapeFallbackViaJina(url)
  if (!fallback.error) return fallback

  const shouldPreferFallback =
    !lastError
    || ['unknown', 'network', 'backend'].includes(String(lastError.failureCode || '').toLowerCase())
  return {
    data: null,
    error: shouldPreferFallback
      ? (fallback.error || lastError || { message: 'Erro ao buscar dados', failureCode: 'unknown' })
      : (lastError || fallback.error || { message: 'Erro ao buscar dados', failureCode: 'unknown' }),
  }
}

export async function getWishlistLinks(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function addWishlistLink(userId, { url, product_name, price, currency, image_url }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .insert({
          user_id: userId,
          url,
          product_name,
          price: price ?? null,
          previous_price: null,
          currency: currency ?? 'JPY',
          image_url: image_url ?? null,
          last_checked_at: new Date().toISOString(),
        })
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateWishlistLink(userId, id, { url, product_name, price, previous_price, image_url, currency }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .update({
          url: url ?? undefined,
          product_name: product_name ?? undefined,
          price: price ?? undefined,
          previous_price: previous_price ?? undefined,
          image_url: image_url ?? undefined,
          currency: currency ?? undefined,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeWishlistLink(userId, id) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}
