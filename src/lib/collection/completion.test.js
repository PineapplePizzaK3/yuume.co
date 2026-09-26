import { describe, expect, it } from 'vitest'
import {
  completionUnavailableMessageKey,
  computeSetProgress,
  isCompletionAvailable,
  setStatusLabelKey,
} from './completion.js'

describe('computeSetProgress', () => {
  it('returns percentage and missing only for VERIFIED sets', () => {
    expect(computeSetProgress({ total: 250, owned: 160, setStatus: 'VERIFIED' })).toEqual({
      total: 250,
      owned: 160,
      missing: 90,
      percentage: 64,
      available: true,
    })
    expect(computeSetProgress({ total: 250, owned: 160, setStatus: 'VALIDATING' })).toEqual({
      total: 250,
      owned: 160,
      missing: null,
      percentage: null,
      available: false,
    })
  })

  it('clamps owned to total and handles empty checklists', () => {
    expect(computeSetProgress({ total: 10, owned: 99, setStatus: 'VERIFIED' }).owned).toBe(10)
    expect(computeSetProgress({ total: 0, owned: 0, setStatus: 'VERIFIED' }).percentage).toBe(0)
  })
})

describe('labels', () => {
  it('maps statuses and completion availability', () => {
    expect(isCompletionAvailable('VERIFIED')).toBe(true)
    expect(isCompletionAvailable('IMPORTED')).toBe(false)
    expect(setStatusLabelKey('VALIDATING')).toBe('collector.setStatus.VALIDATING')
    expect(completionUnavailableMessageKey()).toBe('collector.progress.checklistPending')
  })
})
