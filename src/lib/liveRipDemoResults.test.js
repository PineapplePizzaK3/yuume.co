import { describe, expect, it } from 'vitest'
import { cardFromDemoPull, pickDemoPullCards } from './liveRipDemoResults.js'

describe('pickDemoPullCards', () => {
  it('skips ultra-expensive cards and returns mid-tier pulls', () => {
    const picked = pickDemoPullCards([
      { name: 'Mew SAR', priceJpy: 430000 },
      { name: 'Charizard', priceJpy: 16900 },
      { name: 'Lugia', priceJpy: 16000 },
      { name: 'Common', priceJpy: 200 },
    ])
    expect(picked.map((card) => card.name)).toEqual(['Charizard', 'Lugia'])
  })

  it('falls back to priced cards when nothing is mid-tier', () => {
    const picked = pickDemoPullCards([{ name: 'Mew SAR', priceJpy: 430000 }])
    expect(picked).toHaveLength(1)
    expect(picked[0].name).toBe('Mew SAR')
  })

  it('ignores cards without a market value', () => {
    expect(pickDemoPullCards([{ name: 'Unknown' }, { name: '', priceJpy: 1200 }])).toEqual([])
  })
})

describe('cardFromDemoPull', () => {
  it('maps a top card into the collection asset shape', () => {
    const card = cardFromDemoPull({
      snkrdunkId: '882281',
      name: 'Charizard [M6a 137/103]',
      nameEn: 'Charizard',
      rarity: 'SAR',
      cardNumber: '137/103',
      setCode: 'M6A',
      imageUrl: 'https://example.com/charizard.webp',
    })
    expect(card.id).toBe('card-live-882281')
    expect(card.name['pt-BR']).toContain('Charizard')
    expect(card.image).toContain('charizard')
  })
})
