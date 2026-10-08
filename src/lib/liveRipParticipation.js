import { resolveLiveBatchStatus } from './liveRipBatchStatus.js'

export const LIVE_PARTICIPATION_STATUS_ORDER = [
  'PAID',
  'WAITING_BOX',
  'WAITING_OPEN',
  'OPENING',
  'COMPLETED',
]

function hasUserPulls(record) {
  return Array.isArray(record?.pulls) && record.pulls.length > 0
}

export function resolveLiveParticipationStatus(record) {
  if (hasUserPulls(record)) return 'COMPLETED'

  const box = resolveLiveBatchStatus(record?.batch || record)
  if (box === 'COMPLETED') return 'COMPLETED'
  if (box === 'OPENING') return 'OPENING'
  if (box === 'FULL') return 'WAITING_OPEN'
  return 'WAITING_BOX'
}

export function liveParticipationStatusTone(status) {
  if (status === 'WAITING_OPEN') return 'bg-amber-50 text-amber-900 border-amber-200'
  if (status === 'COMPLETED') return 'bg-earth-100 text-earth-700 border-earth-300'
  if (status === 'OPENING' || status === 'PAID' || status === 'WAITING_BOX') {
    return 'bg-collector-100 text-collector-700 border-collector-600'
  }
  return 'bg-earth-50 text-earth-700 border-earth-300'
}

export function liveParticipationProgressItems(record, labels) {
  const current = resolveLiveParticipationStatus(record)
  const index = LIVE_PARTICIPATION_STATUS_ORDER.indexOf(current)
  const currentIndex = index < 0 ? 1 : index
  return LIVE_PARTICIPATION_STATUS_ORDER.map((status, idx) => ({
    id: status,
    done: idx <= currentIndex,
    label: labels?.[status] || status,
  }))
}

export function liveParticipationQty(record) {
  return Math.max(
    0,
    Number(record?.packsPlanned ?? record?.allocation?.quantity ?? record?.reservedByUser ?? 0)
  )
}

export function liveParticipationPaidCredits(record) {
  return Math.max(0, Number(record?.allocation?.priceJpy ?? 0))
}

export function liveParticipationBoxProgress(record) {
  const total = Math.max(0, Number(record?.totalPacks ?? record?.batch?.totalPacks ?? 0))
  const reserved = Math.max(0, Number(record?.reservedPositions ?? record?.batch?.reservedPositions ?? 0))
  const remaining = Math.max(
    0,
    Number(
      record?.availablePositions
      ?? record?.batch?.availablePositions
      ?? (total > 0 ? total - reserved : 0)
    )
  )
  const remainingPct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
  return {
    total,
    reserved,
    remaining,
    remainingPct,
    soldOut: total > 0 && remaining === 0,
  }
}
