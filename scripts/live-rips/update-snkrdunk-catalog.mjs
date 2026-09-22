import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const inputPath = path.join(__dirname, 'snkrdunk-box-pack.raw.json')
const outputPath = path.join(projectRoot, 'src', 'data', 'liveRipsSnkrdunkCatalog.js')

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function formatYen(value) {
  return `¥${Number(value).toLocaleString('de-DE')}`
}

function normalizeBackslashes(value) {
  return String(value || '').replace(/\\+$/g, '')
}

function extractSnkrdunkImageUrl(html) {
  const matches = [...html.matchAll(/https:\/\/cdn\.snkrdunk\.com\/upload_bg_removed\/[^"'\s<\\]+\?size=m/g)]
  return matches.length ? normalizeBackslashes(matches[0][0]) : ''
}

function extractSnkrdunkPriceLabel(html) {
  const matches = [...html.matchAll(/¥\s*([0-9][0-9,]*)/g)]
  if (!matches.length) return ''
  const raw = matches[0][1].replace(/,/g, '')
  const numeric = Number(raw)
  if (!Number.isFinite(numeric) || numeric <= 0) return ''
  return formatYen(numeric)
}

async function enrichFromSnkrdunkSearch(searchUrl) {
  if (!searchUrl) return { image: '', priceLabel: '' }
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; LiveRipsCatalogBot/1.0)',
      },
    })
    if (!response.ok) return { image: '', priceLabel: '' }
    const html = await response.text()
    return {
      image: extractSnkrdunkImageUrl(html),
      priceLabel: extractSnkrdunkPriceLabel(html),
    }
  } catch {
    return { image: '', priceLabel: '' }
  }
}

function normalizePokemonProductId(title, productId) {
  const t = String(title || '')
  if (t.includes('MEGAドリームex')) return 'pokemon-mega-dream-ex'
  if (t.includes('ワイルドフォース') || t.toLowerCase().includes('wild force')) return 'pokemon-wild-force'
  if (t.includes('シャイニートレジャーex') || t.toLowerCase().includes('shiny treasure ex')) {
    return 'pokemon-shiny-treasure-ex-box'
  }
  return `pokemon-snkrdunk-${productId}`
}

function normalizeOnePieceProductId(_title, productId) {
  return `one-piece-snkrdunk-${productId}`
}

function normalizeBrandProductId(brandPrefix, _title, productId) {
  const prefix = String(brandPrefix || 'tcg')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-snkrdunk-${productId}`
}

function decodeEscapedText(value) {
  return String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
}

function isOnePieceTitle(title, seeds = []) {
  const value = String(title || '')
  if (!value) return false
  if (/(ワンピース|one\s*piece|op[\s-]?\d{1,2})/i.test(value)) return true
  return seeds.some((seed) => value.includes(seed))
}

function hasAnySeedInTitle(title, seeds = []) {
  const value = String(title || '')
  if (!value) return false
  if (!Array.isArray(seeds) || !seeds.length) return true
  return seeds.some((seed) => value.includes(String(seed || '').trim()))
}

function isNoShrinkTitle(title) {
  return /シュリンクなし/i.test(String(title || ''))
}

function normalizeCollectionTitle(title) {
  return String(title || '')
    .replace(/【\s*シュリンクなし\s*】/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPokemonObjectsFromHtml(html) {
  const results = []
  const objectRegex = /\{\\\"displayCardPattern\\\":\\\"[^\\\"]+\\\"[\s\S]*?\\\"analyticsLog\\\":\{[\s\S]*?\}\}/g

  for (const match of html.matchAll(objectRegex)) {
    const rawObject = match[0]
    const rawTitle = rawObject.match(/\\\"title\\\":\\\"([\s\S]*?)\\\",\\\"link\\\":/)?.[1]
    const rawImageUrl = rawObject.match(/\\\"imageUrl\\\":\\\"([\s\S]*?)\\\",\\\"hasNewMark\\\":/)?.[1]
    const rawLink = rawObject.match(/\\\"link\\\":\\\"([\s\S]*?)\\\",\\\"imageUrl\\\":/)?.[1]
    const rawSalePrice = rawObject.match(/\\\"salePrice\\\":(\d+)/)?.[1]
    const rawStock = rawObject.match(/\\\"stockFromGeneralUsers\\\":(\d+)/)?.[1]
    const rawFav = rawObject.match(/\\\"favoriteCount\\\":(\d+)/)?.[1]
    const rawProductId = rawObject.match(/\\\"productId\\\":(\d+)/)?.[1]
    const rawCategoryId = rawObject.match(/\\\"categoryId\\\":\\\"([^\\\"]+)\\\"/)?.[1]
    const rawBrandId = rawObject.match(/\\\"brandId\\\":\\\"([^\\\"]+)\\\"/)?.[1]
    if (!rawTitle || !rawImageUrl || !rawSalePrice || !rawProductId || rawCategoryId !== '6/26') continue

    const title = decodeEscapedText(rawTitle)
    const imageUrl = normalizeBackslashes(decodeEscapedText(rawImageUrl))
    const linkUrl = decodeEscapedText(rawLink || '')
    const apparelId = Number(linkUrl.match(/\/apparels\/(\d+)/)?.[1] || 0)
    const salePrice = Number(rawSalePrice)
    const stockFromGeneralUsers = Number(rawStock || 0)
    const favoriteCount = Number(rawFav || 0)
    const productId = Number(rawProductId)
    if (!title || !imageUrl || !Number.isFinite(salePrice) || !Number.isFinite(productId)) continue
    results.push({
      title,
      imageUrl,
      salePrice,
      stockFromGeneralUsers: Number.isFinite(stockFromGeneralUsers) ? stockFromGeneralUsers : 0,
      favoriteCount: Number.isFinite(favoriteCount) ? favoriteCount : 0,
      productId,
      brandId: String(rawBrandId || '').trim(),
      apparelId: Number.isFinite(apparelId) && apparelId > 0 ? apparelId : null,
    })
  }

  return results
}

async function collectPokemonBoxes(raw) {
  const cfg = raw?.pokemonAutoCatalog
  if (!cfg?.enabled) return []

  const keywordSeeds = Array.isArray(cfg.keywordSeeds)
    ? cfg.keywordSeeds.map((seed) => String(seed || '').trim()).filter(Boolean)
    : []

  const templatesFromList = Array.isArray(cfg.searchUrlTemplates)
    ? cfg.searchUrlTemplates.map((template) => String(template || '').trim()).filter(Boolean)
    : []
  const templatesFromSeeds = keywordSeeds.flatMap((seed) => {
    const base = `https://snkrdunk.com/search?keywords=${encodeURIComponent(
      `${seed} ボックス`
    )}&searchCategoryIds=6%2F26&brandIds=pokemon&sort=hottest&page={page}`
    const noShrink = `https://snkrdunk.com/search?keywords=${encodeURIComponent(
      `${seed} ボックス シュリンクなし`
    )}&searchCategoryIds=6%2F26&brandIds=pokemon&sort=hottest&page={page}`
    return [base, noShrink]
  })
  const legacyTemplate = String(cfg.searchUrlTemplate || '').trim()
  const templates = Array.from(
    new Set([
      ...templatesFromList,
      ...templatesFromSeeds,
      ...(legacyTemplate ? [legacyTemplate] : []),
    ])
  )
  if (!templates.length) return []
  if (templates.some((template) => !template.includes('{page}'))) return []

  const maxPages = Number(cfg.maxPages) > 0 ? Number(cfg.maxPages) : 10
  const maxPagesPerQuery = Number(cfg.maxPagesPerQuery) > 0 ? Number(cfg.maxPagesPerQuery) : maxPages
  const dedup = new Map()
  for (const template of templates) {
    let emptyPagesInRow = 0
    for (let page = 1; page <= Math.min(maxPages, maxPagesPerQuery); page += 1) {
      const url = template.replace('{page}', String(page))
      let html = ''
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; LiveRipsCatalogBot/1.0)',
          },
        })
        if (!response.ok) break
        html = await response.text()
      } catch {
        break
      }

      const pageItems = extractPokemonObjectsFromHtml(html)
        .filter((item) => !dedup.has(item.productId))

      if (!pageItems.length) {
        emptyPagesInRow += 1
        // Stop after several empty pages to avoid endless pagination scans.
        if (emptyPagesInRow >= 4) break
        continue
      }
      emptyPagesInRow = 0
      pageItems.forEach((item) => dedup.set(item.productId, item))
    }
  }

  const sorted = [...dedup.values()].sort((a, b) => {
    if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount
    return b.salePrice - a.salePrice
  })

  const grouped = new Map()
  for (const item of sorted) {
    const collectionKey = normalizeCollectionTitle(item.title)
    if (!collectionKey) continue
    const bucket = grouped.get(collectionKey) || { regular: null, noShrink: null }
    if (isNoShrinkTitle(item.title)) {
      if (!bucket.noShrink || item.favoriteCount > bucket.noShrink.favoriteCount) {
        bucket.noShrink = item
      }
    } else if (!bucket.regular || item.favoriteCount > bucket.regular.favoriteCount) {
      bucket.regular = item
    }
    grouped.set(collectionKey, bucket)
  }

  const paired = [...grouped.entries()]
    .filter(([, bucket]) => bucket.regular)
    .sort(([, a], [, b]) => (b.regular.favoriteCount || 0) - (a.regular.favoriteCount || 0))

  const products = []
  for (const [index, [collectionTitle, bucket]] of paired.entries()) {
    const regular = bucket.regular
    const noShrink = bucket.noShrink
    const baseId = normalizePokemonProductId(collectionTitle, regular.productId)
    const defaultSearchUrl = String(
      raw?.pokemonAutoCatalog?.searchUrlTemplate ||
        raw?.pokemonAutoCatalog?.searchUrlTemplates?.[0] ||
        ''
    ).replace('{page}', '1')

    const mapItemToProduct = (item, variant) => ({
      id: variant === 'with' ? baseId : `${baseId}-no-shrink`,
      categoryId: 'pokemon-standard',
      name: item.title,
      type: 'Booster Box',
      shrinkwrapOption: variant,
      collectionTitle,
      priceYen: item.salePrice,
      availableRips: Math.max(1, Math.min(8, Math.ceil((item.stockFromGeneralUsers || 1) / 500))),
      image: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
      searchUrl: defaultSearchUrl,
      snkrdunkImageUrl: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
      snkrdunkPriceLabel: formatYen(item.salePrice),
      source: raw.source.name.trim(),
      lastUpdatedAt: String(raw.lastUpdatedAt || new Date().toISOString()),
      snkrdunkSearchUrl: `${raw.source.url} (auto-catalog ranked by hottest)`,
      popularityRank: index + 1,
      favoriteCount: item.favoriteCount,
      snkrdunkProductId: item.productId,
      snkrdunkApparelId: Number(item.apparelId) || null,
    })

    products.push(mapItemToProduct(regular, 'with'))
    if (noShrink) {
      products.push(mapItemToProduct(noShrink, 'without'))
    }
  }

  return products
}

async function collectOnePieceBoxes(raw) {
  const cfg = raw?.onePieceAutoCatalog
  if (!cfg?.enabled) return []

  const keywordSeeds = Array.isArray(cfg.keywordSeeds)
    ? cfg.keywordSeeds.map((seed) => String(seed || '').trim()).filter(Boolean)
    : []

  const templatesFromList = Array.isArray(cfg.searchUrlTemplates)
    ? cfg.searchUrlTemplates.map((template) => String(template || '').trim()).filter(Boolean)
    : []
  const templatesFromSeeds = keywordSeeds.flatMap((seed) => {
    const base = `https://snkrdunk.com/search?keywords=${encodeURIComponent(
      `${seed} ボックス`
    )}&searchCategoryIds=6%2F26&brandIds=onepiece&sort=hottest&page={page}`
    const noShrink = `https://snkrdunk.com/search?keywords=${encodeURIComponent(
      `${seed} ボックス シュリンクなし`
    )}&searchCategoryIds=6%2F26&brandIds=onepiece&sort=hottest&page={page}`
    return [base, noShrink]
  })
  const legacyTemplate = String(cfg.searchUrlTemplate || '').trim()
  const templates = Array.from(
    new Set([
      ...templatesFromList,
      ...templatesFromSeeds,
      ...(legacyTemplate ? [legacyTemplate] : []),
    ])
  )
  if (!templates.length) return []
  if (templates.some((template) => !template.includes('{page}'))) return []

  const maxPages = Number(cfg.maxPages) > 0 ? Number(cfg.maxPages) : 10
  const maxPagesPerQuery = Number(cfg.maxPagesPerQuery) > 0 ? Number(cfg.maxPagesPerQuery) : maxPages
  const dedup = new Map()
  for (const template of templates) {
    let emptyPagesInRow = 0
    for (let page = 1; page <= Math.min(maxPages, maxPagesPerQuery); page += 1) {
      const url = template.replace('{page}', String(page))
      let html = ''
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; LiveRipsCatalogBot/1.0)',
          },
        })
        if (!response.ok) break
        html = await response.text()
      } catch {
        break
      }

      const pageItems = extractPokemonObjectsFromHtml(html)
        .filter((item) => item.brandId === 'onepiece')
        .filter((item) => isOnePieceTitle(item.title, keywordSeeds))
        .filter((item) => !dedup.has(item.productId))

      if (!pageItems.length) {
        emptyPagesInRow += 1
        if (emptyPagesInRow >= 4) break
        continue
      }
      emptyPagesInRow = 0
      pageItems.forEach((item) => dedup.set(item.productId, item))
    }
  }

  const sorted = [...dedup.values()].sort((a, b) => {
    if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount
    return b.salePrice - a.salePrice
  })

  const grouped = new Map()
  for (const item of sorted) {
    const collectionKey = normalizeCollectionTitle(item.title)
    if (!collectionKey) continue
    const bucket = grouped.get(collectionKey) || { regular: null, noShrink: null }
    if (isNoShrinkTitle(item.title)) {
      if (!bucket.noShrink || item.favoriteCount > bucket.noShrink.favoriteCount) {
        bucket.noShrink = item
      }
    } else if (!bucket.regular || item.favoriteCount > bucket.regular.favoriteCount) {
      bucket.regular = item
    }
    grouped.set(collectionKey, bucket)
  }

  const paired = [...grouped.entries()]
    .filter(([, bucket]) => bucket.regular)
    .sort(([, a], [, b]) => (b.regular.favoriteCount || 0) - (a.regular.favoriteCount || 0))

  const products = []
  for (const [index, [collectionTitle, bucket]] of paired.entries()) {
    const regular = bucket.regular
    const noShrink = bucket.noShrink
    const baseId = normalizeOnePieceProductId(collectionTitle, regular.productId)
    const defaultSearchUrl = String(
      raw?.onePieceAutoCatalog?.searchUrlTemplate ||
        raw?.onePieceAutoCatalog?.searchUrlTemplates?.[0] ||
        ''
    ).replace('{page}', '1')

    const mapItemToProduct = (item, variant) => ({
      id: variant === 'with' ? baseId : `${baseId}-no-shrink`,
      categoryId: 'one-piece',
      name: item.title,
      type: 'Booster Box',
      shrinkwrapOption: variant,
      collectionTitle,
      priceYen: item.salePrice,
      availableRips: Math.max(1, Math.min(8, Math.ceil((item.stockFromGeneralUsers || 1) / 500))),
      image: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
      searchUrl: defaultSearchUrl,
      snkrdunkImageUrl: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
      snkrdunkPriceLabel: formatYen(item.salePrice),
      source: raw.source.name.trim(),
      lastUpdatedAt: String(raw.lastUpdatedAt || new Date().toISOString()),
      snkrdunkSearchUrl: `${raw.source.url} (auto-catalog ranked by hottest)`,
      popularityRank: index + 1,
      favoriteCount: item.favoriteCount,
      snkrdunkProductId: item.productId,
      snkrdunkApparelId: Number(item.apparelId) || null,
    })

    products.push(mapItemToProduct(regular, 'with'))
    if (noShrink) {
      products.push(mapItemToProduct(noShrink, 'without'))
    }
  }

  return products
}

async function collectAdditionalTcgBoxes(raw) {
  const configs = Array.isArray(raw?.additionalTcgAutoCatalogs)
    ? raw.additionalTcgAutoCatalogs.filter((item) => item?.enabled !== false)
    : []
  const allProducts = []

  for (const entry of configs) {
    const categoryId = String(entry?.categoryId || '').trim()
    if (!categoryId) continue
    const keywordSeeds = Array.isArray(entry?.keywordSeeds)
      ? entry.keywordSeeds.map((seed) => String(seed || '').trim()).filter(Boolean)
      : []
    const allowedBrandIds = Array.isArray(entry?.brandIds)
      ? entry.brandIds.map((id) => String(id || '').trim()).filter(Boolean)
      : []
    const templates = Array.isArray(entry?.searchUrlTemplates)
      ? entry.searchUrlTemplates.map((template) => String(template || '').trim()).filter(Boolean)
      : []
    if (!templates.length || templates.some((template) => !template.includes('{page}'))) continue

    const maxPages = Number(entry?.maxPages) > 0 ? Number(entry.maxPages) : 10
    const maxPagesPerQuery =
      Number(entry?.maxPagesPerQuery) > 0 ? Number(entry.maxPagesPerQuery) : maxPages
    const dedup = new Map()
    for (const template of templates) {
      let emptyPagesInRow = 0
      for (let page = 1; page <= Math.min(maxPages, maxPagesPerQuery); page += 1) {
        const url = template.replace('{page}', String(page))
        let html = ''
        try {
          const response = await fetch(url, {
            headers: {
              'user-agent': 'Mozilla/5.0 (compatible; LiveRipsCatalogBot/1.0)',
            },
          })
          if (!response.ok) break
          html = await response.text()
        } catch {
          break
        }

        const pageItems = extractPokemonObjectsFromHtml(html)
          .filter((item) => !allowedBrandIds.length || allowedBrandIds.includes(item.brandId))
          .filter((item) => hasAnySeedInTitle(item.title, keywordSeeds))
          .filter((item) => !dedup.has(item.productId))

        if (!pageItems.length) {
          emptyPagesInRow += 1
          if (emptyPagesInRow >= 4) break
          continue
        }
        emptyPagesInRow = 0
        pageItems.forEach((item) => dedup.set(item.productId, item))
      }
    }

    const sorted = [...dedup.values()].sort((a, b) => {
      if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount
      return b.salePrice - a.salePrice
    })

    const grouped = new Map()
    for (const item of sorted) {
      const collectionKey = normalizeCollectionTitle(item.title)
      if (!collectionKey) continue
      const bucket = grouped.get(collectionKey) || { regular: null, noShrink: null }
      if (isNoShrinkTitle(item.title)) {
        if (!bucket.noShrink || item.favoriteCount > bucket.noShrink.favoriteCount) {
          bucket.noShrink = item
        }
      } else if (!bucket.regular || item.favoriteCount > bucket.regular.favoriteCount) {
        bucket.regular = item
      }
      grouped.set(collectionKey, bucket)
    }

    const ranked = [...grouped.entries()]
      .filter(([, bucket]) => bucket.regular)
      .sort(([, a], [, b]) => (b.regular.favoriteCount || 0) - (a.regular.favoriteCount || 0))

    for (const [index, [collectionTitle, bucket]] of ranked.entries()) {
      const regular = bucket.regular
      const noShrink = bucket.noShrink
      const baseId = normalizeBrandProductId(entry.id || categoryId, collectionTitle, regular.productId)
      const defaultSearchUrl = String(entry?.searchUrlTemplates?.[0] || '').replace('{page}', '1')

      const mapItemToProduct = (item, variant) => ({
        id: variant === 'with' ? baseId : `${baseId}-no-shrink`,
        categoryId,
        name: item.title,
        type: 'Booster Box',
        shrinkwrapOption: variant,
        collectionTitle,
        priceYen: item.salePrice,
        availableRips: Math.max(1, Math.min(8, Math.ceil((item.stockFromGeneralUsers || 1) / 500))),
        image: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
        searchUrl: defaultSearchUrl,
        snkrdunkImageUrl: item.imageUrl.includes('?') ? item.imageUrl : `${item.imageUrl}?size=m`,
        snkrdunkPriceLabel: formatYen(item.salePrice),
        source: raw.source.name.trim(),
        lastUpdatedAt: String(raw.lastUpdatedAt || new Date().toISOString()),
        snkrdunkSearchUrl: `${raw.source.url} (auto-catalog ranked by hottest)`,
        popularityRank: index + 1,
        favoriteCount: item.favoriteCount,
        snkrdunkProductId: item.productId,
        snkrdunkApparelId: Number(item.apparelId) || null,
      })

      allProducts.push(mapItemToProduct(regular, 'with'))
      if (noShrink) {
        allProducts.push(mapItemToProduct(noShrink, 'without'))
      }
    }
  }

  return allProducts
}

function buildOutput({ source, lastUpdatedAt, categories, products }) {
  const lines = []
  lines.push(`export const LIVE_RIPS_SNKRDUNK_SOURCE = ${JSON.stringify(source, null, 2)}`)
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_LAST_UPDATED_AT = ${JSON.stringify(lastUpdatedAt)}`
  )
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_CATEGORIES = ${JSON.stringify(categories, null, 2)}`
  )
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_PRODUCTS = ${JSON.stringify(products, null, 2)}`
  )
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function collectEnglishTitlesByApparelId(products) {
  const targetIds = new Set(
    products
      .map((product) => Number(product?.snkrdunkApparelId))
      .filter((value) => Number.isFinite(value) && value > 0)
  )
  if (!targetIds.size) return new Map()

  const queries = [
    { keyword: 'pokemon box', maxPages: 10 },
    { keyword: 'one piece box', maxPages: 8 },
    { keyword: 'yu-gi-oh box', maxPages: 8 },
    { keyword: 'weiss schwarz box', maxPages: 8 },
    { keyword: 'union arena box', maxPages: 8 },
    { keyword: 'dragon ball super card game box', maxPages: 8 },
    { keyword: 'gundam card game box', maxPages: 6 },
    { keyword: 'duel masters box', maxPages: 6 },
    { keyword: 'box', maxPages: 20 },
  ]

  const titleById = new Map()
  for (const query of queries) {
    for (let page = 1; page <= query.maxPages; page += 1) {
      const url = `https://snkrdunk.com/en/v1/search?keyword=${encodeURIComponent(
        query.keyword
      )}&perPage=120&page=${page}`
      let payload = null
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; LiveRipsCatalogBot/1.0)',
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            referer: 'https://snkrdunk.com/en/search',
            origin: 'https://snkrdunk.com',
          },
        })
        if (!response.ok) break
        payload = await response.json()
      } catch {
        break
      }

      const items = Array.isArray(payload?.streetwears) ? payload.streetwears : []
      if (!items.length) break
      for (const item of items) {
        const apparelId = Number(item?.id)
        const englishName = String(item?.name || '').trim()
        if (!Number.isFinite(apparelId) || apparelId <= 0 || !englishName) continue
        if (!targetIds.has(apparelId)) continue
        if (!titleById.has(apparelId)) {
          titleById.set(apparelId, englishName)
        }
      }
      if (titleById.size >= targetIds.size) {
        return titleById
      }
    }
  }

  return titleById
}

async function main() {
  const rawText = await readFile(inputPath, 'utf8')
  const raw = JSON.parse(rawText)

  assert(isObject(raw), 'Raw snapshot must be an object.')
  assert(isObject(raw.source), '`source` must be an object.')
  assert(typeof raw.source.name === 'string' && raw.source.name.trim(), '`source.name` is required.')
  assert(typeof raw.source.url === 'string' && raw.source.url.trim(), '`source.url` is required.')
  assert(Array.isArray(raw.categories), '`categories` must be an array.')
  assert(Array.isArray(raw.products), '`products` must be an array.')

  const lastUpdatedAt = String(raw.lastUpdatedAt || new Date().toISOString())
  const categories = raw.categories.map((category, index) => {
    assert(isObject(category), `Category at index ${index} must be an object.`)
    assert(typeof category.id === 'string' && category.id.trim(), `Category ${index} requires id.`)
    assert(isObject(category.label), `Category ${category.id} requires label object.`)
    assert(
      typeof category.label['pt-BR'] === 'string' && category.label['pt-BR'].trim(),
      `Category ${category.id} requires label.pt-BR.`
    )
    assert(
      typeof category.label.en === 'string' && category.label.en.trim(),
      `Category ${category.id} requires label.en.`
    )
    return {
      id: category.id.trim(),
      label: {
        'pt-BR': category.label['pt-BR'].trim(),
        en: category.label.en.trim(),
      },
    }
  })

  const categoryIds = new Set(categories.map((category) => category.id))
  const autoPokemonProducts = await collectPokemonBoxes(raw)
  const autoOnePieceProducts = await collectOnePieceBoxes(raw)
  const autoAdditionalTcgProducts = await collectAdditionalTcgBoxes(raw)
  const manualProducts = Array.isArray(raw.products) ? raw.products : []
  const autoManagedCategoryIds = new Set([
    'pokemon-standard',
    'one-piece',
    ...((Array.isArray(raw.additionalTcgAutoCatalogs)
      ? raw.additionalTcgAutoCatalogs.map((item) => String(item?.categoryId || '').trim())
      : []
    ).filter(Boolean)),
  ])
  const mergedInputProducts = [
    ...manualProducts.filter((product) => !autoManagedCategoryIds.has(String(product?.categoryId || '').trim())),
    ...autoPokemonProducts,
    ...autoOnePieceProducts,
    ...autoAdditionalTcgProducts,
  ]
  const englishTitleByApparelId = await collectEnglishTitlesByApparelId(mergedInputProducts)

  const products = []
  for (const [index, product] of mergedInputProducts.entries()) {
    assert(isObject(product), `Product at index ${index} must be an object.`)
    assert(typeof product.id === 'string' && product.id.trim(), `Product ${index} requires id.`)
    assert(
      typeof product.categoryId === 'string' && product.categoryId.trim(),
      `Product ${product.id || index} requires categoryId.`
    )
    assert(
      categoryIds.has(product.categoryId),
      `Product ${product.id || index} references unknown categoryId "${product.categoryId}".`
    )
    assert(typeof product.name === 'string' && product.name.trim(), `Product ${product.id} requires name.`)
    assert(
      typeof product.priceYen === 'number' && Number.isFinite(product.priceYen) && product.priceYen > 0,
      `Product ${product.id} requires numeric priceYen.`
    )
    assert(
      Number.isInteger(product.availableRips) && product.availableRips >= 0,
      `Product ${product.id} requires integer availableRips.`
    )
    assert(typeof product.image === 'string' && product.image.trim(), `Product ${product.id} requires image.`)

    const searchUrl =
      typeof product.searchUrl === 'string' && product.searchUrl.trim()
        ? product.searchUrl.trim()
        : ''
    const explicitSnkrdunkImageUrl =
      typeof product.snkrdunkImageUrl === 'string' && product.snkrdunkImageUrl.trim()
        ? product.snkrdunkImageUrl.trim()
        : ''
    const explicitSnkrdunkPriceLabel =
      typeof product.snkrdunkPriceLabel === 'string' && product.snkrdunkPriceLabel.trim()
        ? product.snkrdunkPriceLabel.trim()
        : ''
    const snkrdunkApparelId = Number(product.snkrdunkApparelId) || null
    const englishNameFromMap = snkrdunkApparelId ? englishTitleByApparelId.get(snkrdunkApparelId) : ''
    const explicitNameEn =
      typeof product.nameEn === 'string' && product.nameEn.trim() ? product.nameEn.trim() : ''
    const enriched = await enrichFromSnkrdunkSearch(searchUrl)

    products.push({
      id: product.id.trim(),
      categoryId: product.categoryId.trim(),
      name: product.name.trim(),
      nameEn: String(englishNameFromMap || explicitNameEn || product.name || '').trim(),
      type: String(product.type || 'Booster Box').trim(),
      shrinkwrapOption: product.shrinkwrapOption || null,
      collectionTitle: product.collectionTitle || null,
      priceYen: product.priceYen,
      priceLabel: String(
        explicitSnkrdunkPriceLabel || product.priceLabel || enriched.priceLabel || formatYen(product.priceYen)
      ).trim(),
      availableRips: product.availableRips,
      image: String(explicitSnkrdunkImageUrl || enriched.image || product.image || '').trim(),
      source: raw.source.name.trim(),
      lastUpdatedAt,
      snkrdunkSearchUrl: searchUrl || null,
      popularityRank: Number(product.popularityRank) || null,
      favoriteCount: Number(product.favoriteCount) || null,
      snkrdunkProductId: Number(product.snkrdunkProductId) || null,
      snkrdunkApparelId,
    })
  }

  const outputText = buildOutput({
    source: {
      name: raw.source.name.trim(),
      url: raw.source.url.trim(),
      categoryPath: String(raw.source.categoryPath || '').trim(),
    },
    lastUpdatedAt,
    categories,
    products,
  })

  await writeFile(outputPath, outputText, 'utf8')
  console.log(`SNKRDUNK catalog generated: ${outputPath}`)
  console.log(`Categories: ${categories.length} | Products: ${products.length}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
