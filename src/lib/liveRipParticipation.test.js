import { describe, expect, it } from 'vitest'
import {
  liveParticipationBoxProgress,
  liveParticipationProgressItems,
  liveParticipationQty,
  resolveLiveParticipationStatus,
} from './liveRipParticipation.js'

describe('liveRipParticipation', () => {
  it('treats a paid seat in an open box as waiting for the box to fill', () => {
    expect(resolveLiveParticipationStatus({
      status: 'reserved',
      packsPlanned: 2,
      totalPacks: 24,
      reservedPositions: 3,
      availablePositions: 21,
      batch: { status: 'OPEN', totalPacks: 24, reservedPositions: 3, availablePositions: 21 },
    })).toBe('WAITING_BOX')
  })

  it('moves to waiting for opening after the box sells out', () => {
    expect(resolveLiveParticipationStatus({
      status: 'waiting_live',
      packsPlanned: 2,
      batch: { status: 'FULL', totalPacks: 24, reservedPositions: 24, availablePositions: 0 },
    })).toBe('WAITING_OPEN')
  })

  it('marks the user timeline through purchase and box-fill when still waiting', () => {
    const items = liveParticipationProgressItems(
      {
        status: 'reserved',
        batch: { status: 'OPEN', totalPacks: 20, reservedPositions: 1, availablePositions: 19 },
      },
      {
        PAID: 'Compra confirmada',
        WAITING_BOX: 'Aguardando a caixa completar',
        WAITING_OPEN: 'Aguardando abertura',
        OPENING: 'Em Box Break',
        COMPLETED: 'Cartas na coleção',
      }
    )
    expect(items.map((item) => item.id)).toEqual([
      'PAID',
      'WAITING_BOX',
      'WAITING_OPEN',
      'OPENING',
      'COMPLETED',
    ])
    expect(items.map((item) => item.done)).toEqual([true, true, false, false, false])
  })

  it('uses the user quantity and remaining packs of the box', () => {
    const record = {
      packsPlanned: 2,
      allocation: { quantity: 2, priceJpy: 1016 },
      totalPacks: 24,
      reservedPositions: 5,
      availablePositions: 19,
    }
    expect(liveParticipationQty(record)).toBe(2)
    expect(liveParticipationBoxProgress(record)).toMatchObject({
      total: 24,
      remaining: 19,
      soldOut: false,
    })
  })

  it('completes the participation after pulls exist', () => {
    expect(resolveLiveParticipationStatus({
      status: 'reserved',
      pulls: [{ id: 'pull-1' }],
      batch: { status: 'OPEN' },
    })).toBe('COMPLETED')
  })
})
