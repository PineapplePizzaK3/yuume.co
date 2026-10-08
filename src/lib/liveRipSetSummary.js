import { COLLECTION_TOP_CARDS } from '../data/collectionTopCards'
import { findLiveRipSetTheme } from '../data/liveRipSetThemes'
import { LIVE_RIPS_PRODUCT_CATEGORIES, getLiveRipProductById } from '../data/liveRipsMock'

const GAME_SHORT = {
  'pokemon-standard': { 'pt-BR': 'Pokémon', en: 'Pokémon' },
  'one-piece': { 'pt-BR': 'One Piece', en: 'One Piece' },
  yugioh: { 'pt-BR': 'Yu-Gi-Oh!', en: 'Yu-Gi-Oh!' },
  'weis-schwarz': { 'pt-BR': 'Weiss Schwarz', en: 'Weiss Schwarz' },
  'dragon-ball-super-card-game': { 'pt-BR': 'Dragon Ball Super', en: 'Dragon Ball Super' },
  'union-arena': { 'pt-BR': 'Union Arena', en: 'Union Arena' },
  'gundam-card-game': { 'pt-BR': 'Gundam Card Game', en: 'Gundam Card Game' },
  duelmasters: { 'pt-BR': 'Duel Masters', en: 'Duel Masters' },
}

function firstPositiveInt(...values) {
  for (const value of values) {
    const n = Math.floor(Number(value))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function quoteFromName(product) {
  const text = [product?.name?.en, product?.name?.['pt-BR'], product?.nameEn, product?.name]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
  return text.match(/[「"]([^」"]+)[」"]/)?.[1]?.trim() || ''
}

function productId(product) {
  return String(product?.id || product?.productId || '')
    .trim()
    .replace(/-no-shrink$/i, '')
}

export function summarizeLiveRipSet(product, locale = 'pt-BR') {
  const localeKey = locale === 'en' ? 'en' : 'pt-BR'
  const id = productId(product)
  const entry = id ? COLLECTION_TOP_CARDS?.[id] || null : null
  const categoryId = String(product?.categoryId || product?.game || product?.set || '')
  const category = LIVE_RIPS_PRODUCT_CATEGORIES.find((row) => row.id === categoryId)
  const categoryLabel = category?.label?.[localeKey] || category?.label?.en || ''
  const game = GAME_SHORT[categoryId]?.[localeKey] || categoryLabel.replace(/\s*-\s*Booster Box$/i, '').trim()
  const setLabel = String(entry?.labels?.[0] || quoteFromName(product) || '').trim()
  const setCode = String(entry?.setCode || product?.setCode || '').trim()
  const catalog = id ? getLiveRipProductById(id) : null
  const image = [product?.image, catalog?.image].find((value) => {
    const src = String(value || '').trim()
    return src && src !== '/logo.png'
  }) || '/logo.png'
  const packs = firstPositiveInt(product?.packsPerBox, product?.packs, product?.totalPacks)
  const description = findLiveRipSetTheme({
    id,
    categoryId,
    setCode,
    setLabel,
    locale: localeKey,
  })

  return {
    image,
    game,
    setLabel,
    setCode,
    packs,
    language: product?.language || 'Japanese',
    description,
  }
}
