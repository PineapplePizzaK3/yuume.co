import { fetchText } from './adapters/common.ts'
import { fetchMercariItemPhotos } from './adapters/mercariApi.ts'
import { pickProductImages } from './normalize.ts'
import type { StoreId } from './types.ts'

const GALLERY_TIMEOUT_MS = 10_000

function unescapeMarkup(html: string): string {
  return String(html || '')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\\+$/g, '')
}

function cleanUrl(url: string): string {
  return String(url || '')
    .trim()
    .replace(/\\+$/g, '')
    .replace(/&amp;/gi, '&')
}

function urlsMatching(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re))
    .map((match) => cleanUrl(match[1] || match[0]))
    .filter(Boolean)
}

function resolveStore(pageUrl: URL): StoreId | null {
  const host = pageUrl.hostname.toLowerCase()
  if (/(^|\.)amazon\.(co\.jp|com)$/.test(host)) return 'amazon'
  if (/(^|\.)fril\.jp$/.test(host)) return 'rakuma'
  if (/(^|\.)mercari\.com$/.test(host)) return 'mercari'
  if (/(^|\.)auctions\.yahoo\.co\.jp$/.test(host)) return 'yahoo'
  if (/(^|\.)paypayfleamarket\.yahoo\.co\.jp$/.test(host)) return 'yahoo_flea'
  if (/(^|\.)snkrdunk\.com$/.test(host)) return 'snkrdunk'
  return null
}

function extractAmazonGallery(html: string, pageUrl: URL): string[] {
  const text = unescapeMarkup(html)
  const start = text.search(/colorImages\s*['"]?\s*:/)
  if (start < 0) return []
  const slice = text.slice(start, start + 60_000)
  const end = slice.search(/colorToAsin|landingAsinColor/)
  const block = end > 0 ? slice.slice(0, end) : slice.slice(0, 25_000)
  const hiRes = urlsMatching(block, /"hiRes"\s*:\s*"(https:[^"]+)"/g).filter(Boolean)
  const large = hiRes.length
    ? []
    : urlsMatching(block, /"large"\s*:\s*"(https:[^"]+)"/g).filter(Boolean)
  // Only the main colorImages block — never page-wide dynamic images (related products).
  return pickProductImages(hiRes.length ? hiRes : large, pageUrl.origin)
}

/**
 * Fril/Rakuma: fotos ficam em img.fril.jp/img/{itemId}/[lms]/{photoId}.jpg
 * O hash da URL do anúncio NÃO aparece no path da imagem.
 */
function extractRakumaGallery(html: string, pageUrl: URL): string[] {
  const text = unescapeMarkup(html)
  const matches = Array.from(
    text.matchAll(/https:\/\/img\.fril\.jp\/img\/(\d+)\/([lms])\/(\d+)\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi),
  )
  if (!matches.length) return []

  const og =
    text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    ''
  const ogItemId = og.match(/\/img\/(\d+)\//)?.[1] || ''
  if (!ogItemId) {
    // Without og:image we cannot safely tell the listing photos from related items.
    const first = matches[0]
    if (!first) return []
    const onlyFirst = cleanUrl(first[0])
    return pickProductImages([onlyFirst], pageUrl.origin)
  }

  type Shot = { url: string; size: string; photoId: string }
  const shots: Shot[] = []
  for (const match of matches) {
    if (match[1] !== ogItemId) continue
    shots.push({ url: cleanUrl(match[0]), size: match[2], photoId: match[3] })
  }
  if (!shots.length) return pickProductImages([og], pageUrl.origin)

  const bestByPhoto = new Map<string, { url: string; rank: number }>()
  const sizeRank = (size: string) => (size === 'l' ? 3 : size === 'm' ? 2 : 1)
  for (const shot of shots) {
    const prev = bestByPhoto.get(shot.photoId)
    const rank = sizeRank(shot.size)
    if (!prev || rank > prev.rank) bestByPhoto.set(shot.photoId, { url: shot.url, rank })
  }

  return pickProductImages(
    [...bestByPhoto.values()].map((row) => row.url),
    pageUrl.origin,
  )
}

function extractYahooAuctionGallery(html: string, pageUrl: URL): string[] {
  const text = unescapeMarkup(html)
  const gallery =
    text.match(/id=["']imagebox["'][\s\S]{0,40000}/i)?.[0] ||
    text.match(/class=["'][^"']*ProductImage[^"']*["'][\s\S]{0,25000}/i)?.[0] ||
    ''
  if (!gallery) return []
  // Prefer explicit product image tags inside the gallery, not every yimg asset.
  const fromImgs = urlsMatching(
    gallery,
    /<img[^>]+(?:src|data-src)=["'](https:\/\/[^"']*yimg\.jp[^"']+)["']/gi,
  )
  const fromAny = fromImgs.length
    ? fromImgs
    : urlsMatching(gallery, /https:\/\/[^"'\\\s<>]*yimg\.jp\/[^"'\\\s<>]+/gi)
  const urls = fromAny.filter(
    (url) =>
      /images\.auctions\.yahoo|auc-pctr|auction.*\/image\//i.test(url) &&
      !/(icon|logo|avatar|sprite|loading|1x1|clear\.gif|spaceball|transparent)/i.test(url),
  )
  return pickProductImages(urls, pageUrl.origin)
}

function extractYahooFleaGallery(html: string, pageUrl: URL): string[] {
  const itemId = pageUrl.pathname.split('/').filter(Boolean).pop() || ''
  if (!itemId) return []
  const text = unescapeMarkup(html)
  const next =
    text.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || ''
  if (!next) return []
  const idx = next.indexOf(itemId)
  if (idx < 0) return []
  const windowText = next.slice(Math.max(0, idx - 200), idx + 12_000)
  const urls = urlsMatching(windowText, /https:\/\/[^"'\\\s<>]*yimg\.jp\/[^"'\\\s<>]+/gi).filter(
    (url) =>
      /fleamarket|paypay|item|product|images/i.test(url) &&
      !/(icon|logo|avatar|sprite|loading|1x1|clear\.gif|spaceball|transparent)/i.test(url),
  )
  return pickProductImages(urls, pageUrl.origin)
}

function extractSnkrdunkGallery(html: string, pageUrl: URL): string[] {
  const text = unescapeMarkup(html)
  const slug = pageUrl.pathname.split('/').filter(Boolean).pop() || ''
  let best: string[] = []
  for (const match of text.matchAll(/\[(?:\s*"https:\/\/cdn\.snkrdunk\.com\/[^"]+"\s*,?){1,24}\s*\]/g)) {
    const urls = urlsMatching(match[0], /https:\/\/cdn\.snkrdunk\.com\/[^"]+/g).filter(
      (url) => !/\/assets\/|logo|icon|avatar/i.test(url),
    )
    if (urls.length > best.length) best = urls
  }
  if (!best.length) {
    const cut = text.search(/relatedProducts|recommendItems|similarItems/i)
    const head = cut > 0 ? text.slice(0, cut) : text.slice(0, 80_000)
    best = urlsMatching(head, /"imageUrl"\s*:\s*"(https:\/\/cdn\.snkrdunk\.com\/[^"]+)"/g).filter(
      (url) => !/\/assets\/|logo|icon|avatar/i.test(url),
    )
  }
  // Keep only product media; if slug is present prefer urls near product context.
  if (slug && best.length > 8) {
    const narrowed = best.filter((url) => url.includes(slug) || /upload_bg_removed|product|apparel/i.test(url))
    if (narrowed.length) best = narrowed
  }
  return pickProductImages(best, pageUrl.origin)
}

/** Mercari resized CDN paths often 404/blank — rewrite to full-size orig. */
function mercariToOrig(url: string, itemId: string): string | null {
  const clean = cleanUrl(url)
  if (!clean || !itemId) return null
  const photo =
    clean.match(new RegExp(`(photos\\/${itemId}_\\d+\\.(?:jpg|jpeg|png|webp))`, 'i'))?.[1] ||
    clean.match(/(photos\/m\d+_\d+\.(?:jpg|jpeg|png|webp))/i)?.[1]
  if (photo && photo.toLowerCase().includes(itemId.toLowerCase())) {
    return `https://static.mercdn.net/item/detail/orig/${photo}`
  }
  if (
    clean.includes(itemId) &&
    /mercdn\.net/i.test(clean) &&
    !/\/c!\//i.test(clean) &&
    !/\/thumb\//i.test(clean)
  ) {
    return clean
  }
  return null
}

function extractMercariPhotosFromHtml(text: string, itemId: string): string[] {
  if (!itemId) return []
  const out: string[] = []
  // Full CDN URLs embedded in the page / JSON.
  for (const url of urlsMatching(
    text,
    new RegExp(`https://[^"'\\s<>]*${itemId}_\\d+\\.[a-z0-9]+(?:\\?[^"'\\s<>]*)?`, 'gi'),
  )) {
    out.push(url)
  }
  // SPA payloads often only have relative photo paths.
  for (const match of text.matchAll(
    new RegExp(`photos\\/(${itemId}_\\d+\\.(?:jpg|jpeg|png|webp))`, 'gi'),
  )) {
    out.push(`https://static.mercdn.net/item/detail/orig/photos/${match[1]}`)
  }
  return out
}

async function mercariGallery(pageUrl: URL): Promise<string[]> {
  const itemId = pageUrl.pathname.match(/\/item\/(m\d+)/i)?.[1] || ''
  const toOrigList = (urls: string[]) =>
    pickProductImages(
      urls.map((url) => mercariToOrig(url, itemId)).filter(Boolean) as string[],
      pageUrl.origin,
    )

  const fromApi = itemId ? await fetchMercariItemPhotos(itemId).catch(() => []) : []
  const apiOrig = toOrigList(fromApi)

  const html = await fetchText(pageUrl.toString(), GALLERY_TIMEOUT_MS, {
    Referer: 'https://jp.mercari.com/',
  }).catch(() => '')
  const fromHtml = html ? toOrigList(extractMercariPhotosFromHtml(unescapeMarkup(html), itemId)) : []

  // Prefer the richest listing photo set (API and HTML often diverge).
  if (apiOrig.length >= fromHtml.length && apiOrig.length > 0) return apiOrig
  if (fromHtml.length > 0) return fromHtml
  return apiOrig
}

async function htmlGallery(
  pageUrl: URL,
  referer: string,
  extract: (html: string, pageUrl: URL) => string[],
): Promise<string[]> {
  const html = await fetchText(pageUrl.toString(), GALLERY_TIMEOUT_MS, { Referer: referer })
  return extract(html, pageUrl)
}

/** Fotos do anúncio aberto. A listagem costuma ter só a capa. */
export async function fetchProductGallery(_storeId: string, productUrl: string): Promise<string[]> {
  let pageUrl: URL
  try {
    pageUrl = new URL(String(productUrl || '').trim())
  } catch {
    return []
  }
  if (pageUrl.protocol !== 'https:') return []
  const store = resolveStore(pageUrl)
  if (!store) return []

  try {
    if (store === 'mercari') return await mercariGallery(pageUrl)
    if (store === 'rakuma') return await htmlGallery(pageUrl, 'https://fril.jp/', extractRakumaGallery)
    if (store === 'amazon') return await htmlGallery(pageUrl, 'https://www.amazon.co.jp/', extractAmazonGallery)
    if (store === 'yahoo') {
      return await htmlGallery(pageUrl, 'https://auctions.yahoo.co.jp/', extractYahooAuctionGallery)
    }
    if (store === 'yahoo_flea') {
      return await htmlGallery(pageUrl, 'https://paypayfleamarket.yahoo.co.jp/', extractYahooFleaGallery)
    }
    return await htmlGallery(pageUrl, 'https://snkrdunk.com/', extractSnkrdunkGallery)
  } catch {
    return []
  }
}
