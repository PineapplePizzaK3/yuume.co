/**
 * Aberturas usam o mesmo catálogo de caixas do Live Rips (SNKRDUNK).
 * Cada produto vira uma abertura sintética no modo mock.
 */
import {
  LIVE_RIPS_PRODUCT_CATEGORIES,
  LIVE_RIPS_PRODUCTS,
  getLiveRipProductById,
  getLiveRipProductName,
} from './liveRipsMock'
import { OPENING_BATCH_STATUSES } from './collectorMock'

export { LIVE_RIPS_PRODUCT_CATEGORIES as OPENING_CATALOG_CATEGORIES }

const DEFAULT_PACKS_PER_BOX = {
  'pokemon-standard': 20,
  'one-piece': 24,
  yugioh: 24,
  'weis-schwarz': 16,
  'dragon-ball-super-card-game': 24,
  'union-arena': 16,
  'gundam-card-game': 24,
  duelmasters: 30,
}

const OPENING_BATCH_PREFIX = 'opening-live-'

export function openingCollectionKeyFromProductId(productId) {
  return String(productId || '').trim().replace(/-no-shrink$/i, '')
}

export function openingBatchIdFromProductId(productId) {
  return `${OPENING_BATCH_PREFIX}${String(productId || '').trim()}`
}

export function productIdFromOpeningBatchId(batchId) {
  const id = String(batchId || '').trim()
  if (!id.startsWith(OPENING_BATCH_PREFIX)) return ''
  return id.slice(OPENING_BATCH_PREFIX.length)
}

export function isLiveRipOpeningBatchId(batchId) {
  return String(batchId || '').startsWith(OPENING_BATCH_PREFIX)
}

export function packsPerBoxForLiveRipProduct(product) {
  const categoryId = String(product?.categoryId || '')
  return DEFAULT_PACKS_PER_BOX[categoryId] || 20
}

/** Agrupa pares com/sem shrinkwrap como no hub de Live Rips. */
export function getGroupedLiveRipCatalogProducts() {
  const groups = new Map()
  LIVE_RIPS_PRODUCTS.forEach((product) => {
    const key = String(product.collectionTitle || product.name || '').trim() || product.id
    const current = groups.get(key) || []
    current.push(product)
    groups.set(key, current)
  })

  const order = { with: 0, without: 1 }
  return [...groups.entries()]
    .map(([title, items]) => ({
      title,
      items: [...items].sort((a, b) => {
        const left = order[a.shrinkwrapOption] ?? 99
        const right = order[b.shrinkwrapOption] ?? 99
        if (left !== right) return left - right
        return (a.popularityRank || 9999) - (b.popularityRank || 9999)
      }),
      rank: Math.min(...items.map((item) => Number(item.popularityRank) || 9999)),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((group) => {
      const withShrink = group.items.find((item) => item.shrinkwrapOption === 'with') || null
      const withoutShrink = group.items.find((item) => item.shrinkwrapOption === 'without') || null
      const primary = withShrink || group.items[0]
      return {
        ...primary,
        shrinkwrapPrices:
          withShrink && withoutShrink
            ? {
                withYen: Number(withShrink.priceYen ?? withShrink.priceJpy) || 0,
                withoutYen: Number(withoutShrink.priceYen ?? withoutShrink.priceJpy) || 0,
              }
            : null,
      }
    })
}

export function mapLiveRipProductToCollectorProduct(product) {
  if (!product) return null
  const boxTotal = Number(product.priceYen ?? product.priceJpy) || 0
  const packsPerBox = packsPerBoxForLiveRipProduct(product)
  return {
    id: product.id,
    game: product.categoryId || '',
    categoryId: product.categoryId || '',
    set: product.categoryId || '',
    name: {
      'pt-BR': getLiveRipProductName(product, 'pt-BR'),
      en: getLiveRipProductName(product, 'en'),
    },
    type: typeof product.type === 'string' ? product.type : product.type?.['pt-BR'] || 'Booster Box',
    language: 'Japanese',
    packsPerBox,
    priceJpy: boxTotal,
    image: product.image || '/logo.png',
    source: product.source || 'SNKRDUNK',
    shrinkwrapPrices: product.shrinkwrapPrices || null,
  }
}

export function mapLiveRipProductToOpeningBatch(product, { reservedPositions = 0 } = {}) {
  const collectorProduct = mapLiveRipProductToCollectorProduct(product)
  const totalPacks = Number(collectorProduct.packsPerBox || 20)
  const reserved = Math.max(0, Math.min(totalPacks, Math.floor(Number(reservedPositions) || 0)))
  const available = Math.max(0, totalPacks - reserved)
  const boxTotal = Number(collectorProduct.priceJpy || 0)
  const pricePerPositionJpy =
    totalPacks > 0 && boxTotal > 0 ? Math.round((boxTotal / totalPacks) * 100) / 100 : 0

  return {
    id: openingBatchIdFromProductId(product.id),
    batchCode: `LR-${String(product.id).slice(-8).toUpperCase()}`,
    productId: product.id,
    physicalBoxId: '',
    totalPacks,
    availablePositions: available,
    reservedPositions: reserved,
    pricePerPositionJpy,
    boxPriceJpy: boxTotal,
    status: available > 0 ? OPENING_BATCH_STATUSES.OPEN : OPENING_BATCH_STATUSES.FULL,
    opensAt: null,
    notes: 'Catálogo Live Rips / SNKRDUNK',
    product: {
      ...collectorProduct,
      // priceJpy permanece o total da caixa; pack é pricePerPositionJpy no batch.
      priceJpy: boxTotal,
    },
    pulls: [],
    allocations: [],
    packs: [],
    openingSession: null,
    openingSessionId: null,
  }
}

export function listOpeningBatchesFromLiveRipCatalog({ categoryId = '' } = {}) {
  const category = String(categoryId || '').trim()
  return getGroupedLiveRipCatalogProducts()
    .filter((product) => !category || product.categoryId === category)
    .map((product) => mapLiveRipProductToOpeningBatch(product))
}

export function getOpeningBatchFromLiveRipCatalog(batchId) {
  const productId = productIdFromOpeningBatchId(batchId)
  if (!productId) return null
  // Prefer grouped primary so shrinkwrap pair resolves to the same card as the list.
  const grouped = getGroupedLiveRipCatalogProducts().find((row) => row.id === productId)
  const product = grouped || getLiveRipProductById(productId)
  if (!product) return null
  return mapLiveRipProductToOpeningBatch(product)
}
