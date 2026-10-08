import { describe, expect, it } from 'vitest'
import { LIVE_RIPS_SNKRDUNK_PRODUCTS } from '../data/liveRipsSnkrdunkCatalog.js'
import { summarizeLiveRipSet } from './liveRipSetSummary.js'

describe('summarizeLiveRipSet', () => {
  it('uses a specific theme for a known pokemon box', () => {
    const summary = summarizeLiveRipSet({
      id: 'pokemon-snkrdunk-1016236',
      categoryId: 'pokemon-standard',
      nameEn: 'Pokemon Card Game MEGA Expansion Pack "30th CELEBRATION" Box',
      image: 'https://example.com/30th.webp',
      packsPerBox: 20,
    })
    expect(summary.game).toBe('Pokémon')
    expect(summary.setLabel).toBe('30th CELEBRATION')
    expect(summary.setCode).toBe('M6A')
    expect(summary.packs).toBe(20)
    expect(summary.image).toContain('30th.webp')
    expect(summary.description).toMatch(/30 anos|Pikachu/i)
    expect(summary.description).not.toMatch(/^(Coleção japonesa|O tema é)/)
  })

  it('describes Elbaf without a shared template', () => {
    const summary = summarizeLiveRipSet({
      id: 'one-piece-snkrdunk-997333',
      categoryId: 'one-piece',
      name: { en: 'ONE PIECE Card Game Booster Pack "THE WORLD’S STRONGEST WARRIORS" Box' },
      packsPerBox: 24,
    }, 'pt-BR')
    expect(summary.game).toBe('One Piece')
    expect(summary.setLabel).toBe('THE WORLD’S STRONGEST WARRIORS')
    expect(summary.description).toMatch(/Elbaf/i)
    expect(summary.description).not.toMatch(/Coleção japonesa|O tema é|Caixa de \d+ packs/)
  })

  it('covers every catalog collection with its own blurb', () => {
    const missing = []
    const robotic = []
    for (const product of LIVE_RIPS_SNKRDUNK_PRODUCTS) {
      const summary = summarizeLiveRipSet({
        ...product,
        packsPerBox: 24,
      })
      if (!summary.description) missing.push(product.id)
      if (/^(Coleção japonesa|O tema é|The theme is|Japanese .+ collection)/.test(summary.description)) {
        robotic.push(product.id)
      }
    }
    expect(missing).toEqual([])
    expect(robotic).toEqual([])
  })
})
