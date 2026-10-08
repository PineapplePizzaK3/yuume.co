import { openingCollectionKeyFromProductId } from '../data/collectorLiveRipCatalog'

export const BOX_BREAK_LANE_POKEMON = 'pokemon-standard'
export const BOX_BREAK_LANE_ONE_PIECE = 'one-piece'
export const BOX_BREAK_LANE_OTHERS = 'others'
export const BOX_BREAK_LANE_LIMIT = 12

export const BOX_BREAK_LANES = [
  { id: BOX_BREAK_LANE_POKEMON, catalogGame: BOX_BREAK_LANE_POKEMON },
  { id: BOX_BREAK_LANE_ONE_PIECE, catalogGame: BOX_BREAK_LANE_ONE_PIECE },
  { id: BOX_BREAK_LANE_OTHERS, catalogGame: BOX_BREAK_LANE_OTHERS },
]

export function batchGameId(batch) {
  return String(batch?.product?.game || batch?.product?.categoryId || '').trim().toLowerCase()
}

export function isOthersLaneGame(gameId) {
  const game = String(gameId || '').trim().toLowerCase()
  return Boolean(game) && game !== BOX_BREAK_LANE_POKEMON && game !== BOX_BREAK_LANE_ONE_PIECE
}

export function batchMatchesLane(batch, laneId) {
  const game = batchGameId(batch)
  if (laneId === BOX_BREAK_LANE_OTHERS) return isOthersLaneGame(game)
  return game === String(laneId || '').trim().toLowerCase()
}

export function pickTopBatchesForLane(batches, laneId, limit = BOX_BREAK_LANE_LIMIT) {
  const seen = new Set()
  const out = []
  const cap = Math.max(0, Number(limit) || 0)
  for (const batch of Array.isArray(batches) ? batches : []) {
    if (!batchMatchesLane(batch, laneId)) continue
    const key = openingCollectionKeyFromProductId(batch?.productId || batch?.product?.id || batch?.id)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(batch)
    if (out.length >= cap) break
  }
  return out
}

export function catalogSearchForLane(laneId) {
  if (laneId === BOX_BREAK_LANE_POKEMON || laneId === BOX_BREAK_LANE_ONE_PIECE || laneId === BOX_BREAK_LANE_OTHERS) {
    return `?game=${encodeURIComponent(laneId)}`
  }
  return ''
}
