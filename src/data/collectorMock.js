const now = Date.now()
const oneHour = 60 * 60 * 1000

export const COLLECTOR_SELLER = {
  id: 'house',
  name: 'YuumeCo House',
}

export const COLLECTOR_GAMES = [
  { id: 'pokemon', label: { 'pt-BR': 'Pokemon TCG', en: 'Pokemon TCG' } },
  { id: 'onepiece', label: { 'pt-BR': 'One Piece TCG', en: 'One Piece TCG' } },
]

export const OPENING_BATCH_STATUSES = {
  OPEN: 'OPEN',
  FULL: 'FULL',
  LOCKED: 'LOCKED',
  SCHEDULED: 'SCHEDULED',
  OPENING: 'OPENING',
  COMPLETED: 'COMPLETED',
  FULFILLING: 'FULFILLING',
  CANCELLED: 'CANCELLED',
}

export const OPENING_SESSION_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  RECORDING: 'RECORDING',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
}

export const COLLECTOR_PRODUCTS = [
  {
    id: 'jp-pokemon-151-box',
    game: 'pokemon',
    set: 'Pokemon Card 151',
    name: { 'pt-BR': 'Pokemon Card 151 Box', en: 'Pokemon Card 151 Box' },
    type: 'box',
    language: 'Japanese',
    packsPerBox: 20,
    priceJpy: 17600,
    image: 'https://images.pokemontcg.io/sv3pt5/logo.png',
    source: 'SNKRDUNK',
  },
  {
    id: 'jp-pokemon-night-wanderer-box',
    game: 'pokemon',
    set: 'Night Wanderer',
    name: { 'pt-BR': 'Night Wanderer Box', en: 'Night Wanderer Box' },
    type: 'box',
    language: 'Japanese',
    packsPerBox: 30,
    priceJpy: 7900,
    image: 'https://images.pokemontcg.io/sv6/logo.png',
    source: 'SNKRDUNK',
  },
  {
    id: 'jp-pokemon-shiny-treasure-box',
    game: 'pokemon',
    set: 'Shiny Treasure ex',
    name: { 'pt-BR': 'Shiny Treasure ex Box', en: 'Shiny Treasure ex Box' },
    type: 'box',
    language: 'Japanese',
    packsPerBox: 10,
    priceJpy: 6400,
    image: 'https://images.pokemontcg.io/sv4pt5/logo.png',
    source: 'SNKRDUNK',
  },
  {
    id: 'jp-op-awakening-box',
    game: 'onepiece',
    set: 'Awakening of the New Era',
    name: {
      'pt-BR': 'One Piece Awakening of the New Era Box',
      en: 'One Piece Awakening of the New Era Box',
    },
    type: 'box',
    language: 'Japanese',
    packsPerBox: 24,
    priceJpy: 12100,
    image: '/onde-comprar/onepiece-store.jpg',
    source: 'SNKRDUNK',
  },
  {
    id: 'jp-op-two-legends-box',
    game: 'onepiece',
    set: 'Two Legends',
    name: { 'pt-BR': 'One Piece Two Legends Box', en: 'One Piece Two Legends Box' },
    type: 'box',
    language: 'Japanese',
    packsPerBox: 24,
    priceJpy: 10600,
    image: '/onde-comprar/onepiece-store.jpg',
    source: 'SNKRDUNK',
  },
]

export const COLLECTOR_PHYSICAL_BOXES = [
  {
    id: 'box-ymc-x0184',
    productId: 'jp-pokemon-151-box',
    sellerId: COLLECTOR_SELLER.id,
    sealedState: 'factory_sealed',
    status: 'allocated',
    receivedAt: new Date(now - oneHour * 72).toISOString(),
  },
  {
    id: 'box-ymc-x0210',
    productId: 'jp-op-awakening-box',
    sellerId: COLLECTOR_SELLER.id,
    sealedState: 'factory_sealed',
    status: 'opened',
    receivedAt: new Date(now - oneHour * 96).toISOString(),
  },
  {
    id: 'box-ymc-x0225',
    productId: 'jp-pokemon-night-wanderer-box',
    sellerId: COLLECTOR_SELLER.id,
    sealedState: 'factory_sealed',
    status: 'staged',
    receivedAt: new Date(now - oneHour * 48).toISOString(),
  },
]

function buildPacksForBox(boxId, totalPacks) {
  const rows = []
  for (let i = 1; i <= totalPacks; i += 1) {
    const seq = String(i).padStart(2, '0')
    rows.push({
      id: `${boxId}-p${seq}`,
      physicalBoxId: boxId,
      packCode: `P${seq}`,
      orderIndex: i,
      status: 'sealed',
    })
  }
  return rows
}

export const COLLECTOR_PACKS = [
  ...buildPacksForBox('box-ymc-x0184', 20),
  ...buildPacksForBox('box-ymc-x0210', 24),
  ...buildPacksForBox('box-ymc-x0225', 30),
]

export const COLLECTOR_OPENING_BATCHES = [
  {
    id: 'batch-ymc-b014',
    batchCode: 'YMC-B014',
    productId: 'jp-pokemon-151-box',
    physicalBoxId: 'box-ymc-x0184',
    sellerId: COLLECTOR_SELLER.id,
    totalPacks: 20,
    availablePositions: 7,
    reservedPositions: 13,
    status: OPENING_BATCH_STATUSES.OPEN,
    salesDeadline: new Date(now + oneHour * 20).toISOString(),
    scheduledOpening: new Date(now + oneHour * 30).toISOString(),
    openingVideo: '',
    openingSessionId: 'opening-session-ymc-os021',
    createdAt: new Date(now - oneHour * 20).toISOString(),
    completedAt: null,
  },
  {
    id: 'batch-ymc-b015',
    batchCode: 'YMC-B015',
    productId: 'jp-op-awakening-box',
    physicalBoxId: 'box-ymc-x0210',
    sellerId: COLLECTOR_SELLER.id,
    totalPacks: 24,
    availablePositions: 0,
    reservedPositions: 24,
    status: OPENING_BATCH_STATUSES.OPENING,
    salesDeadline: new Date(now - oneHour * 5).toISOString(),
    scheduledOpening: new Date(now - oneHour * 2).toISOString(),
    openingVideo: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    openingSessionId: 'opening-session-ymc-os022',
    createdAt: new Date(now - oneHour * 36).toISOString(),
    completedAt: null,
  },
  {
    id: 'batch-ymc-b016',
    batchCode: 'YMC-B016',
    productId: 'jp-pokemon-night-wanderer-box',
    physicalBoxId: 'box-ymc-x0225',
    sellerId: COLLECTOR_SELLER.id,
    totalPacks: 30,
    availablePositions: 0,
    reservedPositions: 30,
    status: OPENING_BATCH_STATUSES.COMPLETED,
    salesDeadline: new Date(now - oneHour * 72).toISOString(),
    scheduledOpening: new Date(now - oneHour * 60).toISOString(),
    openingVideo: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    openingSessionId: 'opening-session-ymc-os023',
    createdAt: new Date(now - oneHour * 90).toISOString(),
    completedAt: new Date(now - oneHour * 58).toISOString(),
  },
]

export const COLLECTOR_PACK_ALLOCATIONS = [
  {
    id: 'alloc-ymc-a001',
    orderId: 'ord-demo-001',
    ownerId: 'demo-user',
    batchId: 'batch-ymc-b014',
    quantity: 3,
    packIds: ['box-ymc-x0184-p01', 'box-ymc-x0184-p02', 'box-ymc-x0184-p03'],
    status: 'reserved',
    reservedAt: new Date(now - oneHour * 6).toISOString(),
  },
  {
    id: 'alloc-ymc-a002',
    orderId: 'ord-demo-002',
    ownerId: 'demo-user',
    batchId: 'batch-ymc-b015',
    quantity: 2,
    packIds: ['box-ymc-x0210-p05', 'box-ymc-x0210-p08'],
    status: 'opening',
    reservedAt: new Date(now - oneHour * 8).toISOString(),
  },
  {
    id: 'alloc-ymc-a003',
    orderId: 'ord-demo-003',
    ownerId: 'demo-user',
    batchId: 'batch-ymc-b016',
    quantity: 2,
    packIds: ['box-ymc-x0225-p02', 'box-ymc-x0225-p08'],
    status: 'completed',
    reservedAt: new Date(now - oneHour * 70).toISOString(),
  },
]

export const COLLECTOR_OPENING_SESSIONS = [
  {
    id: 'opening-session-ymc-os021',
    batchId: 'batch-ymc-b014',
    title: { 'pt-BR': 'Opening Session B014', en: 'Opening Session B014' },
    status: OPENING_SESSION_STATUSES.SCHEDULED,
    format: 'recorded',
    scheduledAt: new Date(now + oneHour * 30).toISOString(),
    startedAt: null,
    endedAt: null,
    openingVideo: '',
    createdAt: new Date(now - oneHour * 20).toISOString(),
  },
  {
    id: 'opening-session-ymc-os022',
    batchId: 'batch-ymc-b015',
    title: { 'pt-BR': 'Opening Session B015', en: 'Opening Session B015' },
    status: OPENING_SESSION_STATUSES.RECORDING,
    format: 'recorded',
    scheduledAt: new Date(now - oneHour * 2).toISOString(),
    startedAt: new Date(now - oneHour * 1.9).toISOString(),
    endedAt: null,
    openingVideo: '',
    createdAt: new Date(now - oneHour * 12).toISOString(),
  },
  {
    id: 'opening-session-ymc-os023',
    batchId: 'batch-ymc-b016',
    title: { 'pt-BR': 'Opening Session B016', en: 'Opening Session B016' },
    status: OPENING_SESSION_STATUSES.PUBLISHED,
    format: 'recorded',
    scheduledAt: new Date(now - oneHour * 60).toISOString(),
    startedAt: new Date(now - oneHour * 59).toISOString(),
    endedAt: new Date(now - oneHour * 58).toISOString(),
    openingVideo: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    createdAt: new Date(now - oneHour * 90).toISOString(),
  },
]

export const COLLECTOR_CARDS = [
  {
    id: 'card-charizard-sar',
    game: 'pokemon',
    set: 'Shiny Treasure ex',
    number: '349/190',
    name: { 'pt-BR': 'Charizard ex SAR', en: 'Charizard ex SAR' },
    rarity: 'SAR',
    image: 'https://images.pokemontcg.io/sv4pt5/234_hires.png',
  },
  {
    id: 'card-ace-sabo-sec',
    game: 'onepiece',
    set: 'Awakening of the New Era',
    number: 'OP05-119',
    name: { 'pt-BR': 'Sabo SEC', en: 'Sabo SEC' },
    rarity: 'SEC',
    image: '/onde-comprar/onepiece-store.jpg',
  },
  {
    id: 'card-gengar-ar',
    game: 'pokemon',
    set: 'Night Wanderer',
    number: '042/101',
    name: { 'pt-BR': 'Gengar AR', en: 'Gengar AR' },
    rarity: 'AR',
    image: 'https://images.pokemontcg.io/sv6/93_hires.png',
  },
  {
    id: 'card-luffy-leader-parallel',
    game: 'onepiece',
    set: 'The Four Emperors',
    number: 'OP09-061',
    name: { 'pt-BR': 'Luffy Leader Parallel', en: 'Luffy Leader Parallel' },
    rarity: 'Leader Parallel',
    image: '/onde-comprar/onepiece-store.jpg',
  },
]

export const COLLECTOR_PULLS = [
  {
    id: 'pull-op-001',
    batchId: 'batch-ymc-b015',
    allocationId: 'alloc-ymc-a002',
    openingSessionId: 'opening-session-ymc-os022',
    cardId: 'card-ace-sabo-sec',
    packId: 'box-ymc-x0210-p05',
    packIndex: 5,
    pulledAt: new Date(now - oneHour * 0.8).toISOString(),
  },
  {
    id: 'pull-op-002',
    batchId: 'batch-ymc-b015',
    allocationId: 'alloc-ymc-a002',
    openingSessionId: 'opening-session-ymc-os022',
    cardId: 'card-luffy-leader-parallel',
    packId: 'box-ymc-x0210-p08',
    packIndex: 8,
    pulledAt: new Date(now - oneHour * 0.45).toISOString(),
  },
  {
    id: 'pull-pk-001',
    batchId: 'batch-ymc-b016',
    allocationId: 'alloc-ymc-a003',
    openingSessionId: 'opening-session-ymc-os023',
    cardId: 'card-charizard-sar',
    packId: 'box-ymc-x0225-p02',
    packIndex: 2,
    pulledAt: new Date(now - oneHour * 35).toISOString(),
  },
  {
    id: 'pull-pk-002',
    batchId: 'batch-ymc-b016',
    allocationId: 'alloc-ymc-a003',
    openingSessionId: 'opening-session-ymc-os023',
    cardId: 'card-gengar-ar',
    packId: 'box-ymc-x0225-p08',
    packIndex: 8,
    pulledAt: new Date(now - oneHour * 34).toISOString(),
  },
]

export const COLLECTOR_CARD_ASSETS = [
  {
    id: 'asset-pk-001',
    cardId: 'card-charizard-sar',
    ownerId: 'demo-user',
    origin: {
      type: 'opening_batch',
      batchId: 'batch-ymc-b016',
      allocationId: 'alloc-ymc-a003',
      openingSessionId: 'opening-session-ymc-os023',
      pullId: 'pull-pk-001',
    },
    status: 'held',
    condition: 'nm',
    createdAt: new Date(now - oneHour * 35).toISOString(),
  },
  {
    id: 'asset-pk-002',
    cardId: 'card-gengar-ar',
    ownerId: 'demo-user',
    origin: {
      type: 'opening_batch',
      batchId: 'batch-ymc-b016',
      allocationId: 'alloc-ymc-a003',
      openingSessionId: 'opening-session-ymc-os023',
      pullId: 'pull-pk-002',
    },
    status: 'held',
    condition: 'nm',
    createdAt: new Date(now - oneHour * 34).toISOString(),
  },
  {
    id: 'asset-op-001',
    cardId: 'card-ace-sabo-sec',
    ownerId: 'demo-user',
    origin: {
      type: 'opening_batch',
      batchId: 'batch-ymc-b015',
      allocationId: 'alloc-ymc-a002',
      openingSessionId: 'opening-session-ymc-os022',
      pullId: 'pull-op-001',
    },
    status: 'held',
    condition: 'nm',
    createdAt: new Date(now - oneHour * 0.7).toISOString(),
  },
]

export const COLLECTOR_WISHLIST = [
  { id: 'wish-1', cardId: 'card-luffy-leader-parallel', ownerId: 'demo-user' },
]

function byIdMap(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

const productsById = byIdMap(COLLECTOR_PRODUCTS)
const boxesById = byIdMap(COLLECTOR_PHYSICAL_BOXES)
const batchesById = byIdMap(COLLECTOR_OPENING_BATCHES)
const allocationsById = byIdMap(COLLECTOR_PACK_ALLOCATIONS)
const sessionsById = byIdMap(COLLECTOR_OPENING_SESSIONS)
const packsById = byIdMap(COLLECTOR_PACKS)
const cardsById = byIdMap(COLLECTOR_CARDS)

const batchStatusToLegacyStatus = {
  OPEN: 'reserved',
  FULL: 'reserved',
  LOCKED: 'waiting_live',
  SCHEDULED: 'waiting_live',
  OPENING: 'opening',
  COMPLETED: 'completed',
  FULFILLING: 'completed',
  CANCELLED: 'cancelled',
}

function allocationToLegacyRip(allocation) {
  if (!allocation) return null
  const batch = getCollectorOpeningBatchById(allocation.batchId)
  if (!batch) return null
  return {
    id: allocation.id,
    code: batch.batchCode,
    productId: batch.productId,
    sellerId: batch.sellerId,
    openingSessionId: batch.openingSessionId || null,
    ownerId: allocation.ownerId,
    packsPlanned: Number(allocation.quantity || 0),
    packsOpened: batch.status === OPENING_BATCH_STATUSES.COMPLETED || batch.status === OPENING_BATCH_STATUSES.FULFILLING
      ? Number(allocation.quantity || 0)
      : Math.min(Number(allocation.quantity || 0), 1),
    status: batchStatusToLegacyStatus[batch.status] || 'reserved',
    batchId: batch.id,
    bulk: {
      cardCount: Math.max(0, Number(allocation.quantity || 0) * 10 - 2),
      notes: 'Bulk agregado por allocation no modo demo.',
    },
    updatedAt: batch.completedAt || batch.scheduledOpening || batch.createdAt,
  }
}

const COLLECTOR_RIPS = COLLECTOR_PACK_ALLOCATIONS.map(allocationToLegacyRip).filter(Boolean)
const ripsById = byIdMap(COLLECTOR_RIPS)

export function getCollectorProductById(productId) {
  return productsById.get(String(productId || '').trim()) || null
}

export function getCollectorPhysicalBoxById(boxId) {
  return boxesById.get(String(boxId || '').trim()) || null
}

export function getCollectorPackById(packId) {
  return packsById.get(String(packId || '').trim()) || null
}

export function getCollectorOpeningBatchById(batchId) {
  return batchesById.get(String(batchId || '').trim()) || null
}

export function getCollectorAllocationById(allocationId) {
  return allocationsById.get(String(allocationId || '').trim()) || null
}

export function getCollectorOpeningSessionById(sessionId) {
  return sessionsById.get(String(sessionId || '').trim()) || null
}

export function getCollectorCardById(cardId) {
  return cardsById.get(String(cardId || '').trim()) || null
}

export function listPacksByPhysicalBoxId(physicalBoxId) {
  const id = String(physicalBoxId || '').trim()
  return COLLECTOR_PACKS.filter((pack) => pack.physicalBoxId === id)
}

export function listAllocationsByBatchId(batchId) {
  const id = String(batchId || '').trim()
  return COLLECTOR_PACK_ALLOCATIONS.filter((allocation) => allocation.batchId === id)
}

export function listAllocationsByOwner(ownerId = 'demo-user') {
  const uid = String(ownerId || '').trim() || 'demo-user'
  return COLLECTOR_PACK_ALLOCATIONS.filter((allocation) => allocation.ownerId === uid)
}

export function getCollectorRipById(ripId) {
  return ripsById.get(String(ripId || '').trim()) || null
}

export function getPullsByRipId(ripId) {
  const id = String(ripId || '').trim()
  return COLLECTOR_PULLS.filter((pull) => pull.allocationId === id)
}

export function getPullsByBatchId(batchId) {
  const id = String(batchId || '').trim()
  return COLLECTOR_PULLS.filter((pull) => pull.batchId === id)
}

export function getPullsByOpeningSessionId(openingSessionId) {
  const id = String(openingSessionId || '').trim()
  return COLLECTOR_PULLS.filter((pull) => pull.openingSessionId === id)
}

export function getAssetsByOwner(ownerId = 'demo-user') {
  const uid = String(ownerId || '').trim() || 'demo-user'
  return COLLECTOR_CARD_ASSETS.filter((asset) => asset.ownerId === uid)
}

export function getWishlistByOwner(ownerId = 'demo-user') {
  const uid = String(ownerId || '').trim() || 'demo-user'
  return COLLECTOR_WISHLIST.filter((item) => item.ownerId === uid)
}

export function getAssetByPullId(pullId) {
  const id = String(pullId || '').trim()
  if (!id) return null
  return COLLECTOR_CARD_ASSETS.find((asset) => asset?.origin?.pullId === id) || null
}

export {
  COLLECTOR_RIPS,
}
