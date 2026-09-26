import {
  COLLECTOR_CARDS,
  COLLECTOR_OPENING_BATCHES,
  COLLECTOR_OPENING_SESSIONS,
  COLLECTOR_PRODUCTS,
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

const ALLOCATION_STORAGE_KEY = 'collector_mvp_allocations_v2'
const DEMO_USER_ID = 'demo-user'

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
  const batch = batchId ? getCollectorOpeningBatchById(batchId) : null
  const allocation = allocationId ? getCollectorAllocationById(allocationId) : null
  const openingSession = openingSessionId ? getCollectorOpeningSessionById(openingSessionId) : null
  const product = batch ? getCollectorProductById(batch.productId) : null
  return {
    ...asset,
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

export async function listCollectorProducts({ game = '' } = {}) {
  await sleep()
  const g = String(game || '').trim().toLowerCase()
  const rows = g ? COLLECTOR_PRODUCTS.filter((row) => row.game === g) : COLLECTOR_PRODUCTS
  return { data: rows, error: null }
}

export async function listOpeningBatches({ game = '', ownerId = DEMO_USER_ID } = {}) {
  await sleep()
  const g = String(game || '').trim().toLowerCase()
  const ownerAllocations = new Set(readJoinedAllocationIds(ownerId))
  const rows = COLLECTOR_OPENING_BATCHES.filter((batch) => {
    const product = getCollectorProductById(batch.productId)
    if (g && product?.game !== g) return false
    return true
  }).map((batch) => {
    const allocations = listAllocationsByBatchId(batch.id)
    const userAllocs = allocations.filter((alloc) => alloc.ownerId === ownerId || ownerAllocations.has(alloc.id))
    const reservedByUser = userAllocs.reduce((acc, row) => acc + Number(row.quantity || 0), 0)
    return {
      ...enrichBatch(batch),
      isJoined: reservedByUser > 0,
      reservedByUser,
      availablePositions: Number(batch.availablePositions || 0),
      reservedPositions: Number(batch.reservedPositions || 0),
    }
  })

  return { data: rows, error: null }
}

export async function getOpeningBatch(batchId, { ownerId = DEMO_USER_ID } = {}) {
  await sleep()
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

export async function reserveOpeningBatch(batchId, { ownerId = DEMO_USER_ID, quantity = 1 } = {}) {
  await sleep()
  const batch = getCollectorOpeningBatchById(batchId)
  if (!batch) return { data: null, error: { message: 'Batch nao encontrada.' } }
  if (
    ![OPENING_BATCH_STATUSES.OPEN, OPENING_BATCH_STATUSES.FULL].includes(batch.status)
    || Number(batch.availablePositions || 0) < 1
  ) {
    return { data: null, error: { message: 'Batch indisponivel para novas reservas.' } }
  }
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
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
  await sleep()
  const assets = getAssetsByOwner(ownerId).map(enrichAsset)
  return { data: assets, error: null }
}

export async function getCollectionAsset(assetId, { ownerId = DEMO_USER_ID } = {}) {
  await sleep()
  const assets = getAssetsByOwner(ownerId)
  const found = assets.find((asset) => asset.id === String(assetId || '').trim()) || null
  if (!found) return { data: null, error: { message: 'Card Asset nao encontrado.' } }
  return { data: enrichAsset(found), error: null }
}

export async function listMyRipRecords({ ownerId = DEMO_USER_ID } = {}) {
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
