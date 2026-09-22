import {
  LIVE_RIPS_SNKRDUNK_CATEGORIES,
  LIVE_RIPS_SNKRDUNK_LAST_UPDATED_AT,
  LIVE_RIPS_SNKRDUNK_PRODUCTS,
  LIVE_RIPS_SNKRDUNK_SOURCE,
} from './liveRipsSnkrdunkCatalog'

export const LIVE_RIPS_STORAGE_KEY = 'yuumeco_live_rips_reservation_v1'

export const LIVE_RIPS_NEXT_LIVE = {
  id: 'japan-rip-night-01',
  title: 'JAPAN RIP NIGHT #01',
  dateLabel: {
    'pt-BR': 'Domingo, 27 de setembro',
    en: 'Sunday, September 27',
  },
  timeLabel: '20:00 JST',
  availableRips: 6,
}

export const LIVE_RIPS_PRODUCT_CATEGORIES = LIVE_RIPS_SNKRDUNK_CATEGORIES
export const LIVE_RIPS_SOURCE = LIVE_RIPS_SNKRDUNK_SOURCE
export const LIVE_RIPS_LAST_UPDATED_AT = LIVE_RIPS_SNKRDUNK_LAST_UPDATED_AT

export const LIVE_RIPS_PRODUCTS = LIVE_RIPS_SNKRDUNK_PRODUCTS.map((product) => ({
  ...product,
  nameEn: product.nameEn || product.name,
  type: {
    'pt-BR': product.type,
    en: product.type,
  },
  language: {
    'pt-BR': 'Japones',
    en: 'Japanese',
  },
}))

function getFirstProductIdByCategory(categoryId) {
  return LIVE_RIPS_PRODUCTS.find((product) => product.categoryId === categoryId)?.id || ''
}

export const LIVE_RIPS_QUEUE = [
  {
    ripCode: '#001',
    customerName: 'Joao',
    productId: getFirstProductIdByCategory('pokemon-standard') || LIVE_RIPS_PRODUCTS[0]?.id || '',
  },
  {
    ripCode: '#002',
    customerName: 'Maria',
    productId: getFirstProductIdByCategory('one-piece') || LIVE_RIPS_PRODUCTS[1]?.id || '',
  },
  {
    ripCode: '#003',
    customerName: 'Carlos',
    productId: getFirstProductIdByCategory('yugioh') || LIVE_RIPS_PRODUCTS[2]?.id || '',
  },
]

export const LIVE_RIPS_BASE_PULLS = [
  {
    id: 'pull-001',
    name: 'Mega Dream ex SAR',
    rarity: 'SAR',
    image: '/home/tcg-3-wstcg.jpg',
  },
  {
    id: 'pull-002',
    name: 'Dream Supporter SR',
    rarity: 'SR',
    image: '/home/tcg-2-packs.png',
  },
  {
    id: 'pull-003',
    name: 'Energy Gold UR',
    rarity: 'UR',
    image: '/home/tcg-1-japanese-booster-boxes-WLC.png',
  },
]

export const LIVE_RIPS_TIMELINE = [
  'reserved',
  'separated',
  'waitingLive',
  'opening',
  'cardsLogged',
]

export function getLiveRipProductById(productId) {
  return LIVE_RIPS_PRODUCTS.find((product) => product.id === productId) || null
}

export function getLiveRipCategoryById(categoryId) {
  return LIVE_RIPS_PRODUCT_CATEGORIES.find((category) => category.id === categoryId) || null
}

export function getLiveRipProductsByCategory(categoryId) {
  if (!categoryId) return LIVE_RIPS_PRODUCTS
  return LIVE_RIPS_PRODUCTS.filter((product) => product.categoryId === categoryId)
}

export function getLiveRipProductName(product, locale = 'pt-BR') {
  if (!product) return ''
  const englishName = String(product.nameEn || '').trim()
  const japaneseName = String(product.name || '').trim()
  if (locale === 'ja') return japaneseName || englishName
  return englishName || japaneseName
}

export function readReservedLiveRipProductId() {
  if (typeof window === 'undefined') return ''
  try {
    const saved = window.localStorage.getItem(LIVE_RIPS_STORAGE_KEY)
    return saved ? String(saved).trim() : ''
  } catch {
    return ''
  }
}

export function saveReservedLiveRipProductId(productId) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LIVE_RIPS_STORAGE_KEY, productId)
  } catch {
    // Ignore storage errors in prototype mode.
  }
}
