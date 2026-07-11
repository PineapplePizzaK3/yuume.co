import { LOCALE_EN, LOCALE_PT_BR } from '../../../lib/localeRoutes'

export const ADMIN_TAB_CATEGORIES = [
  { id: 'operacao', label: 'Operação', icon: '🧩' },
  { id: 'catalogo', label: 'Catálogo', icon: '🗂️' },
  { id: 'growth', label: 'Growth', icon: '📈' },
  { id: 'financeiro', label: 'Financeiro', icon: '💼' },
  { id: 'sistema', label: 'Sistema', icon: '⚙️' },
]

export const ADMIN_TABS = [
  { id: 'pedidos', path: 'pedidos', label: 'Pedidos', icon: '📦', category: 'operacao' },
  { id: 'usuarios', path: 'usuarios', label: 'Usuários', icon: '👤', category: 'operacao' },
  { id: 'envios', path: 'envios', label: 'Envios', icon: '🚚', category: 'operacao' },
  { id: 'produtos_usuarios', path: 'produtos-usuarios', label: 'Produtos (Usuários)', icon: '📋', category: 'operacao' },
  { id: 'produtos', path: 'produtos', label: 'Produtos Loja', icon: '🛒', category: 'catalogo' },
  { id: 'catalogo_produtos', path: 'catalogo-produtos', label: 'Lista de Produtos', icon: '📚', category: 'catalogo' },
  { id: 'orcamentos', path: 'orcamentos', label: 'Orçamentos', icon: '📝', category: 'catalogo' },
  { id: 'grupos', path: 'grupos', label: 'Compras Programadas', icon: '👥', category: 'catalogo' },
  { id: 'calculadora_brasil', path: 'calculadora-brasil', label: 'Calculadora Brasil', icon: '🧮', category: 'catalogo' },
  { id: 'lotes', path: 'lotes', label: 'Lotes', icon: '📦', category: 'catalogo' },
  { id: 'marketing', path: 'marketing', label: 'Cupons', icon: '🎯', category: 'growth' },
  { id: 'emails_admin', path: 'emails', label: 'E-mails', icon: '✉️', category: 'growth' },
  { id: 'fraude', path: 'fraude', label: 'Fraude', icon: '🛡️', category: 'growth' },
  { id: 'notificacoes', path: 'notificacoes', label: 'Notificações', icon: '🔔', category: 'growth' },
  { id: 'recargas', path: 'recargas', label: 'Recargas PIX', icon: '💰', category: 'financeiro' },
  { id: 'invoices_admin', path: 'invoices', label: 'Invoices', icon: '🧾', category: 'financeiro' },
  { id: 'logs', path: 'logs', label: 'Logs', icon: '📋', category: 'sistema' },
]

/** Portuguese URL segment -> English segment (under /en/app/admin/) */
const ADMIN_PT_TO_EN_SEGMENT = {
  pedidos: 'orders',
  orcamentos: 'quotes',
  usuarios: 'users',
  envios: 'shipping',
  'produtos-usuarios': 'user-products',
  produtos: 'products',
  'catalogo-produtos': 'catalog',
  grupos: 'groups',
  'calculadora-brasil': 'brazil-calculator',
  lotes: 'batches',
  marketing: 'marketing',
  emails: 'emails',
  fraude: 'fraud',
  notificacoes: 'notifications',
  recargas: 'top-ups',
  invoices: 'invoices',
  logs: 'logs',
}

const EN_TO_PT_ADMIN_SEGMENT = Object.fromEntries(
  Object.entries(ADMIN_PT_TO_EN_SEGMENT).map(([pt, en]) => [en, pt])
)

const ADMIN_CATEGORY_PT_TO_EN_SEGMENT = {
  operacao: 'operations',
  catalogo: 'catalog',
  growth: 'growth',
  financeiro: 'finance',
  sistema: 'system',
}

const ADMIN_CATEGORY_EN_TO_PT_SEGMENT = Object.fromEntries(
  Object.entries(ADMIN_CATEGORY_PT_TO_EN_SEGMENT).map(([pt, en]) => [en, pt])
)

const TAB_BY_ID = new Map(ADMIN_TABS.map((tab) => [tab.id, tab]))
const TAB_BY_PATH = new Map(ADMIN_TABS.map((tab) => [tab.path, tab]))

export const DEFAULT_ADMIN_TAB_ID = 'pedidos'

export function normalizeAdminTabId(tabId) {
  const raw = String(tabId || '').trim()
  return TAB_BY_ID.has(raw) ? raw : DEFAULT_ADMIN_TAB_ID
}

export function normalizeAdminTabPath(tabPath) {
  const raw = String(tabPath || '').trim()
  return TAB_BY_PATH.has(raw) ? raw : TAB_BY_ID.get(DEFAULT_ADMIN_TAB_ID).path
}

/**
 * @param {string} tabId
 * @param {typeof LOCALE_PT_BR | typeof LOCALE_EN} [locale]
 */
export function adminTabPathFromId(tabId, locale = LOCALE_PT_BR) {
  const safe = normalizeAdminTabId(tabId)
  const ptPath = TAB_BY_ID.get(safe)?.path || TAB_BY_ID.get(DEFAULT_ADMIN_TAB_ID).path
  if (locale === LOCALE_EN) {
    return ADMIN_PT_TO_EN_SEGMENT[ptPath] || ptPath
  }
  return ptPath
}

export function adminTabIdFromPath(tabPath, locale = LOCALE_PT_BR) {
  const raw = String(tabPath || '').trim().replace(/^\/+|\/+$/g, '')
  const lastSegment = raw.includes('/') ? raw.split('/').pop() : raw
  const normalizedLast = String(lastSegment || '').trim()
  const categorySegment = raw.includes('/') ? raw.split('/')[0] : ''
  const categoryPt =
    locale === LOCALE_EN
      ? ADMIN_CATEGORY_EN_TO_PT_SEGMENT[categorySegment] || categorySegment
      : categorySegment
  if (categoryPt && !ADMIN_TAB_CATEGORIES.some((cat) => cat.id === categoryPt)) {
    return DEFAULT_ADMIN_TAB_ID
  }
  const segment =
    locale === LOCALE_EN
      ? EN_TO_PT_ADMIN_SEGMENT[normalizedLast] || normalizedLast
      : normalizedLast
  const safe = normalizeAdminTabPath(segment)
  return TAB_BY_PATH.get(safe)?.id || DEFAULT_ADMIN_TAB_ID
}

export function getAdminCategoryByTabId(tabId) {
  const safe = normalizeAdminTabId(tabId)
  const cat = TAB_BY_ID.get(safe)?.category
  return cat || 'operacao'
}

export function adminCategoryPathFromId(categoryId, locale = LOCALE_PT_BR) {
  const safeCategory = String(categoryId || '').trim()
  const fallback = getAdminCategoryByTabId(DEFAULT_ADMIN_TAB_ID)
  const ptCategory = ADMIN_TAB_CATEGORIES.some((cat) => cat.id === safeCategory) ? safeCategory : fallback
  if (locale === LOCALE_EN) {
    return ADMIN_CATEGORY_PT_TO_EN_SEGMENT[ptCategory] || ptCategory
  }
  return ptCategory
}

export function adminGroupedTabPathFromId(tabId, locale = LOCALE_PT_BR) {
  const categorySeg = adminCategoryPathFromId(getAdminCategoryByTabId(tabId), locale)
  const tabSeg = adminTabPathFromId(tabId, locale)
  return `${categorySeg}/${tabSeg}`
}
