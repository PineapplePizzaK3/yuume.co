export const ADMIN_TABS = [
  { id: 'pedidos', path: 'pedidos', label: 'Pedidos', icon: '📦' },
  { id: 'usuarios', path: 'usuarios', label: 'Usuários', icon: '👤' },
  { id: 'envios', path: 'envios', label: 'Envios', icon: '🚚' },
  { id: 'produtos', path: 'produtos', label: 'Produtos Loja', icon: '🛒' },
  { id: 'catalogo_produtos', path: 'catalogo-produtos', label: 'Lista de Produtos', icon: '📚' },
  { id: 'busca_catalogo', path: 'busca-catalogo', label: 'Busca em Catálogos', icon: '🔎' },
  { id: 'grupos', path: 'grupos', label: 'Grupo de Compras', icon: '👥' },
  { id: 'marketing', path: 'marketing', label: 'Referral', icon: '🎯' },
  { id: 'fraude', path: 'fraude', label: 'Fraude', icon: '🛡️' },
  { id: 'notificacoes', path: 'notificacoes', label: 'Notificações', icon: '🔔' },
  { id: 'recargas', path: 'recargas', label: 'Recargas PIX', icon: '💰' },
  { id: 'logs', path: 'logs', label: 'Logs', icon: '📋' },
]

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

export function adminTabPathFromId(tabId) {
  const safe = normalizeAdminTabId(tabId)
  return TAB_BY_ID.get(safe)?.path || TAB_BY_ID.get(DEFAULT_ADMIN_TAB_ID).path
}

export function adminTabIdFromPath(tabPath) {
  const safe = normalizeAdminTabPath(tabPath)
  return TAB_BY_PATH.get(safe)?.id || DEFAULT_ADMIN_TAB_ID
}
