import { LOCALE_EN, LOCALE_PT_BR } from '../../../lib/localeRoutes'

export const ADMIN_TABS = [
  { id: 'pedidos', path: 'pedidos', label: 'Pedidos', icon: '📦' },
  { id: 'usuarios', path: 'usuarios', label: 'Usuários', icon: '👤' },
  { id: 'envios', path: 'envios', label: 'Envios', icon: '🚚' },
  { id: 'produtos', path: 'produtos', label: 'Produtos Loja', icon: '🛒' },
  { id: 'catalogo_produtos', path: 'catalogo-produtos', label: 'Lista de Produtos', icon: '📚' },
  { id: 'busca_catalogo', path: 'busca-catalogo', label: 'Busca em Catálogos', icon: '🔎' },
  { id: 'grupos', path: 'grupos', label: 'Compras Programadas', icon: '👥' },
  { id: 'marketing', path: 'marketing', label: 'Referral', icon: '🎯' },
  { id: 'fraude', path: 'fraude', label: 'Fraude', icon: '🛡️' },
  { id: 'notificacoes', path: 'notificacoes', label: 'Notificações', icon: '🔔' },
  { id: 'recargas', path: 'recargas', label: 'Recargas PIX', icon: '💰' },
  { id: 'invoices_admin', path: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'logs', path: 'logs', label: 'Logs', icon: '📋' },
]

/** Portuguese URL segment -> English segment (under /en/app/admin/) */
const ADMIN_PT_TO_EN_SEGMENT = {
  pedidos: 'orders',
  usuarios: 'users',
  envios: 'shipping',
  produtos: 'products',
  'catalogo-produtos': 'catalog',
  'busca-catalogo': 'catalog-search',
  grupos: 'groups',
  marketing: 'marketing',
  fraude: 'fraud',
  notificacoes: 'notifications',
  recargas: 'top-ups',
  invoices: 'invoices',
  logs: 'logs',
}

const EN_TO_PT_ADMIN_SEGMENT = Object.fromEntries(
  Object.entries(ADMIN_PT_TO_EN_SEGMENT).map(([pt, en]) => [en, pt])
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
  const raw = String(tabPath || '').trim()
  const segment = locale === LOCALE_EN ? EN_TO_PT_ADMIN_SEGMENT[raw] || raw : raw
  const safe = normalizeAdminTabPath(segment)
  return TAB_BY_PATH.get(safe)?.id || DEFAULT_ADMIN_TAB_ID
}
