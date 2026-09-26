import {
  COLLECTOR_CARDS,
  COLLECTOR_OPENING_SESSIONS,
  OPENING_BATCH_STATUSES,
  OPENING_SESSION_STATUSES,
  getAssetsByOwner,
  getCollectorAllocationById,
  getCollectorOpeningBatchById,
  getCollectorOpeningSessionById,
  getCollectorCardById,
  getCollectorPhysicalBoxById,
  getCollectorProductById,
  getPullsByBatchId,
  getPullsByOpeningSessionId,
  listAllocationsByBatchId,
  listAllocationsByOwner,
  listPacksByPhysicalBoxId,
  getWishlistByOwner,
} from '../data/collectorMock'
import {
  getOpeningBatchFromLiveRipCatalog,
  isLiveRipOpeningBatchId,
  listOpeningBatchesFromLiveRipCatalog,
  mapLiveRipProductToCollectorProduct,
  openingCollectionKeyFromProductId,
  openingBatchIdFromProductId,
} from '../data/collectorLiveRipCatalog'
import { COLLECTION_TOP_CARDS } from '../data/collectionTopCards'
import { LIVE_RIPS_PRODUCTS } from '../data/liveRipsMock'
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const ALLOCATION_STORAGE_KEY = 'collector_mvp_allocations_v2'
const LIVE_RIP_OPENING_RESERVE_KEY = 'collector_live_rip_opening_reserves_v1'
const DEMO_USER_ID = 'demo-user'
const COLLECTOR_DATA_SOURCE = String(import.meta.env.VITE_COLLECTOR_DATA_SOURCE || 'mock').toLowerCase()
const TOP_CARDS_DEFAULT_LIMIT = 12
const ERROR_TOP_CARD_PATTERN =
  /\b(?:printing\s+error|text\s+error|error\s+ver\.?|error\s+version|misprint|miscut|error\s+card)\b|エラー|ミスプリント/i

function isErrorTopCard(card = {}) {
  const name = String(card?.name || card?.nameEn || '')
  return ERROR_TOP_CARD_PATTERN.test(name)
}

function isSupabaseSource() {
  return COLLECTOR_DATA_SOURCE === 'supabase'
}

function sleep(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJsonStorage() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ALLOCATION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeJsonStorage(payload) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify(payload || {}))
}

function readJoinedAllocationIds(ownerId = DEMO_USER_ID) {
  const all = readJsonStorage()
  const rows = all?.[ownerId]
  return Array.isArray(rows) ? rows : []
}

function saveJoinedAllocationIds(allocationIds, ownerId = DEMO_USER_ID) {
  const all = readJsonStorage()
  all[ownerId] = Array.from(new Set((allocationIds || []).map((row) => String(row || '').trim()).filter(Boolean)))
  writeJsonStorage(all)
}

function readLiveRipOpeningReserves() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LIVE_RIP_OPENING_RESERVE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLiveRipOpeningReserves(payload) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LIVE_RIP_OPENING_RESERVE_KEY, JSON.stringify(payload || {}))
}

function getLiveRipOpeningReserveState(batchId, ownerId = DEMO_USER_ID) {
  const all = readLiveRipOpeningReserves()
  const batch = all?.[batchId] || {}
  const byOwner = batch?.byOwner && typeof batch.byOwner === 'object' ? batch.byOwner : {}
  return {
    reservedPositions: Math.max(0, Math.floor(Number(batch.reservedPositions) || 0)),
    reservedByUser: Math.max(0, Math.floor(Number(byOwner[ownerId]) || 0)),
    allocationId: batch?.allocationByOwner?.[ownerId] || `alloc-${batchId}-${ownerId}`,
  }
}

function applyLiveRipOpeningReserve(batchId, ownerId, quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  const all = readLiveRipOpeningReserves()
  const current = all[batchId] || { reservedPositions: 0, byOwner: {}, allocationByOwner: {} }
  const byOwner = { ...(current.byOwner || {}) }
  const allocationByOwner = { ...(current.allocationByOwner || {}) }
  const allocationId = allocationByOwner[ownerId] || `alloc-${batchId}-${ownerId}`
  byOwner[ownerId] = Math.max(0, Math.floor(Number(byOwner[ownerId]) || 0)) + qty
  allocationByOwner[ownerId] = allocationId
  all[batchId] = {
    reservedPositions: Math.max(0, Math.floor(Number(current.reservedPositions) || 0)) + qty,
    byOwner,
    allocationByOwner,
  }
  writeLiveRipOpeningReserves(all)
  return { allocationId, reservedByUser: byOwner[ownerId], reservedPositions: all[batchId].reservedPositions }
}

function enrichLiveRipOpeningBatch(batch, ownerId = DEMO_USER_ID) {
  if (!batch) return null
  const reserve = getLiveRipOpeningReserveState(batch.id, ownerId)
  const totalPacks = Number(batch.totalPacks || 0)
  const reservedPositions = Math.min(totalPacks, reserve.reservedPositions)
  const availablePositions = Math.max(0, totalPacks - reservedPositions)
  return {
    ...batch,
    reservedPositions,
    availablePositions,
    status: availablePositions > 0 ? OPENING_BATCH_STATUSES.OPEN : OPENING_BATCH_STATUSES.FULL,
    isJoined: reserve.reservedByUser > 0,
    reservedByUser: reserve.reservedByUser,
    myAllocationId: reserve.reservedByUser > 0 ? reserve.allocationId : null,
    myAllocations:
      reserve.reservedByUser > 0
        ? [
            {
              id: reserve.allocationId,
              batchId: batch.id,
              ownerId,
              quantity: reserve.reservedByUser,
              status: 'confirmed',
              priceJpy: Number(batch.pricePerPositionJpy || 0) * reserve.reservedByUser,
              paymentStatus: 'paid',
            },
          ]
        : [],
  }
}

function enrichBatch(batch) {
  if (!batch) return null
  const product = getCollectorProductById(batch.productId)
  const physicalBox = getCollectorPhysicalBoxById(batch.physicalBoxId)
  const openingSession = batch.openingSessionId
    ? getCollectorOpeningSessionById(batch.openingSessionId)
    : null
  const allocations = listAllocationsByBatchId(batch.id)
  const pulls = getPullsByBatchId(batch.id)
  const packs = listPacksByPhysicalBoxId(batch.physicalBoxId)
  return {
    ...batch,
    product,
    physicalBox,
    openingSession,
    allocations,
    pulls,
    packs,
  }
}

function enrichOpeningSession(session) {
  if (!session) return null
  const batch = getCollectorOpeningBatchById(session.batchId)
  const product = batch ? getCollectorProductById(batch.productId) : null
  const pulls = getPullsByOpeningSessionId(session.id)
  return {
    ...session,
    batch,
    product,
    pulls,
  }
}

function enrichAsset(asset) {
  const card = getCollectorCardById(asset.cardId)
  const batchId = asset?.origin?.batchId || ''
  const allocationId = asset?.origin?.allocationId || ''
  const openingSessionId = asset?.origin?.openingSessionId || ''
  const pullId = asset?.origin?.pullId || ''
  const batch = batchId ? getCollectorOpeningBatchById(batchId) : null
  const allocation = allocationId ? getCollectorAllocationById(allocationId) : null
  const openingSession = openingSessionId ? getCollectorOpeningSessionById(openingSessionId) : null
  const pull = pullId && batchId ? getPullsByBatchId(batchId).find((row) => row.id === pullId) || null : null
  const marketValueJpy = Number(pull?.marketValueJpy || 0)
  const sellBackOfferJpy = Math.floor(Math.max(0, marketValueJpy) * 0.8)
  const product = batch ? getCollectorProductById(batch.productId) : null
  return {
    ...asset,
    pullId,
    marketValueJpy,
    sellBackOfferJpy,
    buybackAmountJpy: Number(asset?.buybackAmountJpy || 0),
    soldAt: asset?.soldAt || null,
    gradingProvider: asset?.gradingProvider || '',
    gradingRequestedAt: asset?.gradingRequestedAt || null,
    gradingCompletedAt: asset?.gradingCompletedAt || null,
    psaCertNumber: asset?.psaCertNumber || '',
    psaGrade: asset?.psaGrade || '',
    actionNote: asset?.actionNote || '',
    card,
    batch,
    allocation,
    openingSession,
    product,
  }
}

function mapBatchStatusToLegacy(status) {
  if (status === OPENING_BATCH_STATUSES.OPEN) return 'reserved'
  if (status === OPENING_BATCH_STATUSES.FULL || status === OPENING_BATCH_STATUSES.LOCKED || status === OPENING_BATCH_STATUSES.SCHEDULED) return 'waiting_live'
  if (status === OPENING_BATCH_STATUSES.OPENING) return 'opening'
  if (status === OPENING_BATCH_STATUSES.COMPLETED || status === OPENING_BATCH_STATUSES.FULFILLING) return 'completed'
  return 'cancelled'
}

function computeSellBackOfferJpy(marketValueJpy) {
  const value = Number(marketValueJpy || 0)
  if (!(value > 0)) return 0
  return Math.floor(value * 0.8)
}

function normalizeTopCardRow(row = {}) {
  const priceJpy = Number(row.priceJpy || row.price_jpy || 0)
  return {
    snkrdunkId: String(row.snkrdunkId || row.snkrdunk_id || '').trim(),
    name: String(row.name || '').trim(),
    nameEn: String(row.nameEn || row.name_en || row.name || '').trim(),
    rarity: String(row.rarity || '').trim(),
    cardNumber: String(row.cardNumber || row.card_number || '').trim(),
    setCode: String(row.setCode || row.set_code || '').trim(),
    imageUrl: String(row.imageUrl || row.image_url || '').trim(),
    priceJpy: Number.isFinite(priceJpy) ? priceJpy : 0,
    url: String(row.url || '').trim(),
  }
}

function mergeTopCardOverrides(cards = [], overrides = []) {
  const overrideById = new Map()
  ;(overrides || []).forEach((row) => {
    const id = String(row?.snkrdunk_id || row?.snkrdunkId || '').trim()
    if (!id) return
    overrideById.set(id, row)
  })

  const merged = (cards || [])
    .map(normalizeTopCardRow)
    .map((card) => {
      const override = overrideById.get(card.snkrdunkId)
      if (!override) return { ...card, pinned: false, hidden: false }
      const overridePrice = Number(override.price_jpy_override)
      return {
        ...card,
        priceJpy: Number.isFinite(overridePrice) ? overridePrice : card.priceJpy,
        pinned: Boolean(override.pinned),
        hidden: Boolean(override.hidden),
      }
    })
    .filter((card) => !card.hidden)
    .sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      return Number(b.priceJpy || 0) - Number(a.priceJpy || 0)
    })

  return merged
}

function resolveTopCardsCollectionKey(batchOrProduct) {
  if (!batchOrProduct) return ''
  if (typeof batchOrProduct === 'string') return openingCollectionKeyFromProductId(batchOrProduct)
  const productId = batchOrProduct.productId || batchOrProduct.id || batchOrProduct.product?.id || ''
  return openingCollectionKeyFromProductId(productId)
}

function mapSupabaseProductFromBatchRow(row) {
  return {
    id: row.product_id,
    game: row.game || row.product_category_id || '',
    categoryId: row.product_category_id || '',
    set: row.product_category_id || '',
    name: {
      'pt-BR': row.product_name || row.product_id,
      en: row.product_name_en || row.product_name || row.product_id,
    },
    type: 'box',
    language: 'Japanese',
    packsPerBox: Number(row.total_positions || 0),
    priceJpy: Number(row.price_per_position_jpy || 0),
    image: row.product_image_url || '/logo.png',
    source: 'Collector',
  }
}

function mapSupabaseBatchRow(row) {
  return {
    id: row.id,
    batchCode: row.code,
    productId: row.product_id,
    physicalBoxId: row.physical_box_code || '',
    totalPacks: Number(row.total_positions || 0),
    reservedPositions: Number(row.reserved_positions || 0),
    availablePositions: Number(row.available_positions || 0),
    pricePerPositionJpy: Number(row.price_per_position_jpy || 0),
    boxPriceJpy: Number(row.price_per_position_jpy || 0) * Number(row.total_positions || 0),
    status: row.status || OPENING_BATCH_STATUSES.OPEN,
    opensAt: row.opens_at || null,
    notes: row.notes || '',
    product: mapSupabaseProductFromBatchRow(row),
    pulls: [],
    allocations: [],
    packs: [],
    openingSession: null,
    openingSessionId: null,
    isJoined: Boolean(row.is_joined),
    reservedByUser: Number(row.my_reserved_quantity || 0),
    myAllocationId: row.my_allocation_id || null,
    myPriceJpy: Number(row.my_price_jpy || 0),
    myPaymentStatus: row.my_payment_status || null,
  }
}

function mapSupabaseSessionRow(row, batchById = new Map(), pullsBySessionId = new Map()) {
  const batch = batchById.get(row.batch_id) || null
  return {
    id: row.id,
    batchId: row.batch_id,
    status: row.status || OPENING_SESSION_STATUSES.SCHEDULED,
    title: batch?.batchCode ? `Abertura ${batch.batchCode}` : `Abertura ${String(row.id || '').slice(0, 8)}`,
    scheduledAt: row.recorded_at || row.created_at || null,
    openingVideo: row.video_url || '',
    streamUrl: row.video_url || '',
    pulls: pullsBySessionId.get(row.id) || [],
    batch,
    product: batch?.product || null,
  }
}

async function supabaseListBatchesRaw() {
  const { data, error } = await withDbTimeout(supabase.rpc('service_collector_list_batches'))
  if (error) throw new Error(error.message || 'Erro ao listar aberturas')
  return Array.isArray(data) ? data : []
}

async function supabaseListOpeningBatches({ game = '' } = {}) {
  const rows = await supabaseListBatchesRaw()
  const g = String(game || '').trim().toLowerCase()
  return rows
    .map(mapSupabaseBatchRow)
    .filter((row) => !g || String(row?.product?.game || row?.product?.categoryId || row?.product?.set || '').toLowerCase() === g)
}

async function supabaseListOpeningSessionsMapped() {
  const batches = await supabaseListOpeningBatches()
  const batchById = new Map(batches.map((row) => [row.id, row]))
  const { data: sessionsData, error: sessionsError } = await withDbTimeout(
    supabase.from('opening_sessions').select('*').order('created_at', { ascending: false })
  )
  if (sessionsError) throw new Error(sessionsError.message || 'Erro ao listar sessões de abertura')
  const sessionRows = Array.isArray(sessionsData) ? sessionsData : []
  const sessionIds = sessionRows.map((row) => row.id).filter(Boolean)
  const pullsBySessionId = new Map()
  if (sessionIds.length > 0) {
    const { data: pullsData, error: pullsError } = await withDbTimeout(
      supabase.from('opening_pulls').select('*').in('session_id', sessionIds).order('pulled_at', { ascending: false })
    )
    if (pullsError) throw new Error(pullsError.message || 'Erro ao listar pulls de abertura')
    for (const pull of Array.isArray(pullsData) ? pullsData : []) {
      const list = pullsBySessionId.get(pull.session_id) || []
      list.push({
        id: pull.id,
        allocationId: pull.allocation_id,
        cardId: '',
        rarity: pull.rarity || '',
        image: pull.image_url || '',
        cardName: pull.card_name || 'Card',
        card_name: pull.card_name || 'Card',
        image_url: pull.image_url || '',
        market_value_jpy: pull.market_value_jpy,
        pulledAt: pull.pulled_at,
        isHighlight: Boolean(pull.is_highlight),
      })
      pullsBySessionId.set(pull.session_id, list)
    }
  }
  return sessionRows.map((row) => mapSupabaseSessionRow(row, batchById, pullsBySessionId))
}

export function isCollectorMockMode() {
  return !isSupabaseSource()
}

export async function listCollectorProducts({ game = '' } = {}) {
  if (isSupabaseSource()) {
    try {
      const { data, error } = await withDbTimeout(
        supabase.from('live_rip_products').select('*').eq('is_active', true).order('popularity_rank', { ascending: true, nullsFirst: false })
      )
      if (error) throw new Error(error.message || 'Erro ao listar produtos')
      const g = String(game || '').trim().toLowerCase()
      const rows = (Array.isArray(data) ? data : [])
        .map((row) => ({
          id: row.id,
          game: row.category_id || '',
          categoryId: row.category_id || '',
          set: row.category_id || '',
          name: {
            'pt-BR': row.name_en || row.name || row.id,
            en: row.name_en || row.name || row.id,
          },
          type: row.type || 'box',
          language: row.language || 'Japanese',
          packsPerBox: 0,
          priceJpy: Number(row.price_jpy || 0),
          image: row.image_url || '/logo.png',
          source: row.source || 'SNKRDUNK',
        }))
        .filter((row) => !g || String(row.categoryId || '').toLowerCase() === g || String(row.game || '').toLowerCase() === g)
      return { data: rows, error: null }
    } catch (e) {
      return { data: [], error: toServiceError(e) }
    }
  }
  await sleep()
  const g = String(game || '').trim().toLowerCase()
  const rows = LIVE_RIPS_PRODUCTS
    .map((product) => mapLiveRipProductToCollectorProduct(product))
    .filter((row) => !g || String(row.categoryId || '').toLowerCase() === g || String(row.game || '').toLowerCase() === g)
  return { data: rows, error: null }
}

export async function listOpeningBatches({ game = '', ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    try {
      const rows = await supabaseListOpeningBatches({ game })
      if (rows.length > 0) return { data: rows, error: null }

      // Sem batches admin: espelha o catálogo Live Rips (mesmas caixas).
      const { data: products, error } = await withDbTimeout(
        supabase.from('live_rip_products').select('*').eq('is_active', true).order('popularity_rank', { ascending: true, nullsFirst: false })
      )
      if (error) throw new Error(error.message || 'Erro ao listar catálogo de aberturas')
      const g = String(game || '').trim().toLowerCase()
      const mapped = (Array.isArray(products) ? products : [])
        .filter((row) => !g || String(row.category_id || '').toLowerCase() === g)
        .map((row) => {
          const product = mapLiveRipProductToCollectorProduct({
            id: row.id,
            categoryId: row.category_id,
            name: row.name,
            nameEn: row.name_en,
            type: row.type,
            priceYen: Number(row.price_jpy || 0),
            image: row.image_url,
            source: row.source,
          })
          const totalPacks = Number(product.packsPerBox || 20)
          const boxTotal = Number(product.priceJpy || 0)
          const pricePerPositionJpy =
            totalPacks > 0 && boxTotal > 0 ? Math.round((boxTotal / totalPacks) * 100) / 100 : 0
          return {
            id: openingBatchIdFromProductId(row.id),
            batchCode: `LR-${String(row.id).slice(-8).toUpperCase()}`,
            productId: row.id,
            totalPacks,
            availablePositions: totalPacks,
            reservedPositions: 0,
            pricePerPositionJpy,
            boxPriceJpy: boxTotal,
            status: OPENING_BATCH_STATUSES.OPEN,
            product: { ...product, priceJpy: boxTotal },
            isJoined: false,
            reservedByUser: 0,
            myAllocationId: null,
            pulls: [],
            myAllocations: [],
          }
        })
      return { data: mapped, error: null }
    } catch (e) {
      return { data: [], error: toServiceError(e) }
    }
  }
  await sleep()
  const categoryId = String(game || '').trim()
  const rows = listOpeningBatchesFromLiveRipCatalog({ categoryId }).map((batch) =>
    enrichLiveRipOpeningBatch(batch, ownerId)
  )
  return { data: rows, error: null }
}

export async function getOpeningBatch(batchId, { ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    try {
      const batchIdSafe = String(batchId || '').trim()
      const rows = await supabaseListOpeningBatches()
      let base = rows.find((row) => row.id === batchIdSafe) || null

      if (!base && isLiveRipOpeningBatchId(batchIdSafe)) {
        const catalog = await listOpeningBatches({ ownerId })
        base = (catalog.data || []).find((row) => row.id === batchIdSafe) || null
        if (base) {
          return {
            data: {
              ...base,
              openingSession: null,
              openingSessionId: null,
              myAllocations: base.myAllocations || [],
              pulls: [],
            },
            error: null,
          }
        }
      }

      if (!base) return { data: null, error: { message: 'Abertura nao encontrada.' } }
      const { data: myAllocs, error: allocErr } = await withDbTimeout(
        supabase
          .from('pack_allocations')
          .select('*')
          .eq('batch_id', batchIdSafe)
          .in('status', ['reserved', 'confirmed'])
          .order('created_at', { ascending: false })
      )
      if (allocErr) throw new Error(allocErr.message || 'Erro ao carregar allocations')
      const myRows = (Array.isArray(myAllocs) ? myAllocs : []).map((row) => ({
        id: row.id,
        batchId: row.batch_id,
        ownerId: row.user_id,
        quantity: Number(row.quantity || 0),
        status: row.status,
        priceJpy: Number(row.price_jpy || 0),
        paymentStatus: row.payment_status || null,
        paymentProvider: row.payment_provider || null,
      }))
      const sessions = await supabaseListOpeningSessionsMapped()
      const openingSession = sessions.find((row) => row.batchId === batchIdSafe) || null
      return {
        data: {
          ...base,
          openingSession,
          openingSessionId: openingSession?.id || null,
          myAllocations: myRows,
          pulls: openingSession?.pulls || [],
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: toServiceError(e) }
    }
  }
  await sleep()
  if (isLiveRipOpeningBatchId(batchId)) {
    const catalogBatch = getOpeningBatchFromLiveRipCatalog(batchId)
    if (!catalogBatch) return { data: null, error: { message: 'Abertura nao encontrada.' } }
    return { data: enrichLiveRipOpeningBatch(catalogBatch, ownerId), error: null }
  }
  const batch = enrichBatch(getCollectorOpeningBatchById(batchId))
  if (!batch) return { data: null, error: { message: 'Batch nao encontrada.' } }
  const ownerAllocations = new Set(readJoinedAllocationIds(ownerId))
  const userAllocs = (batch.allocations || []).filter(
    (allocation) => allocation.ownerId === ownerId || ownerAllocations.has(allocation.id)
  )
  const reservedByUser = userAllocs.reduce((acc, row) => acc + Number(row.quantity || 0), 0)
  return {
    data: {
      ...batch,
      isJoined: reservedByUser > 0,
      reservedByUser,
      myAllocations: userAllocs,
    },
    error: null,
  }
}

export async function getCollectionTopCards(batchOrProduct, { limit = TOP_CARDS_DEFAULT_LIMIT } = {}) {
  const collectionKey = resolveTopCardsCollectionKey(batchOrProduct)
  if (!collectionKey) {
    return { data: { collectionKey: '', setCode: '', updatedAt: null, source: 'SNKRDUNK', cards: [] }, error: null }
  }

  const entry = COLLECTION_TOP_CARDS?.[collectionKey] || null
  const staticCards = Array.isArray(entry?.cards)
    ? entry.cards.map(normalizeTopCardRow).filter((card) => !isErrorTopCard(card))
    : []
  const max = Math.max(1, Math.min(Number(limit) || TOP_CARDS_DEFAULT_LIMIT, 24))

  if (!isSupabaseSource()) {
    return {
      data: {
        collectionKey,
        setCode: String(entry?.setCode || '').trim(),
        updatedAt: entry?.updatedAt || null,
        source: entry?.source || 'SNKRDUNK',
        cards: staticCards.slice(0, max),
      },
      error: null,
    }
  }

  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_opening_top_card_overrides', { p_collection_key: collectionKey })
    )
    if (error) throw new Error(error.message || 'Erro ao carregar ajustes de cartas.')
    const overrides = Array.isArray(data) ? data : []
    const merged = mergeTopCardOverrides(staticCards, overrides).slice(0, max)
    return {
      data: {
        collectionKey,
        setCode: String(entry?.setCode || '').trim(),
        updatedAt: entry?.updatedAt || null,
        source: entry?.source || 'SNKRDUNK',
        cards: merged,
      },
      error: null,
    }
  } catch (e) {
    return {
      data: {
        collectionKey,
        setCode: String(entry?.setCode || '').trim(),
        updatedAt: entry?.updatedAt || null,
        source: entry?.source || 'SNKRDUNK',
        cards: staticCards.slice(0, max),
      },
      error: toServiceError(e),
    }
  }
}

export async function reserveOpeningBatch(batchId, { ownerId = DEMO_USER_ID, quantity = 1 } = {}) {
  if (isSupabaseSource()) {
    try {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1))
      const { data, error } = await withDbTimeout(
        supabase.rpc('service_collector_reserve_position', {
          p_batch_id: String(batchId || '').trim(),
          p_quantity: qty,
        })
      )
      if (error) return { data: null, error: toServiceError(error) }
      return {
        data: {
          batchId: data?.batch_id || String(batchId || '').trim(),
          allocationId: data?.allocation_id || '',
          ownerId,
          reservedQty: Number(data?.quantity || qty),
          chargedJpy: Number(data?.charged_jpy || 0),
          priceJpy: Number(data?.price_jpy || 0),
          paymentStatus: data?.payment_status || null,
          joinedAt: new Date().toISOString(),
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: toServiceError(e) }
    }
  }
  await sleep()
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))

  if (isLiveRipOpeningBatchId(batchId)) {
    const catalogBatch = getOpeningBatchFromLiveRipCatalog(batchId)
    if (!catalogBatch) return { data: null, error: { message: 'Abertura nao encontrada.' } }
    const current = enrichLiveRipOpeningBatch(catalogBatch, ownerId)
    if (Number(current.availablePositions || 0) < qty) {
      return { data: null, error: { message: 'Nao ha posicoes suficientes disponiveis.' } }
    }
    const applied = applyLiveRipOpeningReserve(current.id, ownerId, qty)
    const unit = Number(current.pricePerPositionJpy || 0)
    return {
      data: {
        batchId: current.id,
        allocationId: applied.allocationId,
        ownerId,
        reservedQty: applied.reservedByUser,
        chargedJpy: unit * qty,
        priceJpy: unit * applied.reservedByUser,
        paymentStatus: 'paid',
        joinedAt: new Date().toISOString(),
      },
      error: null,
    }
  }

  const batch = getCollectorOpeningBatchById(batchId)
  if (!batch) return { data: null, error: { message: 'Batch nao encontrada.' } }
  if (
    ![OPENING_BATCH_STATUSES.OPEN, OPENING_BATCH_STATUSES.FULL].includes(batch.status)
    || Number(batch.availablePositions || 0) < 1
  ) {
    return { data: null, error: { message: 'Batch indisponivel para novas reservas.' } }
  }
  const rows = listAllocationsByBatchId(batch.id)
  const candidate = rows.find((row) => row.ownerId === ownerId)
  if (!candidate) return { data: null, error: { message: 'Nao foi possivel reservar nesta batch demo.' } }

  const current = readJoinedAllocationIds(ownerId)
  const next = current.includes(candidate.id) ? current : [...current, candidate.id]
  saveJoinedAllocationIds(next, ownerId)
  return {
    data: {
      batchId: batch.id,
      allocationId: candidate.id,
      ownerId,
      reservedQty: qty,
      joinedAt: new Date().toISOString(),
    },
    error: null,
  }
}

export async function listOpeningSessions({ ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    try {
      const rows = await supabaseListOpeningSessionsMapped()
      return {
        data: rows.map((row) => ({ ...row, hasMyAllocation: Boolean(row.batch?.isJoined) })),
        error: null,
      }
    } catch (e) {
      return { data: [], error: toServiceError(e) }
    }
  }
  await sleep()
  const ownerAllocations = new Set(readJoinedAllocationIds(ownerId))
  const rows = COLLECTOR_OPENING_SESSIONS.map((session) => {
    const enriched = enrichOpeningSession(session)
    const myAllocations = (enriched?.batch?.allocations || []).filter(
      (allocation) => allocation.ownerId === ownerId || ownerAllocations.has(allocation.id)
    )
    return {
      ...enriched,
      hasMyAllocation: myAllocations.length > 0,
    }
  })
  return { data: rows, error: null }
}

export async function getOpeningSession(openingSessionId) {
  if (isSupabaseSource()) {
    try {
      const sessions = await supabaseListOpeningSessionsMapped()
      const found = sessions.find((row) => row.id === String(openingSessionId || '').trim())
      if (!found) return { data: null, error: { message: 'Opening session nao encontrada.' } }
      return { data: found, error: null }
    } catch (e) {
      return { data: null, error: toServiceError(e) }
    }
  }
  await sleep()
  const session = enrichOpeningSession(getCollectorOpeningSessionById(openingSessionId))
  if (!session) return { data: null, error: { message: 'Opening session nao encontrada.' } }
  const pulls = (session.pulls || []).map((pull) => ({
    ...pull,
    card: getCollectorCardById(pull.cardId),
    allocation: getCollectorAllocationById(pull.allocationId),
  }))
  return {
    data: {
      ...session,
      pulls,
    },
    error: null,
  }
}

export async function listCollectionAssets({ ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    try {
      const { data: assetsData, error: assetsError } = await withDbTimeout(
        supabase.from('collector_card_assets').select('*').order('created_at', { ascending: false })
      )
      if (assetsError) throw new Error(assetsError.message || 'Erro ao listar assets')
      const assetsRows = Array.isArray(assetsData) ? assetsData : []
      const pullIds = Array.from(new Set(assetsRows.map((row) => row.pull_id).filter(Boolean)))

      let pullsRows = []
      if (pullIds.length > 0) {
        const { data, error } = await withDbTimeout(
          supabase.from('opening_pulls').select('*').in('id', pullIds)
        )
        if (error) throw new Error(error.message || 'Erro ao carregar pulls dos assets')
        pullsRows = Array.isArray(data) ? data : []
      }
      const pullById = new Map(pullsRows.map((row) => [row.id, row]))

      const allocationIds = Array.from(new Set(pullsRows.map((row) => row.allocation_id).filter(Boolean)))
      let allocationsRows = []
      if (allocationIds.length > 0) {
        const { data, error } = await withDbTimeout(
          supabase.from('pack_allocations').select('*').in('id', allocationIds)
        )
        if (error) throw new Error(error.message || 'Erro ao carregar allocations dos assets')
        allocationsRows = Array.isArray(data) ? data : []
      }
      const allocationById = new Map(allocationsRows.map((row) => [row.id, row]))

      const sessionIds = Array.from(new Set(pullsRows.map((row) => row.session_id).filter(Boolean)))
      let sessionsRows = []
      if (sessionIds.length > 0) {
        const { data, error } = await withDbTimeout(
          supabase.from('opening_sessions').select('*').in('id', sessionIds)
        )
        if (error) throw new Error(error.message || 'Erro ao carregar sessões dos assets')
        sessionsRows = Array.isArray(data) ? data : []
      }
      const sessionById = new Map(sessionsRows.map((row) => [row.id, row]))

      const batchIds = Array.from(
        new Set(
          allocationsRows
            .map((row) => row.batch_id)
            .concat(sessionsRows.map((row) => row.batch_id))
            .filter(Boolean)
        )
      )
      let batchesRows = []
      if (batchIds.length > 0) {
        const { data, error } = await withDbTimeout(
          supabase.from('opening_batches').select('*').in('id', batchIds)
        )
        if (error) throw new Error(error.message || 'Erro ao carregar batches dos assets')
        batchesRows = Array.isArray(data) ? data : []
      }
      const batchById = new Map(batchesRows.map((row) => [row.id, row]))

      const productIds = Array.from(new Set(batchesRows.map((row) => row.product_id).filter(Boolean)))
      let productsRows = []
      if (productIds.length > 0) {
        const { data, error } = await withDbTimeout(
          supabase.from('live_rip_products').select('*').in('id', productIds)
        )
        if (error) throw new Error(error.message || 'Erro ao carregar produtos dos assets')
        productsRows = Array.isArray(data) ? data : []
      }
      const productById = new Map(productsRows.map((row) => [row.id, row]))

      const assets = assetsRows.map((row) => {
        const pull = pullById.get(row.pull_id) || null
        const allocation = pull?.allocation_id ? allocationById.get(pull.allocation_id) || null : null
        const openingSession = pull?.session_id ? sessionById.get(pull.session_id) || null : null
        const batch =
          allocation?.batch_id
            ? batchById.get(allocation.batch_id) || null
            : openingSession?.batch_id
              ? batchById.get(openingSession.batch_id) || null
              : null
        const product = batch?.product_id ? productById.get(batch.product_id) || null : null
        const marketValueJpy = Number(pull?.market_value_jpy || 0)
        const sellBackOfferJpy = computeSellBackOfferJpy(marketValueJpy)

        return {
          id: row.id,
          pullId: row.pull_id,
          ownerId: row.owner_id,
          status: row.status,
          condition: row.condition || 'raw',
          marketValueJpy,
          sellBackOfferJpy,
          buybackAmountJpy: Number(row.buyback_amount_jpy || 0),
          soldAt: row.sold_at || null,
          gradingProvider: row.grading_provider || '',
          gradingRequestedAt: row.grading_requested_at || null,
          gradingCompletedAt: row.grading_completed_at || null,
          psaCertNumber: row.psa_cert_number || '',
          psaGrade: row.psa_grade || '',
          actionNote: row.action_note || '',
          card: {
            id: row.pull_id,
            name: { 'pt-BR': pull?.card_name || 'Card', en: pull?.card_name || 'Card' },
            rarity: pull?.rarity || '',
            image: pull?.image_url || '',
            set: product?.category_id || '',
            number: '',
          },
          batch: batch
            ? {
                id: batch.id,
                batchCode: batch.code,
                productId: batch.product_id,
              }
            : null,
          allocation: allocation
            ? {
                id: allocation.id,
                batchId: allocation.batch_id,
                ownerId: allocation.user_id,
              }
            : null,
          openingSession: openingSession
            ? {
                id: openingSession.id,
                batchId: openingSession.batch_id,
                openingVideo: openingSession.video_url || '',
              }
            : null,
          product: product
            ? {
                id: product.id,
                game: product.category_id || '',
                categoryId: product.category_id || '',
                name: {
                  'pt-BR': product.name_en || product.name || product.id,
                  en: product.name_en || product.name || product.id,
                },
                image: product.image_url || '/logo.png',
              }
            : null,
          origin: {
            batchId: batch?.id || '',
            allocationId: allocation?.id || '',
            openingSessionId: openingSession?.id || '',
          },
        }
      })
      return { data: assets, error: null }
    } catch (e) {
      return { data: [], error: toServiceError(e) }
    }
  }
  await sleep()
  const assets = getAssetsByOwner(ownerId).map(enrichAsset)
  return { data: assets, error: null }
}

export async function getCollectionAsset(assetId, { ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    const { data, error } = await listCollectionAssets({ ownerId })
    if (error) return { data: null, error }
    const found = (data || []).find((asset) => asset.id === String(assetId || '').trim()) || null
    if (!found) return { data: null, error: { message: 'Card Asset nao encontrado.' } }
    return { data: found, error: null }
  }
  await sleep()
  const assets = getAssetsByOwner(ownerId)
  const found = assets.find((asset) => asset.id === String(assetId || '').trim()) || null
  if (!found) return { data: null, error: { message: 'Card Asset nao encontrado.' } }
  return { data: enrichAsset(found), error: null }
}

export async function sellBackCollectionAsset(assetId, { ownerId = DEMO_USER_ID } = {}) {
  const id = String(assetId || '').trim()
  if (!id) return { data: null, error: { message: 'Card asset invalido.' } }

  if (isSupabaseSource()) {
    try {
      const { data, error } = await withDbTimeout(
        supabase.rpc('service_collector_sell_back_asset', {
          p_asset_id: id,
        })
      )
      if (error) return { data: null, error: toServiceError(error) }
      const { data: asset } = await getCollectionAsset(id, { ownerId })
      return {
        data: {
          asset,
          creditedJpy: Number(data?.credited_jpy || data?.asset?.buyback_amount_jpy || 0),
          walletTransaction: data?.wallet_transaction || null,
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: toServiceError(e) }
    }
  }

  await sleep()
  const assets = getAssetsByOwner(ownerId)
  const found = assets.find((row) => row.id === id) || null
  if (!found) return { data: null, error: { message: 'Card Asset nao encontrado.' } }
  if (found.status === 'sold') {
    return { data: { asset: enrichAsset(found), creditedJpy: Number(found.buybackAmountJpy || 0) }, error: null }
  }
  if (found.status !== 'held') {
    return { data: null, error: { message: 'Apenas cards em colecao podem ser vendidos.' } }
  }
  const pull = found?.origin?.batchId
    ? getPullsByBatchId(found.origin.batchId).find((row) => row.id === found?.origin?.pullId) || null
    : null
  const offer = computeSellBackOfferJpy(pull?.marketValueJpy)
  if (!(offer > 0)) {
    return { data: null, error: { message: 'Este card ainda nao possui valor de mercado para sell-back.' } }
  }
  found.status = 'sold'
  found.buybackAmountJpy = offer
  found.soldAt = new Date().toISOString()
  found.actionNote = 'Sell-back 80% executado (mock).'
  return { data: { asset: enrichAsset(found), creditedJpy: offer }, error: null }
}

export async function requestPsaGradingCollectionAsset(assetId, { ownerId = DEMO_USER_ID } = {}) {
  const id = String(assetId || '').trim()
  if (!id) return { data: null, error: { message: 'Card asset invalido.' } }

  if (isSupabaseSource()) {
    try {
      const { data, error } = await withDbTimeout(
        supabase.rpc('service_collector_request_psa_grading', {
          p_asset_id: id,
        })
      )
      if (error) return { data: null, error: toServiceError(error) }
      const { data: asset } = await getCollectionAsset(id, { ownerId })
      return { data: asset || data, error: null }
    } catch (e) {
      return { data: null, error: toServiceError(e) }
    }
  }

  await sleep()
  const assets = getAssetsByOwner(ownerId)
  const found = assets.find((row) => row.id === id) || null
  if (!found) return { data: null, error: { message: 'Card Asset nao encontrado.' } }
  if (found.status === 'grading' || found.status === 'graded') return { data: enrichAsset(found), error: null }
  if (found.status !== 'held') {
    return { data: null, error: { message: 'Apenas cards em colecao podem ir para grading.' } }
  }
  found.status = 'grading'
  found.gradingProvider = 'PSA'
  found.gradingRequestedAt = new Date().toISOString()
  found.actionNote = 'Solicitacao PSA registrada (mock).'
  return { data: enrichAsset(found), error: null }
}

export async function listMyRipRecords({ ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    try {
      const rows = await supabaseListOpeningBatches()
      const joined = rows.filter((row) => row.isJoined)
      return {
        data: joined.map((batch) => ({
          id: batch.id,
          code: batch.batchCode,
          status: mapBatchStatusToLegacy(batch.status),
          packsPlanned: Number(batch.reservedByUser || 0),
          packsOpened:
            batch.status === OPENING_BATCH_STATUSES.COMPLETED || batch.status === OPENING_BATCH_STATUSES.FULFILLING
              ? Number(batch.reservedByUser || 0)
              : 0,
          bulk: { cardCount: 0, notes: 'Bulk agregado por allocation.' },
          product: batch.product,
          batch,
          pulls: [],
        })),
        error: null,
      }
    } catch (e) {
      return { data: [], error: toServiceError(e) }
    }
  }
  await sleep()
  const joinedIds = new Set(readJoinedAllocationIds(ownerId))
  const joinedAllocations = listAllocationsByOwner(ownerId).filter((alloc) => joinedIds.has(alloc.id))
  const rows = joinedAllocations
    .map((allocation) => {
      const batch = getCollectorOpeningBatchById(allocation.batchId)
      if (!batch) return null
      const pulls = getPullsByBatchId(batch.id).filter((pull) => pull.allocationId === allocation.id)
      return {
        id: allocation.id,
        code: batch.batchCode,
        status: mapBatchStatusToLegacy(batch.status),
        packsPlanned: Number(allocation.quantity || 0),
        packsOpened:
          batch.status === OPENING_BATCH_STATUSES.COMPLETED || batch.status === OPENING_BATCH_STATUSES.FULFILLING
            ? Number(allocation.quantity || 0)
            : Math.min(1, Number(allocation.quantity || 0)),
        bulk: {
          cardCount: Math.max(0, Number(allocation.quantity || 0) * 10 - pulls.length),
          notes: 'Bulk agregado por allocation no modo demo.',
        },
        product: getCollectorProductById(batch.productId),
        batch,
        pulls,
      }
    })
    .filter(Boolean)
  return { data: rows, error: null }
}

export async function getMyRipRecord(ripId, { ownerId = DEMO_USER_ID } = {}) {
  if (isSupabaseSource()) {
    const { data, error } = await listMyRipRecords({ ownerId })
    if (error) return { data: null, error }
    const found = (data || []).find((row) => row.id === String(ripId || '').trim())
      || (data || []).find((row) => row.batch?.id === String(ripId || '').trim())
    if (!found) return { data: null, error: { message: 'Voce ainda nao reservou posicoes nesta abertura.' } }
    return { data: found, error: null }
  }
  await sleep()
  const allocationId = String(ripId || '').trim()
  const joinedIds = new Set(readJoinedAllocationIds(ownerId))
  if (!joinedIds.has(allocationId)) {
    return { data: null, error: { message: 'Voce ainda nao reservou posicoes nesta batch.' } }
  }
  const allocation = getCollectorAllocationById(allocationId)
  if (!allocation) return { data: null, error: { message: 'Allocation nao encontrada.' } }
  const batch = getCollectorOpeningBatchById(allocation.batchId)
  if (!batch) return { data: null, error: { message: 'Batch nao encontrada.' } }

  const pulls = getPullsByBatchId(batch.id)
    .filter((pull) => pull.allocationId === allocation.id)
    .map((pull) => ({
      ...pull,
      card: getCollectorCardById(pull.cardId),
    }))

  return {
    data: {
      id: allocation.id,
      code: batch.batchCode,
      product: getCollectorProductById(batch.productId),
      batch,
      allocation,
      openingSession: batch.openingSessionId ? getCollectorOpeningSessionById(batch.openingSessionId) : null,
      status: mapBatchStatusToLegacy(batch.status),
      packsPlanned: Number(allocation.quantity || 0),
      packsOpened:
        batch.status === OPENING_BATCH_STATUSES.COMPLETED || batch.status === OPENING_BATCH_STATUSES.FULFILLING
          ? Number(allocation.quantity || 0)
          : Math.min(1, Number(allocation.quantity || 0)),
      bulk: {
        cardCount: Math.max(0, Number(allocation.quantity || 0) * 10 - pulls.length),
        notes: 'Bulk agregado por allocation no modo demo.',
      },
      pulls,
    },
    error: null,
  }
}

export async function listWishlistCards({ ownerId = DEMO_USER_ID } = {}) {
  await sleep()
  const rows = getWishlistByOwner(ownerId).map((item) => ({
    ...item,
    card: getCollectorCardById(item.cardId),
  }))
  return { data: rows, error: null }
}

export function getCollectorDefaultUserId() {
  return DEMO_USER_ID
}

export function listCollectorCards() {
  return COLLECTOR_CARDS
}

export async function listCollectorRips({ game = '', ownerId = DEMO_USER_ID } = {}) {
  const { data, error } = await listOpeningBatches({ game, ownerId })
  if (error) return { data: [], error }
  const rows = (data || []).map((batch) => ({
    id: batch.id,
    code: batch.batchCode,
    status: mapBatchStatusToLegacy(batch.status),
    productId: batch.productId,
    packsPlanned: Number(batch.totalPacks || 0),
    packsOpened:
      batch.status === OPENING_BATCH_STATUSES.COMPLETED || batch.status === OPENING_BATCH_STATUSES.FULFILLING
        ? Number(batch.totalPacks || 0)
        : Number(batch.reservedPositions || 0),
    product: batch.product,
    pulls: batch.pulls || [],
    openingSession: batch.openingSession,
    isJoined: batch.isJoined,
    reservedByUser: batch.reservedByUser,
    availablePositions: batch.availablePositions,
    reservedPositions: batch.reservedPositions,
  }))
  return { data: rows, error: null }
}

export async function getCollectorRip(ripId, { ownerId = DEMO_USER_ID } = {}) {
  const { data, error } = await getOpeningBatch(ripId, { ownerId })
  if (error) return { data: null, error }
  return {
    data: {
      id: data.id,
      code: data.batchCode,
      status: mapBatchStatusToLegacy(data.status),
      productId: data.productId,
      packsPlanned: Number(data.totalPacks || 0),
      packsOpened:
        data.status === OPENING_BATCH_STATUSES.COMPLETED || data.status === OPENING_BATCH_STATUSES.FULFILLING
          ? Number(data.totalPacks || 0)
          : Number(data.reservedPositions || 0),
      product: data.product,
      pulls: data.pulls || [],
      openingSession: data.openingSession,
      isJoined: data.isJoined,
      reservedByUser: data.reservedByUser,
      availablePositions: data.availablePositions,
      reservedPositions: data.reservedPositions,
      batch: data,
    },
    error: null,
  }
}

export async function joinCollectorRip(ripId, { ownerId = DEMO_USER_ID } = {}) {
  const { data, error } = await reserveOpeningBatch(ripId, { ownerId, quantity: 1 })
  if (error) return { data: null, error }
  return { data: { ripId, ownerId, joinedAt: data.joinedAt, allocationId: data.allocationId }, error: null }
}

export async function listCollectorLives({ ownerId = DEMO_USER_ID } = {}) {
  const { data, error } = await listOpeningSessions({ ownerId })
  if (error) return { data: [], error }
  const rows = (data || []).map((session) => ({
    id: session.id,
    title: session.title,
    status: session.status === OPENING_SESSION_STATUSES.RECORDING ? 'live' : 'scheduled',
    startsAt: session.scheduledAt,
    streamUrl: session.openingVideo || session.batch?.openingVideo || '',
    rips: [],
    pulls: session.pulls || [],
    session,
  }))
  return { data: rows, error: null }
}

export async function getCollectorLive(liveId) {
  const { data, error } = await getOpeningSession(liveId)
  if (error) return { data: null, error }
  return {
    data: {
      id: data.id,
      title: data.title,
      status: data.status === OPENING_SESSION_STATUSES.RECORDING ? 'live' : 'scheduled',
      startsAt: data.scheduledAt,
      streamUrl: data.openingVideo || data.batch?.openingVideo || '',
      rips: [],
      pulls: data.pulls || [],
      session: data,
    },
    error: null,
  }
}
