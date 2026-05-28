import { isValidElement } from 'react'
import { FAQ_ITEMS } from '../data/faq'
import { CATEGORIAS_LOJAS } from '../data/lojasOndeComprar'
import { publicStoreGroupPath, publicStoreProductPath } from '../lib/localeRoutes'
import { getProducts } from './productService'
import { getPurchaseGroups } from './groupService'

function textFromReactNode(node) {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return `${node} `
  if (Array.isArray(node)) return node.map(textFromReactNode).join('')
  if (isValidElement(node)) return textFromReactNode(node.props?.children)
  return ''
}

export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchEntry({ id, title, description, type, group, to }) {
  const safeTitle = String(title ?? '').trim()
  const safeDescription = String(description ?? '').trim()
  return {
    id,
    title: safeTitle,
    description: safeDescription,
    type,
    group,
    to,
    haystack: normalizeSearchText(`${safeTitle} ${safeDescription}`),
  }
}

function getScore(entry, normalizedQuery) {
  if (!normalizedQuery || !entry?.haystack) return 0
  const title = normalizeSearchText(entry.title)
  let score = 0
  if (title === normalizedQuery) score += 140
  else if (title.startsWith(normalizedQuery)) score += 90
  else if (title.includes(normalizedQuery)) score += 50
  if (entry.haystack.includes(normalizedQuery)) score += 20
  return score
}

export function buildStaticSearchIndex({ t, path }) {
  const pageEntries = [
    buildSearchEntry({
      id: 'page-home',
      title: t('nav.home'),
      description: t('meta.home.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('home'),
    }),
    buildSearchEntry({
      id: 'page-services',
      title: t('nav.services'),
      description: t('meta.servicosPrecos.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('servicosPrecos'),
    }),
    buildSearchEntry({
      id: 'page-where-to-buy',
      title: t('nav.whereToBuy'),
      description: t('meta.ondeComprar.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('ondeComprar'),
    }),
    buildSearchEntry({
      id: 'page-faq',
      title: t('nav.faq'),
      description: t('meta.faqIndex.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('faqIndex'),
    }),
    buildSearchEntry({
      id: 'page-contact',
      title: t('nav.contact'),
      description: t('meta.contact.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('contact'),
    }),
    buildSearchEntry({
      id: 'page-store',
      title: t('nav.virtualStore'),
      description: t('meta.appLoja.description', { defaultValue: '' }),
      type: 'page',
      group: 'pages',
      to: path('lojaPublicVitrine'),
    }),
  ]

  const faqEntries = FAQ_ITEMS.map((item) =>
    buildSearchEntry({
      id: `faq-${item.id}`,
      title: item.pergunta,
      description: typeof item.resposta === 'string' ? item.resposta : textFromReactNode(item.resposta),
      type: 'faq',
      group: 'faq',
      to: path('faqIndex'),
    })
  )

  const storeDirectoryEntries = CATEGORIAS_LOJAS.flatMap((categoria) => {
    const categoryEntry = buildSearchEntry({
      id: `where-to-buy-category-${categoria.id}`,
      title: categoria.nome,
      description: t('nav.whereToBuy'),
      type: 'storeDirectory',
      group: 'directory',
      to: `${path('ondeComprar')}?categoria=${encodeURIComponent(categoria.id)}`,
    })
    const storeEntries = (categoria.lojas ?? []).map((loja) => {
      const siteNames = Array.isArray(loja.sites) ? loja.sites.map((site) => site?.nome).filter(Boolean).join(' ') : ''
      return buildSearchEntry({
        id: `where-to-buy-store-${categoria.id}-${loja.id ?? loja.nome}`,
        title: loja.nome,
        description: `${categoria.nome} ${loja.descricao ?? ''} ${siteNames}`,
        type: 'storeDirectory',
        group: 'directory',
        to: `${path('ondeComprar')}?categoria=${encodeURIComponent(categoria.id)}`,
      })
    })
    return [categoryEntry, ...storeEntries]
  })

  return [...pageEntries, ...faqEntries, ...storeDirectoryEntries]
}

export function searchStaticIndex(index, query, options = {}) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []
  const limit = Number(options.limit ?? 24)
  return (Array.isArray(index) ? index : [])
    .filter((entry) => entry.haystack.includes(normalizedQuery))
    .map((entry) => ({ ...entry, score: getScore(entry, normalizedQuery) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function buildProductResult(product, locale) {
  return buildSearchEntry({
    id: `product-${product.id}`,
    title: product.name,
    description: `${product.category ?? ''} ${product.description ?? ''}`,
    type: 'storeProduct',
    group: 'products',
    to: publicStoreProductPath(product.id, locale),
  })
}

function buildGroupResult(group, locale) {
  return buildSearchEntry({
    id: `group-${group.id}`,
    title: group.name,
    description: group.description ?? '',
    type: 'storeGroup',
    group: 'groups',
    to: publicStoreGroupPath(group.id, locale),
  })
}

export async function searchDynamicStoreIndex(query, options = {}) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return { products: [], groups: [], errors: [] }
  }

  const locale = options.locale ?? 'pt-BR'
  const productLimit = Number(options.productLimit ?? 6)
  const groupLimit = Number(options.groupLimit ?? 4)

  const [productsResponse, groupsResponse] = await Promise.all([
    getProducts(),
    getPurchaseGroups('all'),
  ])

  const products = (productsResponse?.data ?? [])
    .map((product) => buildProductResult(product, locale))
    .filter((entry) => entry.haystack.includes(normalizedQuery))
    .map((entry) => ({ ...entry, score: getScore(entry, normalizedQuery) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, productLimit)

  const groups = (groupsResponse?.data ?? [])
    .map((group) => buildGroupResult(group, locale))
    .filter((entry) => entry.haystack.includes(normalizedQuery))
    .map((entry) => ({ ...entry, score: getScore(entry, normalizedQuery) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, groupLimit)

  const errors = []
  if (productsResponse?.error) errors.push(productsResponse.error)
  if (groupsResponse?.error) errors.push(groupsResponse.error)

  return { products, groups, errors }
}
