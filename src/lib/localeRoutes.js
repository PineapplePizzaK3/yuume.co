/**
 * Single source of truth for locale-specific URLs (SEO: one URL per language).
 * @typedef {'pt-BR'|'en'} SiteLocale
 */

export const LOCALE_PT_BR = 'pt-BR'
export const LOCALE_EN = 'en'

/** @type {Record<string, Record<SiteLocale, string>>} */
export const ROUTES = {
  home: { [LOCALE_PT_BR]: '/', [LOCALE_EN]: '/en' },
  servicosPrecos: { [LOCALE_PT_BR]: '/servicos-e-precos', [LOCALE_EN]: '/en/services-pricing' },
  servicosFretes: { [LOCALE_PT_BR]: '/servicos-e-precos/fretes-prazos', [LOCALE_EN]: '/en/services-pricing/shipping-times' },
  servicosSimulador: { [LOCALE_PT_BR]: '/servicos-e-precos/simulador', [LOCALE_EN]: '/en/services-pricing/shipping-calculator' },
  faqIndex: { [LOCALE_PT_BR]: '/faq', [LOCALE_EN]: '/en/help' },
  faqProhibited: { [LOCALE_PT_BR]: '/faq/itens-proibidos', [LOCALE_EN]: '/en/help/prohibited-items' },
  faqCustoms: { [LOCALE_PT_BR]: '/faq/taxas-alfandegarias', [LOCALE_EN]: '/en/help/customs-fees' },
  ondeComprar: { [LOCALE_PT_BR]: '/onde-comprar', [LOCALE_EN]: '/en/where-to-buy' },
  catalogSearchPublic: { [LOCALE_PT_BR]: '/busca-catalogo', [LOCALE_EN]: '/en/catalog-search' },
  ephemeralProductPublic: { [LOCALE_PT_BR]: '/produto-temporario', [LOCALE_EN]: '/en/instant-product' },
  contact: { [LOCALE_PT_BR]: '/contact', [LOCALE_EN]: '/en/contact' },
  lojaPublic: { [LOCALE_PT_BR]: '/loja', [LOCALE_EN]: '/en/store' },
  lojaPublicVitrine: { [LOCALE_PT_BR]: '/loja/vitrine', [LOCALE_EN]: '/en/store/storefront' },
  lojaPublicProgramadas: { [LOCALE_PT_BR]: '/loja/compras-programadas', [LOCALE_EN]: '/en/store/scheduled-buying' },
  lojaPublicProgramadasOnline: {
    [LOCALE_PT_BR]: '/loja/compras-programadas/online',
    [LOCALE_EN]: '/en/store/scheduled-buying/online',
  },
  lojaPublicProgramadasFisica: {
    [LOCALE_PT_BR]: '/loja/compras-programadas/fisica',
    [LOCALE_EN]: '/en/store/scheduled-buying/physical',
  },
  login: { [LOCALE_PT_BR]: '/login', [LOCALE_EN]: '/en/login' },
  register: { [LOCALE_PT_BR]: '/register', [LOCALE_EN]: '/en/register' },
  forgotPassword: { [LOCALE_PT_BR]: '/forgot-password', [LOCALE_EN]: '/en/forgot-password' },
  resetPassword: { [LOCALE_PT_BR]: '/reset-password', [LOCALE_EN]: '/en/reset-password' },
  legalPrivacy: { [LOCALE_PT_BR]: '/legal/privacy', [LOCALE_EN]: '/en/legal/privacy' },
  legalTerms: { [LOCALE_PT_BR]: '/legal/terms', [LOCALE_EN]: '/en/legal/terms' },
  legalCommercial: { [LOCALE_PT_BR]: '/legal/commercial-disclosure', [LOCALE_EN]: '/en/legal/commercial-disclosure' },

  appDashboard: { [LOCALE_PT_BR]: '/app/dashboard', [LOCALE_EN]: '/en/app/dashboard' },
  appCompleteSocial: { [LOCALE_PT_BR]: '/app/complete-social-profile', [LOCALE_EN]: '/en/app/complete-social-profile' },
  appLounge: { [LOCALE_PT_BR]: '/app/lounge', [LOCALE_EN]: '/en/app/lounge' },
  appServices: { [LOCALE_PT_BR]: '/app/services', [LOCALE_EN]: '/en/app/services' },
  appProfile: { [LOCALE_PT_BR]: '/app/profile', [LOCALE_EN]: '/en/app/profile' },
  appConta: { [LOCALE_PT_BR]: '/app/conta', [LOCALE_EN]: '/en/app/account' },
  appLoja: { [LOCALE_PT_BR]: '/app/loja', [LOCALE_EN]: '/en/app/store' },
  appCart: { [LOCALE_PT_BR]: '/app/cart', [LOCALE_EN]: '/en/app/cart' },
  appGrupoCompras: { [LOCALE_PT_BR]: '/app/grupo-de-compras', [LOCALE_EN]: '/en/app/group-buying' },
  appGrupoComprasOnline: {
    [LOCALE_PT_BR]: '/app/grupo-de-compras/online',
    [LOCALE_EN]: '/en/app/group-buying/online',
  },
  appGrupoComprasFisica: {
    [LOCALE_PT_BR]: '/app/grupo-de-compras/fisica',
    [LOCALE_EN]: '/en/app/group-buying/physical',
  },
  appInvoices: { [LOCALE_PT_BR]: '/app/invoices', [LOCALE_EN]: '/en/app/invoices' },

  appAdmin: { [LOCALE_PT_BR]: '/app/admin', [LOCALE_EN]: '/en/app/admin' },
  appAdminPedidos: { [LOCALE_PT_BR]: '/app/admin/pedidos', [LOCALE_EN]: '/en/app/admin/orders' },
  appAdminOrcamentos: { [LOCALE_PT_BR]: '/app/admin/orcamentos', [LOCALE_EN]: '/en/app/admin/quotes' },
  appAdminUsuarios: { [LOCALE_PT_BR]: '/app/admin/usuarios', [LOCALE_EN]: '/en/app/admin/users' },
  appAdminEnvios: { [LOCALE_PT_BR]: '/app/admin/envios', [LOCALE_EN]: '/en/app/admin/shipping' },
  appAdminProdutos: { [LOCALE_PT_BR]: '/app/admin/produtos', [LOCALE_EN]: '/en/app/admin/products' },
  appAdminCatalogo: { [LOCALE_PT_BR]: '/app/admin/catalogo-produtos', [LOCALE_EN]: '/en/app/admin/catalog' },
  appAdminGrupos: { [LOCALE_PT_BR]: '/app/admin/grupos', [LOCALE_EN]: '/en/app/admin/groups' },
  appAdminCalculadoraBrasil: {
    [LOCALE_PT_BR]: '/app/admin/calculadora-brasil',
    [LOCALE_EN]: '/en/app/admin/brazil-calculator',
  },
  appAdminLotes: {
    [LOCALE_PT_BR]: '/app/admin/lotes',
    [LOCALE_EN]: '/en/app/admin/batches',
  },
  appAdminMarketing: { [LOCALE_PT_BR]: '/app/admin/marketing', [LOCALE_EN]: '/en/app/admin/marketing' },
  appAdminFraude: { [LOCALE_PT_BR]: '/app/admin/fraude', [LOCALE_EN]: '/en/app/admin/fraud' },
  appAdminNotificacoes: { [LOCALE_PT_BR]: '/app/admin/notificacoes', [LOCALE_EN]: '/en/app/admin/notifications' },
  appAdminRecargas: { [LOCALE_PT_BR]: '/app/admin/recargas', [LOCALE_EN]: '/en/app/admin/top-ups' },
  appAdminInvoices: { [LOCALE_PT_BR]: '/app/admin/invoices', [LOCALE_EN]: '/en/app/admin/invoices' },
  appAdminLogs: { [LOCALE_PT_BR]: '/app/admin/logs', [LOCALE_EN]: '/en/app/admin/logs' },
}

/**
 * @param {string} pathname
 * @returns {SiteLocale}
 */
export function getLocaleFromPathname(pathname) {
  if (pathname === '/en' || pathname.startsWith('/en/')) return LOCALE_EN
  return LOCALE_PT_BR
}

/**
 * @param {keyof typeof ROUTES} routeKey
 * @param {SiteLocale} locale
 * @param {string} [queryAndHash] e.g. "?tab=pedidos" or "#section"
 * @returns {string}
 */
export function localizedPath(routeKey, locale, queryAndHash = '') {
  const row = ROUTES[routeKey]
  if (!row) {
    console.warn(`localeRoutes: unknown routeKey "${routeKey}"`)
    return '/'
  }
  return row[locale] + queryAndHash
}

export function siteBaseUrl() {
  const raw = import.meta.env.VITE_SITE_URL || ''
  const fromEnv = String(raw).replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

/**
 * Absolute URLs for hreflang alternates.
 * @param {keyof typeof ROUTES} routeKey
 * @returns {{ ptBR: string, en: string }}
 */
export function alternateUrls(routeKey) {
  const base = siteBaseUrl()
  const row = ROUTES[routeKey]
  if (!row) {
    return { ptBR: base + '/', en: base + '/en' }
  }
  const prefix = base || ''
  return {
    ptBR: `${prefix}${row[LOCALE_PT_BR]}`,
    en: `${prefix}${row[LOCALE_EN]}`,
  }
}

/**
 * True if pathname is the account onboarding route (same slug in both locales).
 * @param {string} pathname
 */
export function isCompleteSocialProfilePath(pathname) {
  return /\/complete-social-profile\/?$/.test(pathname)
}

/** @param {string} pathname */
export function isAppPath(pathname) {
  return pathname.startsWith('/app') || pathname.startsWith('/en/app')
}

/**
 * Active state for nav links (both locales).
 * @param {keyof typeof ROUTES} routeKey
 * @param {string} pathname
 * @param {boolean} [prefix] match start (e.g. FAQ section, services hub)
 */
export function isRouteActive(routeKey, pathname, prefix = false) {
  const row = ROUTES[routeKey]
  if (!row) return false
  const pt = row[LOCALE_PT_BR]
  const en = row[LOCALE_EN]
  if (prefix) {
    return (
      pathname === pt ||
      pathname === en ||
      pathname.startsWith(`${pt}/`) ||
      pathname.startsWith(`${en}/`)
    )
  }
  return pathname === pt || pathname === en
}

const PATH_TO_KEY_PT = {}
const PATH_TO_KEY_EN = {}
for (const k of Object.keys(ROUTES)) {
  PATH_TO_KEY_PT[ROUTES[k][LOCALE_PT_BR]] = k
  PATH_TO_KEY_EN[ROUTES[k][LOCALE_EN]] = k
}

/**
 * @param {string} pathname pathname only (no ?query)
 * @returns {keyof typeof ROUTES|null}
 */
export function pathnameToRouteKey(pathname) {
  const loc = getLocaleFromPathname(pathname)
  const table = loc === LOCALE_EN ? PATH_TO_KEY_EN : PATH_TO_KEY_PT
  const direct = table[pathname]
  if (direct) return direct

  const adminPrefix = loc === LOCALE_EN ? '/en/app/admin/' : '/app/admin/'
  if (pathname.startsWith(adminPrefix)) {
    const rest = pathname.slice(adminPrefix.length)
    if (rest.includes('/')) {
      const lastSeg = rest.split('/').filter(Boolean).pop()
      if (lastSeg) {
        const legacyPath = `${adminPrefix}${lastSeg}`
        const byLastSegment = table[legacyPath]
        if (byLastSegment) return byLastSegment
      }
    }
  }

  return null
}

/**
 * Same page in the other locale (preserves query string).
 * @param {string} pathnameAndSearch
 */
export function alternateLocalePath(pathnameAndSearch) {
  const qIndex = pathnameAndSearch.indexOf('?')
  const pathname = qIndex >= 0 ? pathnameAndSearch.slice(0, qIndex) : pathnameAndSearch
  const qs = qIndex >= 0 ? pathnameAndSearch.slice(qIndex) : ''
  const loc = getLocaleFromPathname(pathname)
  const key = pathnameToRouteKey(pathname)
  if (!key) return pathnameAndSearch
  const nextLoc = loc === LOCALE_EN ? LOCALE_PT_BR : LOCALE_EN
  return localizedPath(key, nextLoc) + qs
}

/**
 * Same logical route in the given locale (preserves query string).
 * Unknown paths are returned unchanged (same as alternateLocalePath fallback).
 * @param {string} pathnameAndSearch
 * @param {SiteLocale} targetLocale
 */
export function localizedRoutePath(pathnameAndSearch, targetLocale) {
  const qIndex = pathnameAndSearch.indexOf('?')
  const pathname = qIndex >= 0 ? pathnameAndSearch.slice(0, qIndex) : pathnameAndSearch
  const qs = qIndex >= 0 ? pathnameAndSearch.slice(qIndex) : ''
  const key = pathnameToRouteKey(pathname)
  if (!key) return pathnameAndSearch
  return localizedPath(key, targetLocale) + qs
}

/**
 * Página de detalhe de produto (logado /app ou /en/app).
 * @param {string} productId
 * @param {SiteLocale} locale
 * @param {{ variantId?: string }} [options] — `variantId` vira query `?v=` (compartilhar versão).
 */
export function appStoreProductPath(productId, locale, options = {}) {
  const id = String(productId ?? '').trim()
  if (!id) return localizedPath('appLoja', locale)
  const enc = encodeURIComponent(id)
  const base = locale === LOCALE_EN ? `/en/app/store/product/${enc}` : `/app/loja/produto/${enc}`
  const vid = options?.variantId != null ? String(options.variantId).trim() : ''
  if (!vid) return base
  return `${base}?v=${encodeURIComponent(vid)}`
}

/**
 * Página de detalhe de grupo de compras (logado /app ou /en/app).
 * @param {string} groupId
 * @param {SiteLocale} locale
 */
export function appStoreGroupPath(groupId, locale) {
  const id = String(groupId ?? '').trim()
  if (!id) return localizedPath('appLoja', locale)
  const enc = encodeURIComponent(id)
  return locale === LOCALE_EN ? `/en/app/store/group/${enc}` : `/app/loja/grupo/${enc}`
}

/**
 * Página de detalhe de grupo (vitrine pública).
 * @param {string} groupId
 * @param {SiteLocale} locale
 */
export function publicStoreGroupPath(groupId, locale) {
  const id = String(groupId ?? '').trim()
  if (!id) return localizedPath('lojaPublicVitrine', locale)
  const enc = encodeURIComponent(id)
  return locale === LOCALE_EN
    ? `/en/store/storefront/group/${enc}`
    : `/loja/vitrine/grupo/${enc}`
}

/**
 * Página de detalhe de produto (vitrine pública).
 * @param {string} productId
 * @param {SiteLocale} locale
 * @param {{ variantId?: string }} [options] — `variantId` vira query `?v=` (compartilhar versão).
 */
export function publicStoreProductPath(productId, locale, options = {}) {
  const id = String(productId ?? '').trim()
  if (!id) return localizedPath('lojaPublicVitrine', locale)
  const enc = encodeURIComponent(id)
  const base = locale === LOCALE_EN ? `/en/store/storefront/product/${enc}` : `/loja/vitrine/produto/${enc}`
  const vid = options?.variantId != null ? String(options.variantId).trim() : ''
  if (!vid) return base
  return `${base}?v=${encodeURIComponent(vid)}`
}

/**
 * Página de detalhe de produto efêmero (busca pública).
 * @param {string} token
 * @param {SiteLocale} locale
 */
export function publicEphemeralProductPath(token, locale) {
  const id = String(token ?? '').trim()
  if (!id) return localizedPath('catalogSearchPublic', locale)
  const enc = encodeURIComponent(id)
  return locale === LOCALE_EN
    ? `/en/instant-product/${enc}`
    : `/produto-temporario/${enc}`
}
