import { describe, expect, it } from 'vitest'
import { packsPerBoxForLiveRipProduct } from './collectorLiveRipCatalog.js'

describe('packsPerBoxForLiveRipProduct', () => {
  it('uses an explicit pack count when the product already has one', () => {
    expect(packsPerBoxForLiveRipProduct({ categoryId: 'pokemon-standard', packsPerBox: 12 })).toBe(12)
  })

  it('counts pokemon collections by set type, not only by game', () => {
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game MEGA High Class Pack "MEGA Dream ex" Box',
        name: 'ポケモンカードゲームMEGA ハイクラスパック「MEGAドリームex」ボックス',
      })
    ).toBe(10)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game MEGA Expansion Pack "Abyss Eye" Box',
        name: 'ポケモンカードゲームMEGA 拡張パック「アビスアイ」ボックス',
      })
    ).toBe(30)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game MEGA Expansion Pack "Mega Brave" Box',
        name: 'ポケモンカードゲームMEGA 拡張パック「メガブレイブ」ボックス',
      })
    ).toBe(30)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Enhanced Expansion "Triplet Beat" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 強化拡張パック 「トリプレットビート」 ボックス',
      })
    ).toBe(30)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Enhanced Expansion Pack "pokemon card 151" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 強化拡張パック「ポケモンカード151」ボックス',
      })
    ).toBe(20)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Expansion Pack "Battle Partners" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 拡張パック「バトルパートナーズ」ボックス',
      })
    ).toBe(30)
  })

  it('keeps known 20-pack pokemon sets even when the title omits enhanced', () => {
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Expansion Pack "Clay burst" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 拡張パック 「クレイバースト」 ボックス',
      })
    ).toBe(20)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Expansion Pack Deluxe "Black Bolt" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 拡張パックデラックス「ブラックボルト」ボックス',
      })
    ).toBe(30)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Expansion Pack "Black Bolt" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 拡張パック「ブラックボルト」ボックス',
      })
    ).toBe(20)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game Scarlet & Violet Expansion Pack "Glory of Team Rocket" Box',
        name: 'ポケモンカードゲーム スカーレット&バイオレット 拡張パック「ロケット団の栄光」ボックス',
      })
    ).toBe(20)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'pokemon-standard',
        nameEn: 'Pokemon Card Game MEGA Expansion Pack "30th CELEBRATION" Box',
        name: 'ポケモンカードゲームMEGA 拡張パック「30th CELEBRATION」ボックス',
      })
    ).toBe(20)
  })

  it('uses yugioh pack-type counts instead of one number for the whole game', () => {
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'yugioh',
        nameEn: 'Yu-Gi-Oh OCG Duel Monsters PREMIUM PACK 2026 Box',
      })
    ).toBe(10)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'yugioh',
        nameEn: 'Yu-Gi-Oh OCG Duel Monsters Deck Build Pack Justice Hunters Box',
      })
    ).toBe(15)
    expect(
      packsPerBoxForLiveRipProduct({
        categoryId: 'yugioh',
        nameEn: 'Yu-Gi-Oh OCG Duel Monsters Basic Pack "CHAOS ORIGINS" Box',
      })
    ).toBe(24)
  })

  it('keeps one piece booster boxes at 24 and uses a smaller count for premium boosters', () => {
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'one-piece',
      nameEn: 'ONE PIECE Card Game Booster Pack "THE WORLD’S STRONGEST WARRIORS" Box',
    })).toBe(24)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'one-piece',
      nameEn: 'ONE PIECE Card Game Premium Booster Box',
    })).toBe(10)
  })

  it('uses collection type for weiss, dragon ball, union arena, gundam and duel masters', () => {
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'weis-schwarz',
      nameEn: 'Weiss Schwarz Booster Pack Disney100 Box',
    })).toBe(16)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'weis-schwarz',
      nameEn: 'Weiss Schwarz Premium Booster Pack Hololive Production Box',
    })).toBe(6)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'dragon-ball-super-card-game',
      nameEn: 'DRAGON BALL SUPER CARD GAME FUSION WORLD Booster Pack "CROSS FORCE" Box',
    })).toBe(24)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'dragon-ball-super-card-game',
      nameEn: 'DRAGON BALL SUPER CARD GAME FUSION WORLD Booster Pack "STORY BOOSTER 01" Box',
    })).toBe(12)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'union-arena',
      nameEn: 'UNION ARENA Booster Pack "Chainsaw Man" Box',
    })).toBe(16)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'union-arena',
      nameEn: 'UNION ARENA Precious Booster Pack "GODDESS OF VICTORY: NIKKE" Box',
    })).toBe(8)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'gundam-card-game',
      nameEn: 'GUNDAM CARD GAME Booster Packs "Freedom Ascension" Box',
    })).toBe(24)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'gundam-card-game',
      nameEn: 'GUNDAM CARD GAME Extra Booster Pack "Eternal Nexus" Box',
    })).toBe(12)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'duelmasters',
      nameEn: 'Duel Masters TCG Character Premium Pack Box',
    })).toBe(10)
    expect(packsPerBoxForLiveRipProduct({
      categoryId: 'duelmasters',
      nameEn: 'Duel Masters TCG Battle Galaxy Expansion Pack 3rd Ultra Duel Box',
    })).toBe(30)
  })
})
