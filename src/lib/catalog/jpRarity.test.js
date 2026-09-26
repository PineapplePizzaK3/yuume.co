import { describe, expect, it } from 'vitest'
import { dropUnreliableSecretRarity, isMegaEraSet, mapTcgdexRarityToJp, normalizeJpRarity } from './jpRarity.js'

describe('mapTcgdexRarityToJp', () => {
  it('maps Western TCGdex names to Japanese printed codes', () => {
    expect(mapTcgdexRarityToJp('Common')).toBe('C')
    expect(mapTcgdexRarityToJp('Uncommon')).toBe('U')
    expect(mapTcgdexRarityToJp('Rare')).toBe('R')
    expect(mapTcgdexRarityToJp('Double rare')).toBe('RR')
    expect(mapTcgdexRarityToJp('Illustration rare')).toBe('AR')
    expect(mapTcgdexRarityToJp('Special illustration rare')).toBe('SAR')
    expect(mapTcgdexRarityToJp('Ultra Rare')).toBe('SR')
    expect(mapTcgdexRarityToJp('Hyper Rare')).toBe('UR')
    expect(mapTcgdexRarityToJp('None')).toBe(null)
  })

  it('treats Mega Hyper Rare as MUR only in the MEGA era', () => {
    expect(mapTcgdexRarityToJp('Mega Hyper Rare', { setCode: 'M2a', serieId: 'M' })).toBe('MUR')
    expect(mapTcgdexRarityToJp('Mega Hyper Rare', { setCode: 'SV2a', serieId: 'SV' })).toBe('UR')
    expect(isMegaEraSet('M6', 'M')).toBe(true)
    expect(isMegaEraSet('SV8a', 'SV')).toBe(false)
  })

  it('passes through an already-Japanese code', () => {
    expect(normalizeJpRarity('sar')).toBe('SAR')
    expect(normalizeJpRarity('RR')).toBe('RR')
  })
})

describe('dropUnreliableSecretRarity', () => {
  it('clears a single chase label dumped onto every secret', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      number_int: i + 1,
      rarity: i + 1 > 10 ? 'MUR' : 'C',
    }))
    const result = dropUnreliableSecretRarity(items, { expectedOfficial: 10 })
    expect(result.filter((item) => item.number_int > 10).every((item) => item.rarity == null)).toBe(true)
    expect(result.filter((item) => item.number_int <= 10).every((item) => item.rarity === 'C')).toBe(true)
  })

  it('keeps a mixed secret pool (151-style golds)', () => {
    const items = [
      { number_int: 1, rarity: 'C' },
      { number_int: 166, rarity: 'AR' },
      { number_int: 184, rarity: 'SR' },
      { number_int: 200, rarity: 'SAR' },
      { number_int: 208, rarity: 'UR' },
      { number_int: 209, rarity: 'UR' },
      { number_int: 210, rarity: 'UR' },
    ]
    expect(dropUnreliableSecretRarity(items, { expectedOfficial: 165 })).toEqual(items)
  })
})
