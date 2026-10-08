const DEMO_PULL_COUNT = 2
const DEMO_PULL_MAX_JPY = 80000

export function pickDemoPullCards(cards = [], { count = DEMO_PULL_COUNT, maxJpy = DEMO_PULL_MAX_JPY } = {}) {
  const wanted = Math.max(1, Math.floor(Number(count) || DEMO_PULL_COUNT))
  const ranked = (Array.isArray(cards) ? cards : [])
    .map((card) => ({
      ...card,
      priceJpy: Number(card?.priceJpy || card?.price_jpy || 0),
      name: String(card?.name || card?.nameEn || '').trim(),
    }))
    .filter((card) => card.name && Number.isFinite(card.priceJpy) && card.priceJpy > 0)
    .sort((left, right) => right.priceJpy - left.priceJpy)

  const midTier = ranked.filter((card) => card.priceJpy <= maxJpy)
  const pool = midTier.length ? midTier : ranked
  return pool.slice(0, wanted)
}

export function cardFromDemoPull(card = {}, fallbackId = '') {
  const name = String(card.name || card.nameEn || '').trim()
  const nameEn = String(card.nameEn || card.name || '').trim()
  const id = String(card.snkrdunkId || card.id || fallbackId || '').trim() || `card-live-${fallbackId}`
  return {
    id: id.startsWith('card-live-') ? id : `card-live-${id}`,
    name: {
      'pt-BR': name || id,
      en: nameEn || name || id,
    },
    set: String(card.setCode || card.set || '').trim(),
    number: String(card.cardNumber || card.number || '').trim(),
    rarity: String(card.rarity || '').trim(),
    image: String(card.imageUrl || card.image || '/logo.png').trim() || '/logo.png',
  }
}
