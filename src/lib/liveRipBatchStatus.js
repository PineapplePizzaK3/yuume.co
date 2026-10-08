export const LIVE_BATCH_STATUS_ORDER = ['OPEN', 'FULL', 'OPENING', 'COMPLETED']

const TO_LIVE = {
  OPEN: 'OPEN',
  RESERVED: 'OPEN',
  reserved: 'OPEN',
  FULL: 'FULL',
  LOCKED: 'FULL',
  SCHEDULED: 'FULL',
  WAITING_LIVE: 'FULL',
  waiting_live: 'FULL',
  OPENING: 'OPENING',
  opening: 'OPENING',
  COMPLETED: 'COMPLETED',
  completed: 'COMPLETED',
  FULFILLING: 'COMPLETED',
  CANCELLED: 'CANCELLED',
}

export function toLiveBatchStatus(status) {
  const raw = String(status || 'OPEN')
  return TO_LIVE[raw] || TO_LIVE[raw.toUpperCase()] || 'OPEN'
}

function hasOpeningResults(rip) {
  if (Array.isArray(rip?.pulls) && rip.pulls.length > 0) return true
  if (Array.isArray(rip?.batch?.pulls) && rip.batch.pulls.length > 0) return true
  return false
}

export function resolveLiveBatchStatus(rip) {
  if (hasOpeningResults(rip) || toLiveBatchStatus(rip?.status) === 'COMPLETED') {
    return 'COMPLETED'
  }

  const raw = rip?.batch?.status || rip?.status || 'OPEN'
  let status = toLiveBatchStatus(raw)
  if (status === 'OPENING' || status === 'COMPLETED' || status === 'CANCELLED') return status

  const total = Number(rip?.totalPacks ?? rip?.batch?.totalPacks ?? 0)
  const remaining = Number(rip?.availablePositions ?? rip?.batch?.availablePositions)
  const reserved = Number(rip?.reservedPositions ?? rip?.batch?.reservedPositions ?? 0)
  if (status === 'OPEN' && total > 0 && (remaining === 0 || reserved >= total)) {
    return 'FULL'
  }
  return status
}

export function liveBatchStatusTone(status) {
  const live = toLiveBatchStatus(status)
  if (live === 'OPEN' || live === 'OPENING') return 'bg-collector-100 text-collector-700 border-collector-600'
  if (live === 'FULL') return 'bg-amber-50 text-amber-900 border-amber-200'
  if (live === 'COMPLETED') return 'bg-earth-100 text-earth-700 border-earth-300'
  return 'bg-earth-50 text-earth-700 border-earth-300'
}

export function liveBatchProgressItems(rip, labels) {
  const current = resolveLiveBatchStatus(rip)
  const index = LIVE_BATCH_STATUS_ORDER.indexOf(current)
  const currentIndex = index < 0 ? 0 : index
  return LIVE_BATCH_STATUS_ORDER.map((status, idx) => ({
    id: status,
    done: idx <= currentIndex,
    label: labels?.[status] || status,
  }))
}
