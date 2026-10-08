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
  'pokemon-standard': 30,
  'one-piece': 24,
  yugioh: 24,
  'weis-schwarz': 16,
  'dragon-ball-super-card-game': 24,
  'union-arena': 16,
  'gundam-card-game': 24,
  duelmasters: 30,
}

const POKEMON_TWENTY_PACK_SETS =
  /クレイバースト|clay burst|スノーハザード|snow hazard|ブラックボルト|black bolt|ホワイトフレア|white flare|ポケモンカード151|pokemon card 151|ロケット団の栄光|glory of (the )?team rocket|glory of the rocket|30th\s+celebration/

const POKEMON_THIRTY_PACK_SETS =
  /トリプレットビート|triplet beat/

function productSearchText(product) {
  return [
    product?.name,
    product?.nameEn,
    product?.collectionTitle,
    product?.type,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function firstPositiveInt(...values) {
  for (const value of values) {
    const n = Math.floor(Number(value))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function packsPerBoxForPokemon(text) {
  if (/ハイクラス|high[\s-]?class/.test(text)) return 10
  if (/拡張パックデラックス|expansion pack deluxe/.test(text)) return 30
  if (POKEMON_THIRTY_PACK_SETS.test(text)) return 30
  if (/強化拡張|enhanced expansion/.test(text)) return 20
  if (POKEMON_TWENTY_PACK_SETS.test(text)) return 20
  if (/拡張パック|expansion pack/.test(text)) return 30
  return 0
}

function packsPerBoxForYugioh(text) {
  if (/premium pack|プレミアムパック/.test(text)) return 10
  if (/deck[\s-]?build|デッキビルド/.test(text)) return 15
  if (/duelist pack|デュエリストパック/.test(text)) return 15
  if (/limited pack|リミテッドパック/.test(text)) return 15
  if (/world premiere|ワールドプレミア/.test(text)) return 15
  if (/concept pack|コンセプトパック/.test(text)) return 15
  if (/special pack|スペシャルパック/.test(text)) return 15
  if (/selection|セレクション/.test(text)) return 15
  if (/animation chronicle/.test(text)) return 15
  if (/anniversary pack|アニバーサリーパック/.test(text)) return 15
  if (/basic pack|基本パック/.test(text)) return 24
  return 0
}

function packsPerBoxForWeiss(text) {
  if (/premium booster|プレミアムブースター/.test(text)) return 6
  if (/extra booster|extra pack|エクストラ/.test(text)) return 12
  return 0
}

function packsPerBoxForOnePiece(text) {
  if (/extra booster|エクストラブースター/.test(text)) return 24
  if (/premium booster|プレミアムブースター/.test(text)) return 10
  return 0
}

function packsPerBoxForDragonBall(text) {
  if (/story booster|ストーリーブースター/.test(text)) return 12
  if (/extra booster|エクストラブースター/.test(text)) return 12
  return 0
}

function packsPerBoxForUnionArena(text) {
  if (/precious booster|プレシャスブースター/.test(text)) return 8
  if (/extra booster|エクストラブースター/.test(text)) return 8
  return 0
}

function packsPerBoxForGundam(text) {
  if (/extra booster|エクストラブースター/.test(text)) return 12
  return 0
}

function packsPerBoxForDuelMasters(text) {
  if (/premium pack|プレミアムパック/.test(text)) return 10
  if (/black box pack|ブラックボックス/.test(text)) return 10
  if (/adrenaline pack|アドレナリン/.test(text)) return 10
  if (/dream pack|ドリームパック/.test(text)) return 10
  if (/quest pack|クエストパック/.test(text)) return 10
  if (/docking pack|ドッキングパック/.test(text)) return 10
  if (/entry pack|エントリーパック/.test(text)) return 10
  if (/memorial pack|メモリアルパック/.test(text)) return 10
  return 0
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
  const explicit = firstPositiveInt(product?.packsPerBox, product?.packs, product?.totalPacks)
  if (explicit) return explicit

  const text = productSearchText(product)
  const categoryId = String(product?.categoryId || '')
  const inferred =
    (categoryId === 'pokemon-standard' || /pokemon|ポケモン/.test(text)
      ? packsPerBoxForPokemon(text)
      : 0)
    || (categoryId === 'one-piece' || /one piece|ワンピース/.test(text)
      ? packsPerBoxForOnePiece(text)
      : 0)
    || (categoryId === 'yugioh' || /yu-gi-oh|遊戯王/.test(text) ? packsPerBoxForYugioh(text) : 0)
    || (categoryId === 'weis-schwarz' || /weiss|ヴァイス/.test(text) ? packsPerBoxForWeiss(text) : 0)
    || (categoryId === 'dragon-ball-super-card-game' || /dragon ball|ドラゴンボール/.test(text)
      ? packsPerBoxForDragonBall(text)
      : 0)
    || (categoryId === 'union-arena' || /union arena|ユニオンアリーナ/.test(text)
      ? packsPerBoxForUnionArena(text)
      : 0)
    || (categoryId === 'gundam-card-game' || /gundam|ガンダム/.test(text)
      ? packsPerBoxForGundam(text)
      : 0)
    || (categoryId === 'duelmasters' || /duel masters|デュエルマスターズ/.test(text)
      ? packsPerBoxForDuelMasters(text)
      : 0)

  if (inferred) return inferred
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
