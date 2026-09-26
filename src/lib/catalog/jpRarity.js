/**
 * Japanese printed rarity codes (C, U, RR, AR, SR, SAR, UR, MUR…).
 *
 * TCGdex stores English-set names even on /v2/ja cards. Those names do not match the letters printed
 * on Japanese cards: English "Ultra Rare" is Japanese SR, English "Hyper Rare" is Japanese UR.
 */

const TCGDEX_NAME_TO_JP = {
  common: 'C',
  uncommon: 'U',
  rare: 'R',
  'double rare': 'RR',
  'triple rare': 'RRR',
  'illustration rare': 'AR',
  'art rare': 'AR',
  'special illustration rare': 'SAR',
  'special art rare': 'SAR',
  // EN Ultra Rare (two silver stars / full-art) = JP スーパーレア
  'ultra rare': 'SR',
  // EN Hyper Rare (gold) = JP ウルトラレア
  'hyper rare': 'UR',
  'mega hyper rare': 'MUR',
  'ace spec rare': 'ACE',
  'ace spec': 'ACE',
  'amazing rare': 'A',
  'radiant rare': 'K',
  'character rare': 'CHR',
  'character super rare': 'CSR',
  'shiny rare': 'S',
  'shiny super rare': 'SSR',
  promo: 'PROMO',
}

const JP_CODE = /^[A-Z]{1,5}$/

/** True for M-series / MEGA-era set codes (MUR exists). SV-era gold cards are UR, even if TCGdex says Mega Hyper Rare. */
export function isMegaEraSet(setCode, serieId) {
  const serie = String(serieId || '').trim().toUpperCase()
  if (serie === 'M' || serie.startsWith('MEGA')) return true
  return /^M\d/i.test(String(setCode || '').trim())
}

export function normalizeJpRarity(raw) {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text || /^none$/i.test(text)) return null
  const compact = text.toUpperCase().replace(/[\s_-]+/g, '')
  if (JP_CODE.test(compact) && !TCGDEX_NAME_TO_JP[text.toLowerCase()]) return compact
  return TCGDEX_NAME_TO_JP[text.toLowerCase()] || TCGDEX_NAME_TO_JP[text.toLowerCase().replace(/[_-]+/g, ' ')] || null
}

/**
 * Map a TCGdex rarity string to the Japanese letter code.
 * @param {string|null|undefined} tcgdexRarity
 * @param {{ setCode?: string, serieId?: string }} [ctx]
 */
export function mapTcgdexRarityToJp(tcgdexRarity, ctx = {}) {
  const mapped = normalizeJpRarity(tcgdexRarity)
  if (mapped === 'MUR' && !isMegaEraSet(ctx.setCode, ctx.serieId)) return 'UR'
  return mapped
}

/**
 * If one chase code covers almost every secret, TCGdex labelled the set with a single Western bucket
 * (seen on M6: every secret = Mega Hyper Rare). Drop those codes rather than store a false MUR/UR.
 */
export function dropUnreliableSecretRarity(items, { expectedOfficial = null, threshold = 0.8 } = {}) {
  if (expectedOfficial == null) return items
  const secrets = items.filter((item) => Number(item.number_int) > expectedOfficial && item.rarity)
  if (secrets.length < 8) return items
  const counts = {}
  for (const item of secrets) counts[item.rarity] = (counts[item.rarity] || 0) + 1
  const [dominant, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || []
  if (!dominant || count / secrets.length < threshold) return items
  if (!['MUR', 'UR', 'HR'].includes(dominant)) return items
  return items.map((item) =>
    Number(item.number_int) > expectedOfficial && item.rarity === dominant ? { ...item, rarity: null } : item,
  )
}
