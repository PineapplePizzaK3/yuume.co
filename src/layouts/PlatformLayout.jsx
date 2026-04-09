/**
 * PlatformLayout - Layout for authenticated platform pages.
 * Menu order is stored by stable route keys (locale-independent).
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useCartCount } from '../hooks/useCartCount'
import { useLocalizedPath } from '../hooks/useLocalizedPath'

const NAV_ROUTE_KEYS = ['appDashboard']
const CONTA_ROUTE_KEYS = ['appLounge', 'appConta', 'appCart']
const LOJA_ROUTE_KEYS = ['appLoja']

const ALL_MENU_KEYS = [...NAV_ROUTE_KEYS, ...CONTA_ROUTE_KEYS, ...LOJA_ROUTE_KEYS]

/** Migrate saved paths from older builds to route keys */
const LEGACY_PATH_TO_KEY = {
  '/app/dashboard': 'appDashboard',
  '/en/app/dashboard': 'appDashboard',
  '/app/lounge': 'appLounge',
  '/en/app/lounge': 'appLounge',
  '/app/conta': 'appConta',
  '/en/app/account': 'appConta',
  '/app/cart': 'appCart',
  '/en/app/cart': 'appCart',
  '/app/services': 'appServices',
  '/en/app/services': 'appServices',
  '/app/grupo-de-compras': 'appGrupoCompras',
  '/en/app/group-buying': 'appGrupoCompras',
  '/app/loja': 'appLoja',
  '/en/app/store': 'appLoja',
}

const LABEL_KEY_BY_ROUTE = {
  appDashboard: 'platform.navSummary',
  appLounge: 'platform.navLounge',
  appConta: 'platform.navAccountData',
  appCart: 'platform.navPayments',
  appServices: 'platform.navServices',
  appGrupoCompras: 'platform.navGroupBuy',
  appLoja: 'platform.navStore',
}

const MENU_ORDER_STORAGE_KEY = 'platform_menu_order_v2'

const DEFAULT_MENU_ORDER = {
  nav: [...NAV_ROUTE_KEYS],
  conta: [...CONTA_ROUTE_KEYS],
  loja: [...LOJA_ROUTE_KEYS],
}

function normalizeSectionOrder(value, allowed) {
  const raw = Array.isArray(value) ? value : []
  const migrated = raw.map((item) => {
    if (typeof item !== 'string') return null
    if (ALL_MENU_KEYS.includes(item)) return item
    return LEGACY_PATH_TO_KEY[item] || null
  }).filter(Boolean)
  const safe = migrated.filter((k) => allowed.includes(k))
  for (const k of allowed) {
    if (!safe.includes(k)) safe.push(k)
  }
  return safe
}

function normalizeMenuOrder(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  return {
    nav: normalizeSectionOrder(value.nav, NAV_ROUTE_KEYS),
    conta: normalizeSectionOrder(value.conta, CONTA_ROUTE_KEYS),
    loja: normalizeSectionOrder(value.loja, LOJA_ROUTE_KEYS),
  }
}

function readMenuOrder(userId) {
  if (!userId) return DEFAULT_MENU_ORDER
  try {
    const raw = localStorage.getItem(MENU_ORDER_STORAGE_KEY)
    if (!raw) return DEFAULT_MENU_ORDER
    const all = JSON.parse(raw)
    return normalizeMenuOrder(all?.[userId])
  } catch {
    return DEFAULT_MENU_ORDER
  }
}

function writeMenuOrder(userId, menuOrder) {
  if (!userId) return
  try {
    const raw = localStorage.getItem(MENU_ORDER_STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = normalizeMenuOrder(menuOrder)
    localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

export function PlatformLayout() {
  const { t } = useTranslation()
  const path = useLocalizedPath()
  const { user, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const cartCount = useCartCount(user?.id)
  const hasCartItems = cartCount > 0
  const cartBadgeLabel = cartCount > 99 ? '99+' : String(cartCount)
  const [lojaOpen, setLojaOpen] = useState(true)
  const [contaOpen, setContaOpen] = useState(true)
  const [menuOrder, setMenuOrder] = useState(DEFAULT_MENU_ORDER)
  const [draggingItem, setDraggingItem] = useState(null)
  const [referralBannerDismissed, setReferralBannerDismissed] = useState(false)

  const dismissReferralBanner = () => {
    setReferralBannerDismissed(true)
  }

  const p = path

  const isActive = useCallback((routeKey) => location.pathname === p(routeKey), [location.pathname, p])

  const isInLoja = useMemo(
    () => LOJA_ROUTE_KEYS.some((k) => p(k) === location.pathname),
    [location.pathname, p]
  )
  const isInConta = useMemo(
    () => CONTA_ROUTE_KEYS.some((k) => p(k) === location.pathname),
    [location.pathname, p]
  )

  const navItemsByKey = useMemo(() => {
    const map = new Map()
    for (const k of ALL_MENU_KEYS) {
      map.set(k, { routeKey: k, to: p(k), label: t(LABEL_KEY_BY_ROUTE[k]) })
    }
    return map
  }, [p, t])

  const orderedNavItems = menuOrder.nav
    .map((k) => navItemsByKey.get(k))
    .filter(Boolean)
  const orderedContaItems = menuOrder.conta
    .map((k) => navItemsByKey.get(k))
    .filter(Boolean)
  const orderedLojaItems = menuOrder.loja
    .map((k) => navItemsByKey.get(k))
    .filter(Boolean)

  useEffect(() => {
    if (isInLoja) setLojaOpen(true)
  }, [isInLoja])
  useEffect(() => {
    if (isInConta) setContaOpen(true)
  }, [isInConta])

  useEffect(() => {
    setMenuOrder(readMenuOrder(user?.id))
  }, [user?.id])

  useEffect(() => {
    writeMenuOrder(user?.id, menuOrder)
  }, [user?.id, menuOrder])

  const handleReorder = (section, draggedKey, targetKey) => {
    if (!section || !draggedKey || !targetKey || draggedKey === targetKey) return
    setMenuOrder((prev) => {
      const current = Array.isArray(prev?.[section]) ? [...prev[section]] : []
      const draggedIndex = current.indexOf(draggedKey)
      const targetIndex = current.indexOf(targetKey)
      if (draggedIndex < 0 || targetIndex < 0) return prev
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedKey)
      return { ...prev, [section]: current }
    })
  }

  const dashboardPath = p('appDashboard')
  const adminBase = p('appAdmin')

  const mobileTabs = useMemo(
    () => [
      {
        id: 'lounge',
        routeKey: 'appLounge',
        label: t('platform.mobileLounge'),
        active: isActive('appLounge'),
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 19.5l3-1.8 3 1.8-.813-3.596L17 13.5l-3.688-.318L12 9.75l-1.312 3.432L7 13.5l2.813 2.404z" />
          </svg>
        ),
      },
      {
        id: 'loja-virtual',
        routeKey: 'appLoja',
        label: t('platform.mobileStore'),
        active: isActive('appLoja'),
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5h18M5.25 7.5l1.5 12a1.5 1.5 0 001.49 1.313h7.52a1.5 1.5 0 001.49-1.313l1.5-12M9 11.25h.008v.008H9v-.008zm6 0h.008v.008H15v-.008z" />
          </svg>
        ),
      },
      {
        id: 'minha-conta',
        routeKey: 'appConta',
        label: t('platform.mobileAccount'),
        active: isActive('appConta'),
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a8.25 8.25 0 0115 0" />
          </svg>
        ),
      },
    ],
    [isActive, t]
  )

  const isPlatformHome = location.pathname === dashboardPath
  const showReferralBanner = isPlatformHome && !referralBannerDismissed

  const adminActive =
    location.pathname === adminBase || location.pathname.startsWith(`${adminBase}/`)

  return (
    <div className="flex min-h-screen flex-col pt-16 lg:flex-row">
      {showReferralBanner && (
        <div
          id="platform-referral-banner"
          className="fixed left-0 right-0 top-16 z-30 flex items-center gap-2 bg-green-600 py-2 pl-4 pr-2 text-sm font-medium text-white"
        >
          <div className="min-w-0 flex-1">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 text-center">
              <span>{t('platform.referralBanner')}</span>
              <Link
                to={`${dashboardPath}#referral-section`}
                className="rounded border border-white/70 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {t('platform.referralCta')}
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissReferralBanner}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={t('platform.referralClose')}
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
      )}
      <nav
        id="platform-mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-earth-200 bg-earth-50/98 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-1 pb-[calc(env(safe-area-inset-bottom)+0.2rem)] pt-0.5">
          {mobileTabs.map((tab) => (
            <Link
              key={tab.id}
              to={p(tab.routeKey)}
              className={`flex min-h-[3.35rem] flex-col items-center justify-center px-1 text-[0.62rem] font-medium transition ${
                tab.id === 'lounge'
                  ? 'relative -translate-y-1'
                  : `rounded-lg ${
                      tab.active
                        ? 'bg-earth-900 text-earth-50'
                        : 'text-earth-600 hover:bg-earth-100'
                    }`
              }`}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.id === 'lounge' ? (
                <>
                  <span
                    className={`flex h-[4rem] w-[4rem] flex-col items-center justify-center rounded-full shadow-lg ${
                      tab.active
                        ? 'bg-earth-900 text-earth-50 ring-2 ring-earth-50'
                        : 'bg-earth-200 text-earth-700'
                    }`}
                  >
                    {tab.icon}
                    <span className="mt-0.5 text-[.6rem] leading-none font-semibold">
                      {tab.label}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {tab.icon}
                  <span className="mt-1 truncate">{tab.label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>

      <aside
        className={`hidden w-56 shrink-0 border-r border-earth-200 bg-earth-100 lg:block lg:min-h-screen ${showReferralBanner ? 'mt-9' : 'mt-0'}`}
      >
        <div className="flex flex-col gap-0 p-4">
          {orderedNavItems.map((item) => (
            <div
              key={item.routeKey}
              onDragOver={(e) => {
                if (!draggingItem || draggingItem.section !== 'nav' || draggingItem.key === item.routeKey) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (!draggingItem || draggingItem.section !== 'nav') return
                e.preventDefault()
                handleReorder('nav', draggingItem.key, item.routeKey)
              }}
              className="mb-1"
            >
              <Link
                to={item.to}
                draggable
                onDragStart={(e) => {
                  setDraggingItem({ section: 'nav', key: item.routeKey })
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setDraggingItem(null)}
                className={`block cursor-grab rounded-lg px-4 py-2 font-medium transition active:cursor-grabbing ${
                  isActive(item.routeKey)
                    ? 'bg-earth-900 text-earth-50'
                    : 'text-earth-700 hover:bg-earth-200'
                }`}
              >
                {item.label}
              </Link>
            </div>
          ))}

          <div className="mt-2 w-full">
            <button
              type="button"
              onClick={() => setContaOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm font-medium transition ${
                isInConta ? 'bg-earth-800 text-earth-50' : 'text-earth-700 hover:bg-earth-200'
              }`}
            >
              {t('platform.groupMyAccount')}
              <svg className={`h-4 w-4 transition-transform ${contaOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {contaOpen && (
              <div className="mt-1 ml-3 space-y-0.5 border-l-2 border-earth-300 pl-3">
                {orderedContaItems.map((item) => (
                  <div
                    key={item.routeKey}
                    onDragOver={(e) => {
                      if (!draggingItem || draggingItem.section !== 'conta' || draggingItem.key === item.routeKey) return
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      if (!draggingItem || draggingItem.section !== 'conta') return
                      e.preventDefault()
                      handleReorder('conta', draggingItem.key, item.routeKey)
                    }}
                    className=""
                  >
                    <Link
                      to={item.to}
                      draggable
                      onDragStart={(e) => {
                        setDraggingItem({ section: 'conta', key: item.routeKey })
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      className={`relative flex cursor-grab items-center justify-between rounded-lg px-3 py-2 text-sm transition active:cursor-grabbing ${
                        item.routeKey === 'appCart' && hasCartItems
                          ? 'font-semibold bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200'
                          : isActive(item.routeKey)
                            ? 'font-medium text-earth-900 bg-earth-200'
                            : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.routeKey === 'appCart' && hasCartItems && (
                        <span className="ml-2 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-[0.65rem] font-bold leading-5 text-white shadow-sm">
                          {cartBadgeLabel}
                        </span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <button
              type="button"
              onClick={() => setLojaOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm font-medium transition ${
                isInLoja ? 'bg-earth-800 text-earth-50' : 'text-earth-700 hover:bg-earth-200'
              }`}
            >
              {t('platform.groupStore')}
              <svg className={`h-4 w-4 transition-transform ${lojaOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {lojaOpen && (
              <div className="mt-1 ml-3 space-y-0.5 border-l-2 border-earth-300 pl-3">
                {orderedLojaItems.map((item) => (
                  <div
                    key={item.routeKey}
                    onDragOver={(e) => {
                      if (!draggingItem || draggingItem.section !== 'loja' || draggingItem.key === item.routeKey) return
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      if (!draggingItem || draggingItem.section !== 'loja') return
                      e.preventDefault()
                      handleReorder('loja', draggingItem.key, item.routeKey)
                    }}
                    className=""
                  >
                    <Link
                      to={item.to}
                      draggable
                      onDragStart={(e) => {
                        setDraggingItem({ section: 'loja', key: item.routeKey })
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      className={`block cursor-grab rounded-lg px-3 py-2 text-sm transition active:cursor-grabbing ${
                        isActive(item.routeKey)
                          ? 'font-medium text-earth-900 bg-earth-200'
                          : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <Link
              to={adminBase}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                adminActive
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              {t('platform.navAdmin')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 rounded-lg px-4 py-2 text-left text-sm font-medium text-earth-600 hover:bg-earth-200 lg:mt-auto"
          >
            {t('platform.navSignOut')}
          </button>
        </div>
      </aside>
      <main className={`flex-1 p-4 pb-24 lg:pb-4 ${showReferralBanner ? 'pt-32' : 'pt-20'}`}>
        <div className={`mx-auto ${location.pathname === p('appLoja') ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
