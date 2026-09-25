/**
 * Catálogo On-Demand (compra direta na Loja).
 * Independente do catálogo Live Rips — mesma fonte externa, uso diferente.
 */
import {
  ON_DEMAND_SNKRDUNK_CATEGORIES,
  ON_DEMAND_SNKRDUNK_LAST_UPDATED_AT,
  ON_DEMAND_SNKRDUNK_PRODUCTS,
  ON_DEMAND_SNKRDUNK_SOURCE,
} from './onDemandSnkrdunkCatalog'

export const ON_DEMAND_SOURCE = ON_DEMAND_SNKRDUNK_SOURCE
export const ON_DEMAND_LAST_UPDATED_AT = ON_DEMAND_SNKRDUNK_LAST_UPDATED_AT
export const ON_DEMAND_PRODUCT_CATEGORIES = ON_DEMAND_SNKRDUNK_CATEGORIES

export const ON_DEMAND_PRODUCTS = ON_DEMAND_SNKRDUNK_PRODUCTS.map((product) => ({
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

export function getOnDemandProductById(productId) {
  return ON_DEMAND_PRODUCTS.find((product) => product.id === productId) || null
}

export function getOnDemandCategoryById(categoryId) {
  return ON_DEMAND_PRODUCT_CATEGORIES.find((category) => category.id === categoryId) || null
}

export function getOnDemandProductsByCategory(categoryId) {
  if (!categoryId) return ON_DEMAND_PRODUCTS
  return ON_DEMAND_PRODUCTS.filter((product) => product.categoryId === categoryId)
}

export function getOnDemandProductName(product, locale = 'pt-BR') {
  if (!product) return ''
  const englishName = String(product.nameEn || '').trim()
  const japaneseName = String(product.name || '').trim()
  if (locale === 'ja') return japaneseName || englishName
  return englishName || japaneseName
}
