import { describe, expect, it } from 'vitest'
import {
  BOX_BREAK_LANE_ONE_PIECE,
  BOX_BREAK_LANE_OTHERS,
  BOX_BREAK_LANE_POKEMON,
  catalogSearchForLane,
  pickTopBatchesForLane,
} from './boxBreakLanes.js'

function batch(id, game) {
  return { id, productId: id, product: { id, game } }
}

const catalog = [
  batch('poke-1', 'pokemon-standard'),
  batch('poke-1-no-shrink', 'pokemon-standard'),
  batch('op-1', 'one-piece'),
  batch('yugi-1', 'yugioh'),
  batch('ws-1', 'weis-schwarz'),
  batch('poke-2', 'pokemon-standard'),
]

describe('pickTopBatchesForLane', () => {
  it('keeps pokemon and one piece in their own lanes', () => {
    expect(pickTopBatchesForLane(catalog, BOX_BREAK_LANE_POKEMON).map((row) => row.id)).toEqual([
      'poke-1',
      'poke-2',
    ])
    expect(pickTopBatchesForLane(catalog, BOX_BREAK_LANE_ONE_PIECE).map((row) => row.id)).toEqual(['op-1'])
  })

  it('groups remaining games in the others lane', () => {
    expect(pickTopBatchesForLane(catalog, BOX_BREAK_LANE_OTHERS).map((row) => row.id)).toEqual([
      'yugi-1',
      'ws-1',
    ])
  })

  it('respects the lane limit', () => {
    expect(pickTopBatchesForLane(catalog, BOX_BREAK_LANE_POKEMON, 1).map((row) => row.id)).toEqual(['poke-1'])
  })
})

describe('catalogSearchForLane', () => {
  it('sends each lane to the matching catalog filter', () => {
    expect(catalogSearchForLane(BOX_BREAK_LANE_POKEMON)).toBe('?game=pokemon-standard')
    expect(catalogSearchForLane(BOX_BREAK_LANE_ONE_PIECE)).toBe('?game=one-piece')
    expect(catalogSearchForLane(BOX_BREAK_LANE_OTHERS)).toBe('?game=others')
  })
})
