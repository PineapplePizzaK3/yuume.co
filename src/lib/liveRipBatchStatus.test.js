import { describe, expect, it } from 'vitest'
import {
  liveBatchProgressItems,
  resolveLiveBatchStatus,
  toLiveBatchStatus,
} from './liveRipBatchStatus.js'

describe('liveRipBatchStatus', () => {
  it('maps leftover demo statuses onto the live flow', () => {
    expect(toLiveBatchStatus('OPEN')).toBe('OPEN')
    expect(toLiveBatchStatus('reserved')).toBe('OPEN')
    expect(toLiveBatchStatus('FULL')).toBe('FULL')
    expect(toLiveBatchStatus('SCHEDULED')).toBe('FULL')
    expect(toLiveBatchStatus('waiting_live')).toBe('FULL')
    expect(toLiveBatchStatus('OPENING')).toBe('OPENING')
    expect(toLiveBatchStatus('FULFILLING')).toBe('COMPLETED')
  })

  it('treats a sold-out box as waiting to open', () => {
    expect(resolveLiveBatchStatus({
      status: 'OPEN',
      totalPacks: 20,
      reservedPositions: 20,
      availablePositions: 0,
    })).toBe('FULL')
  })

  it('marks the timeline through waiting when the box is full', () => {
    const items = liveBatchProgressItems(
      { status: 'FULL', totalPacks: 24, reservedPositions: 24, availablePositions: 0 },
      { OPEN: 'À venda', FULL: 'Aguardando abertura', OPENING: 'Em Box Break', COMPLETED: 'Concluída' }
    )
    expect(items.map((item) => item.done)).toEqual([true, true, false, false])
    expect(items.map((item) => item.id)).toEqual(['OPEN', 'FULL', 'OPENING', 'COMPLETED'])
  })
})
