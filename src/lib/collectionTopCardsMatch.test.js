import { describe, expect, it } from 'vitest'
import {
  collectionIdentitiesEqual,
  extractCollectionLabels,
  filterTopCardsForCollection,
  looksLikeSingleCard,
  matchesCollection,
  mergeCollectionTopCards,
} from './collectionTopCardsMatch.js'

const celebrationProduct = {
  name: 'ポケモンカードゲームMEGA 拡張パック「30th CELEBRATION」ボックス',
  nameEn: 'Pokemon Card Game MEGA Expansion Pack "30th CELEBRATION" Box',
  collectionTitle: 'ポケモンカードゲームMEGA 拡張パック「30th CELEBRATION」ボックス',
}

const vstarProduct = {
  name: 'ポケモンカードゲーム ソード&シールド ハイクラスパック VSTARユニバース ボックス (Vユニ)',
  nameEn: 'Pokemon Card Game Sword & Shield High Class Pack VSTAR Universe Box',
  collectionTitle: 'ポケモンカードゲーム ソード&シールド ハイクラスパック VSTARユニバース ボックス (Vユニ)',
}

describe('extractCollectionLabels', () => {
  it('keeps the quoted set name for 30th Celebration', () => {
    const labels = extractCollectionLabels(celebrationProduct)
    expect(labels.map((item) => item.toLowerCase())).toContain('30th celebration')
  })

  it('pulls the short set name when the English title has no quotes', () => {
    const labels = extractCollectionLabels(vstarProduct)
    const tokens = labels.map((item) => item.replace(/\s+/g, '').toLowerCase())
    expect(tokens.some((item) => item.includes('vstaruniverse') || item.includes('vstarユニバース'))).toBe(true)
    expect(labels.some((item) => /sword\s*&\s*shield high class pack/i.test(item))).toBe(false)
  })
})

describe('looksLikeSingleCard', () => {
  it('accepts SNKRDUNK singles with a card number bracket', () => {
    expect(looksLikeSingleCard('Mew [M6a 128/103](Expansion Pack "30th CELEBRATION")')).toBe(true)
    expect(looksLikeSingleCard('Charizard V SAR[s12a 211/172](High Class Pack "VSTAR Universe")')).toBe(true)
    expect(looksLikeSingleCard('Mickey Mouse SSP[Dds/S104-056SSP E5](Booster Pack Disney100)')).toBe(true)
  })

  it('rejects sealed products and language-only brackets', () => {
    expect(looksLikeSingleCard('Pokemon Card Game MEGA [EN] Elite Trainer Box "30th CELEBRATION"')).toBe(false)
    expect(looksLikeSingleCard('Pokemon Card Game MEGA [EN] Binder Collection "30th Celebration"')).toBe(false)
    expect(
      looksLikeSingleCard('[No shrink] Pokemon Card Game Scarlet & Violet Expansion Pack "Snow hazard" Box')
    ).toBe(false)
    expect(looksLikeSingleCard('Pokemon Card Game MEGA Expansion Pack "30th CELEBRATION" Box')).toBe(false)
  })
})

describe('matchesCollection', () => {
  const celebrationLabels = extractCollectionLabels(celebrationProduct)

  it('keeps cards from the same quoted collection', () => {
    expect(
      matchesCollection('Mew [M6a R/RGB](Expansion Pack "30th CELEBRATION")', 'M6A', celebrationLabels)
    ).toBe(true)
  })

  it('rejects related products that only share a title prefix', () => {
    expect(
      matchesCollection(
        'Pikachu ex PROMO :Opened [131/M-P](Special Box "30th CELEBRATION FUTURISTIC BOX")',
        'M6A',
        celebrationLabels
      )
    ).toBe(false)
    expect(
      matchesCollection(
        'Rapi: Red Hood SEC [NIK/S135-058SEC](Booster Pack "Goddess of Victory: NIKKE Vol. 2")',
        'UA18BT',
        ['Goddess of Victory : NIKKE']
      )
    ).toBe(false)
    expect(
      matchesCollection(
        'Sabo SR-SP (Comic Parallel) [OP04-083](Booster Pack "Kingdoms Of Intrigue")',
        'UA48BT',
        ['KINGDOM']
      )
    ).toBe(false)
  })

  it('matches unquoted parentheticals and JP search titles', () => {
    expect(
      matchesCollection(
        'Mickey Mouse SSP[Dds/S104-056SSP E5](Booster Pack Disney100)',
        '',
        extractCollectionLabels({
          nameEn: 'Weiss Schwarz Booster Pack Disney100 Box',
          name: 'ヴァイスシュヴァルツ ブースターパック ディズニー100',
        })
      )
    ).toBe(true)
    expect(
      matchesCollection(
        'Monkey D Luffy SEC [OP05-119] (Booster Pack Awakening of the New Era)',
        '',
        extractCollectionLabels({
          nameEn: 'ONE PIECE Card Game Booster Pack Awakening Of The New Era Box',
          name: 'ワンピースカードゲーム ブースターパック 新時代の主役',
        })
      )
    ).toBe(true)
    expect(
      matchesCollection(
        'The Byssted Lubellion PSE[DABL-JP009](DARKWING BLAST)',
        '',
        extractCollectionLabels({
          nameEn: 'Yu-Gi-Oh OCG Duel Monsters Darkwing Blast Box +1 Bonus Pack',
          name: '遊戯王OCG デュエルモンスターズ ダークウィング・ブラスト',
        })
      )
    ).toBe(true)
  })
})

describe('collectionIdentitiesEqual', () => {
  it('treats booster-pack wrappers as the same collection', () => {
    expect(collectionIdentitiesEqual('Booster Pack Heartbeat of Awakening', 'Heartbeat of Awakening')).toBe(true)
    expect(collectionIdentitiesEqual('FUSION WORLD "Booster Pack Heartbeat of Awakening"', 'Heartbeat of Awakening')).toBe(
      true
    )
  })

  it('does not treat numbered sequels as the same collection', () => {
    expect(collectionIdentitiesEqual('The Quintessential Quintuplets II', 'The Quintessential Quintuplets')).toBe(false)
    expect(collectionIdentitiesEqual('Macross Series Vol. 2', 'Macross Series')).toBe(false)
  })
})

describe('filterTopCardsForCollection', () => {
  it('drops sealed and related 30th Celebration listings', () => {
    const labels = extractCollectionLabels(celebrationProduct)
    const kept = filterTopCardsForCollection(
      [
        { name: 'Mew [M6a R/RGB](Expansion Pack "30th CELEBRATION")' },
        { name: 'Pokemon Card Game MEGA [EN] Elite Trainer Box "30th CELEBRATION"' },
        { name: 'Pikachu ex PROMO :Opened [131/M-P](Special Box "30th CELEBRATION FUTURISTIC BOX")' },
        { name: 'Charizard [M6a 137/103](Expansion Pack "30th CELEBRATION")' },
      ],
      { setCode: 'M6A', labels }
    )
    expect(kept.map((card) => card.name)).toEqual([
      'Mew [M6a R/RGB](Expansion Pack "30th CELEBRATION")',
      'Charizard [M6a 137/103](Expansion Pack "30th CELEBRATION")',
    ])
  })

  it('drops English listings from Japanese boxes', () => {
    const kept = filterTopCardsForCollection(
      [
        { name: 'Monkey.D.Luffy SEC [OP05-119](Booster Pack "Awakening Of The New Era")' },
        { name: 'Monkey.D.Luffy SEC [OP05-119] [EN](Booster Pack "Awakening Of The New Era")' },
      ],
      { labels: ['Awakening Of The New Era'] }
    )
    expect(kept.map((card) => card.name)).toEqual([
      'Monkey.D.Luffy SEC [OP05-119](Booster Pack "Awakening Of The New Era")',
    ])
  })
})

describe('mergeCollectionTopCards', () => {
  it('keeps the freshly fetched price even when it went up', () => {
    const merged = mergeCollectionTopCards(
      [{ snkrdunkId: '1', name: 'Mew [M6a 128/103]', cardNumber: '128/103', rarity: '', priceJpy: 4000 }],
      [{ snkrdunkId: '1', name: 'Mew [M6a 128/103]', cardNumber: '128/103', rarity: '', priceJpy: 6200 }]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].priceJpy).toBe(6200)
  })

  it('keeps previous cards that the new search did not return', () => {
    const merged = mergeCollectionTopCards(
      [
        { snkrdunkId: '1', name: 'Mew [M6a 128/103]', cardNumber: '128/103', rarity: '', priceJpy: 4000 },
        { snkrdunkId: '2', name: 'Lugia [M6a 142/103]', cardNumber: '142/103', rarity: '', priceJpy: 16000 },
      ],
      [{ snkrdunkId: '1', name: 'Mew [M6a 128/103]', cardNumber: '128/103', rarity: '', priceJpy: 6200 }]
    )
    expect(merged.map((card) => card.snkrdunkId)).toEqual(['1', '2'])
  })
})
