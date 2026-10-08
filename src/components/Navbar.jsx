import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { REDES_SOCIAIS } from '../data/redesSociais'
import { useAuth } from '../hooks/useAuth'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useLocalizedPath } from '../hooks/useLocalizedPath'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { useCollectorFlags } from '../hooks/useCollectorFlags'
import { isRouteActive } from '../lib/localeRoutes'
import { buildStaticSearchIndex } from '../services/globalSearchService'
import { LocalizedLink } from './LocalizedLink'
import { HeaderCredits } from './HeaderCredits'
import { LanguageSwitcherDropdown, LanguageSwitcherInline } from './LanguageSwitcher'
import { GlobalSearchModal } from './search/GlobalSearchModal'
import { headerShell, headerShellStyle, FULL_BLEED_HEADER, HEADER_FEATURE_STYLE } from '../lib/layout'

function NavIcon({ name, className = 'h-4 w-4 shrink-0' }) {
  const paths = {
    home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    products:
      'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    boxBreak:
      'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    services: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
    contact:
      'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
    chevron: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
    collection:
      'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={paths[name]} />
    </svg>
  )
}

function NavItemLabel({ icon, children, chevron = false, badgeClass }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {badgeClass ? (
        <span className={badgeClass}>
          <NavIcon name={icon} />
        </span>
      ) : (
        <NavIcon name={icon} />
      )}
      <span>{children}</span>
      {chevron ? <NavIcon name="chevron" className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
    </span>
  )
}

function Navbar() {
  const { t } = useTranslation()
  const { isAuthenticated, user, profile, isAdmin, signOut } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const locale = useSiteLocale()
  const path = useLocalizedPath()
  const unreadNotifications = useUnreadNotifications(user?.id, 20)
  const hasUnreadNotifications = unreadNotifications > 0
  const { openings: openingsEnabled } = useCollectorFlags()

  const fecharMenu = () => setMenuAberto(false)

  const activeBarClass = (active, tone = 'earth') => {
    if (!active) return 'relative'
    return tone === 'collector'
      ? 'relative after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-collector-600'
      : 'relative after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-earth-900'
  }
  const quietNavClass = (active) =>
    `flex items-center px-2.5 text-sm transition ${
      active
        ? 'font-semibold text-earth-900'
        : 'text-earth-600 hover:text-earth-900'
    }`
  const featuredBoxClass = (active) => {
    if (HEADER_FEATURE_STYLE === 'underline') {
      return `flex items-center self-center px-2.5 py-1.5 text-sm font-semibold transition ${
        active ? 'text-earth-900' : 'text-earth-600 hover:text-earth-900'
      }`
    }
    if (HEADER_FEATURE_STYLE === 'icon-badge') {
      return `flex items-center self-center px-2.5 py-1.5 text-sm transition ${
        active
          ? 'font-semibold text-earth-900'
          : 'text-earth-600 hover:text-earth-900'
      }`
    }
    return `flex items-center self-center rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
      active
        ? 'bg-collector-700 text-white ring-2 ring-collector-100'
        : 'bg-collector-600 text-white hover:bg-collector-700'
    }`
  }
  const featuredServicesClass = (active) => {
    if (HEADER_FEATURE_STYLE === 'underline') {
      return `flex items-center self-center px-2.5 py-1.5 text-sm font-semibold transition ${
        active ? 'text-earth-900' : 'text-earth-600 hover:text-earth-900'
      }`
    }
    if (HEADER_FEATURE_STYLE === 'icon-badge') {
      return `flex items-center self-center px-2.5 py-1.5 text-sm transition ${
        active
          ? 'font-semibold text-earth-900'
          : 'text-earth-600 hover:text-earth-900'
      }`
    }
    return `flex items-center self-center rounded-lg border-2 px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
      active
        ? 'border-earth-900 bg-earth-900 text-earth-50'
        : 'border-earth-900 bg-white text-earth-900 hover:bg-earth-900 hover:text-earth-50'
    }`
  }
  const featuredBoxBadge = (active) =>
    HEADER_FEATURE_STYLE === 'icon-badge'
      ? `inline-flex h-7 w-7 items-center justify-center rounded-md text-white ${
          active ? 'bg-collector-700' : 'bg-collector-600'
        }`
      : undefined
  const featuredServicesBadge = (active) =>
    HEADER_FEATURE_STYLE === 'icon-badge'
      ? `inline-flex h-7 w-7 items-center justify-center rounded-md text-earth-50 ${
          active ? 'bg-earth-900' : 'bg-earth-800'
        }`
      : undefined
  const mobileQuietClass = (active) =>
    `flex items-center gap-2 rounded-lg border-l-4 px-4 py-3 ${
      active
        ? 'border-earth-900 bg-earth-100 font-semibold text-earth-900'
        : 'border-transparent text-earth-600 hover:bg-earth-50 hover:text-earth-900'
    }`
  const mobileFeaturedBoxClass = (active) => {
    if (HEADER_FEATURE_STYLE === 'underline') {
      return `flex items-center gap-2 border-l-4 px-4 py-3 font-semibold ${
        active
          ? 'border-collector-600 bg-earth-100 text-earth-900'
          : 'border-transparent text-earth-600 hover:text-earth-900'
      }`
    }
    if (HEADER_FEATURE_STYLE === 'icon-badge') {
      return `flex items-center gap-2 border-l-4 px-4 py-3 ${
        active
          ? 'border-collector-600 bg-earth-100 font-semibold text-earth-900'
          : 'border-transparent text-earth-600 hover:bg-earth-50 hover:text-earth-900'
      }`
    }
    return `flex items-center gap-2 rounded-lg border-l-4 px-4 py-3 font-semibold text-white ${
      active
        ? 'border-collector-800 bg-collector-700'
        : 'border-transparent bg-collector-600 hover:bg-collector-700'
    }`
  }
  const mobileFeaturedServicesClass = (active) => {
    if (HEADER_FEATURE_STYLE === 'underline') {
      return `flex items-center gap-2 border-l-4 px-4 py-3 font-semibold ${
        active
          ? 'border-earth-900 bg-earth-100 text-earth-900'
          : 'border-transparent text-earth-600 hover:text-earth-900'
      }`
    }
    if (HEADER_FEATURE_STYLE === 'icon-badge') {
      return `flex items-center gap-2 border-l-4 px-4 py-3 ${
        active
          ? 'border-earth-900 bg-earth-100 font-semibold text-earth-900'
          : 'border-transparent text-earth-600 hover:bg-earth-50 hover:text-earth-900'
      }`
    }
    return `flex items-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold ${
      active
        ? 'border-earth-900 bg-earth-900 text-earth-50'
        : 'border-earth-900 bg-white text-earth-900 hover:bg-earth-900 hover:text-earth-50'
    }`
  }
  const storeMainRoute = isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'

  const homePath = path('home')
  const isStorePublicRoute = isRouteActive('lojaPublic', location.pathname, true)
  const isStoreAppRoute = isRouteActive('appLoja', location.pathname, true)
  const isStoreServicesRoute = isRouteActive('appServices', location.pathname, true)
  const isCollectorRipsRoute =
    isRouteActive('collectorRips', location.pathname, true) ||
    isRouteActive('collectorBatches', location.pathname, true) ||
    isRouteActive('collectorLives', location.pathname, true) ||
    isRouteActive('collectorOpenings', location.pathname, true) ||
    isRouteActive('aberturas', location.pathname, true) ||
    isRouteActive('liveRipsHub', location.pathname, true)
  const isForwardingRoute =
    isRouteActive('forwardingHome', location.pathname) ||
    isRouteActive('servicosPrecos', location.pathname, true) ||
    isRouteActive('servicos', location.pathname, true) ||
    isRouteActive('faqIndex', location.pathname, true) ||
    isRouteActive('ondeComprar', location.pathname)
  const isProductsRoute =
    isStorePublicRoute ||
    isStoreAppRoute ||
    isStoreServicesRoute ||
    isRouteActive('produtos', location.pathname, true)
  const isCollectionRoute =
    isRouteActive('collectorCollection', location.pathname, true) ||
    isRouteActive('collectorExplore', location.pathname, true) ||
    isRouteActive('collectorWishlist', location.pathname, true)
  const isContactRoute = isRouteActive('contact', location.pathname)
  const currentJapanServicesSection = useMemo(() => {
    if (isRouteActive('servicosPrecos', location.pathname, true)) return 'prices'
    if (isRouteActive('faqIndex', location.pathname, true)) return 'faq'
    if (isRouteActive('ondeComprar', location.pathname)) return 'where'
    return null
  }, [location.pathname])
  const japanServicesSubmenuItems = useMemo(
    () => [
      { id: 'prices', label: t('nav.services'), toRoute: 'servicosPrecos' },
      { id: 'faq', label: t('nav.faq'), toRoute: 'faqIndex' },
      { id: 'where', label: t('nav.whereToBuy'), toRoute: 'ondeComprar' },
    ],
    [t]
  )
  const storeTab = useMemo(() => {
    const value = new URLSearchParams(location.search).get('tab')
    return String(value || '').toLowerCase()
  }, [location.search])
  const onStoreIndex =
    isRouteActive('appLoja', location.pathname) || isRouteActive('lojaPublicVitrine', location.pathname)
  const currentStoreSection = useMemo(() => {
    if (isStoreServicesRoute) return 'servicos'
    if (!onStoreIndex) return null
    if (storeTab === 'snkrdunk') return 'ondemand'
    if (storeTab === 'vitrine' || storeTab === 'grupos') return null
    return 'estoque'
  }, [isStoreServicesRoute, onStoreIndex, storeTab])
  const storeSubmenuItems = useMemo(() => {
    const storeRoute = isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'
    return [
      {
        id: 'estoque',
        label: t('platform.storeHub.tabStock'),
        toRoute: storeRoute,
        search: '',
      },
      {
        id: 'ondemand',
        label: t('platform.storeHub.tabSnkrdunkCatalog'),
        toRoute: storeRoute,
        search: '?tab=snkrdunk',
      },
      {
        id: 'servicos',
        label: t('platform.storeHub.tabServices'),
        toRoute: 'appServices',
        search: '',
      },
    ]
  }, [isAuthenticated, t])
  const staticSearchIndex = useMemo(() => buildStaticSearchIndex({ t, path }), [t, path])
  const searchButtonLabel = locale === 'en' ? 'Search site' : 'Pesquisar no site'
  const searchButtonTitle = locale === 'en' ? 'Search' : 'Pesquisar'

  const handleOpenSearch = () => {
    setMenuAberto(false)
    setSearchOpen(true)
  }

  const handleSearchNavigate = (to) => {
    if (!to) return
    navigate(to)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 overflow-visible bg-earth-50 shadow-sm border-b border-earth-200">
        <div className={`${headerShell} px-3 sm:px-6 lg:px-8`} style={headerShellStyle}>
          <div className="relative flex min-h-[4.5rem] w-full items-center gap-1.5 sm:gap-2 lg:h-[4.5rem] lg:items-stretch">
            <LocalizedLink
            toRoute="home"
            className={`relative z-10 flex min-w-0 max-w-[min(100%,10.5rem)] shrink-0 items-center sm:max-w-[12rem] lg:max-w-none ${location.pathname === homePath ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
          >
            <img
              src="/logo.svg?v=yumc-1svg-7"
              alt={t('nav.logoAlt')}
              className="h-10 w-auto max-h-[3rem] max-w-full object-contain object-left sm:h-14 sm:max-h-[4.75rem] sm:max-w-[13rem] lg:h-[5rem] lg:max-h-none lg:max-w-[15rem]"
            />
          </LocalizedLink>

          <div className="hidden h-full min-h-0 flex-1 items-stretch gap-3 xl:flex">
            <LocalizedLink
              toRoute="home"
              className={`h-full ${quietNavClass(location.pathname === homePath)} ${activeBarClass(location.pathname === homePath)}`}
              aria-current={location.pathname === homePath ? 'page' : undefined}
            >
              <NavItemLabel icon="home">{t('nav.home')}</NavItemLabel>
            </LocalizedLink>
            <div className={`group relative flex h-[4.5rem] shrink-0 items-center ${activeBarClass(isProductsRoute)}`}>
              <LocalizedLink
                toRoute={storeMainRoute}
                className={quietNavClass(isProductsRoute)}
                aria-current={isProductsRoute ? 'page' : undefined}
              >
                <NavItemLabel icon="products" chevron>
                  {t('nav.products')}
                </NavItemLabel>
              </LocalizedLink>
              <div className="pointer-events-none absolute left-0 top-full z-20 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                <div className="flex items-center gap-2 rounded-none border border-earth-200 bg-white p-2 shadow-lg">
                  {storeSubmenuItems.map((item) => (
                    <LocalizedLink
                      key={item.id}
                      toRoute={item.toRoute}
                      search={item.search}
                      className={`rounded-none px-3 py-2 text-sm whitespace-nowrap transition ${
                        currentStoreSection === item.id
                          ? 'bg-earth-900 font-medium text-earth-50'
                          : 'text-earth-700 hover:bg-earth-100'
                      }`}
                    >
                      {item.label}
                    </LocalizedLink>
                  ))}
                </div>
              </div>
            </div>
            {openingsEnabled ? (
              <div className={`flex h-[4.5rem] shrink-0 items-center ${activeBarClass(isCollectorRipsRoute, 'collector')}`}>
                <LocalizedLink
                  toRoute="collectorBatches"
                  className={featuredBoxClass(isCollectorRipsRoute)}
                  aria-current={isCollectorRipsRoute ? 'page' : undefined}
                >
                  <NavItemLabel icon="boxBreak" badgeClass={featuredBoxBadge(isCollectorRipsRoute)}>
                    {t('nav.batches')}
                  </NavItemLabel>
                </LocalizedLink>
              </div>
            ) : null}
            <div className={`group flex h-[4.5rem] shrink-0 items-center ${activeBarClass(isForwardingRoute)}`}>
              <LocalizedLink
                toRoute="forwardingHome"
                className={featuredServicesClass(isForwardingRoute)}
                aria-current={isForwardingRoute ? 'page' : undefined}
              >
                <NavItemLabel icon="services" chevron badgeClass={featuredServicesBadge(isForwardingRoute)}>
                  {t('nav.japanServices')}
                </NavItemLabel>
              </LocalizedLink>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                <div className="flex items-center gap-2 rounded-none border border-earth-200 bg-white p-2 shadow-lg">
                  {japanServicesSubmenuItems.map((item) => (
                    <LocalizedLink
                      key={item.id}
                      toRoute={item.toRoute}
                      className={`rounded-none px-3 py-2 text-sm whitespace-nowrap transition ${
                        currentJapanServicesSection === item.id
                          ? 'bg-earth-900 font-medium text-earth-50'
                          : 'text-earth-700 hover:bg-earth-100'
                      }`}
                    >
                      {item.label}
                    </LocalizedLink>
                  ))}
                </div>
              </div>
            </div>
            <LocalizedLink
              toRoute="contact"
              className={`h-full ${quietNavClass(isContactRoute)} ${activeBarClass(isContactRoute)}`}
              aria-current={isContactRoute ? 'page' : undefined}
            >
              <NavItemLabel icon="contact">{t('nav.contact')}</NavItemLabel>
            </LocalizedLink>

            <div
              className={
                FULL_BLEED_HEADER
                  ? 'ml-auto flex h-full min-h-0 items-stretch gap-3'
                  : 'contents'
              }
            >
            <HeaderCredits className="self-center" />
            <button
              type="button"
              onClick={handleOpenSearch}
              className="flex h-full items-center text-earth-600 transition hover:text-earth-900"
              aria-label={t('nav.searchAria', { defaultValue: searchButtonLabel })}
              title={t('nav.searchTitle', { defaultValue: searchButtonTitle })}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            <LanguageSwitcherDropdown />

            {isAuthenticated ? (
              <div
                className="group relative flex items-center self-center"
                onMouseLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget)) return
                  const active = document.activeElement
                  if (active && e.currentTarget.contains(active)) {
                    active.blur()
                  }
                }}
              >
                <LocalizedLink
                  toRoute="minhaYuume"
                  className="relative flex items-center gap-2 rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-700"
                >
                  {hasUnreadNotifications && (
                    <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                  )}
                  <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
                  {profile?.name || user?.email?.split('@')[0] || t('nav.myAccount')}
                </LocalizedLink>
                <div className="pointer-events-none absolute right-0 top-full z-20 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <div className="min-w-[12.5rem] overflow-hidden rounded-lg border border-earth-200 bg-white py-1 shadow-lg">
                    <LocalizedLink
                      toRoute="collectorCollection"
                      className={`block px-3 py-2 text-sm ${
                        isCollectionRoute
                          ? 'bg-earth-100 font-medium text-earth-900'
                          : 'text-earth-700 hover:bg-earth-50'
                      }`}
                    >
                      {t('nav.collection')}
                    </LocalizedLink>
                    <LocalizedLink
                      toRoute="minhaYuumeBoxBreak"
                      className={`block px-3 py-2 text-sm ${
                        isRouteActive('minhaYuumeBoxBreak', location.pathname, true)
                          ? 'bg-earth-100 font-medium text-earth-900'
                          : 'text-earth-700 hover:bg-earth-50'
                      }`}
                    >
                      {t('nav.batches')}
                    </LocalizedLink>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-earth-700 hover:bg-earth-50"
                    >
                      {t('nav.signOut')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <LocalizedLink
                toRoute="login"
                className="self-center shrink-0 whitespace-nowrap rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800 xl:px-4"
              >
                {t('nav.loginRegister')}
              </LocalizedLink>
            )}

            <div className="hidden h-full items-center gap-3 self-stretch border-l border-earth-200 pl-4 xl:flex">
              {REDES_SOCIAIS.map((rede) => (
                <a
                  key={rede.nome}
                  href={rede.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-earth-500 transition hover:text-earth-600"
                  aria-label={rede.nome}
                >
                  {rede.icon}
                </a>
              ))}
            </div>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-[8] flex -translate-x-1/2 items-center xl:hidden">
            {isAuthenticated ? (
              <LocalizedLink
                toRoute="minhaYuume"
                className="pointer-events-auto relative inline-flex min-w-0 max-w-[min(100%,11rem)] items-center justify-center gap-1.5 rounded-lg bg-earth-800 px-2.5 py-1.5 text-xs font-medium text-earth-50 transition hover:bg-earth-700 sm:max-w-[10rem] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
              >
                {hasUnreadNotifications && (
                  <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                )}
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" aria-hidden />
                <span className="min-w-0 truncate">
                  {profile?.name || user?.email?.split('@')[0] || t('nav.accountShort')}
                </span>
              </LocalizedLink>
            ) : (
              <LocalizedLink
                toRoute="login"
                className="pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-lg bg-earth-900 px-2.5 py-1.5 text-xs font-medium text-earth-50 transition hover:bg-earth-800 sm:px-3 sm:py-2 sm:text-sm"
              >
                {t('nav.loginRegister')}
              </LocalizedLink>
            )}
          </div>

          <div className="relative z-10 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2 xl:ml-0 xl:hidden">
            <HeaderCredits compact />
            <button
              type="button"
              onClick={handleOpenSearch}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-earth-100 text-earth-700 transition hover:bg-earth-200 hover:text-earth-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-earth-400 sm:h-10 sm:w-10"
              aria-label={t('nav.searchAria', { defaultValue: searchButtonLabel })}
              title={t('nav.searchTitle', { defaultValue: searchButtonTitle })}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <LocalizedLink
                    toRoute="appAdmin"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 transition hover:bg-amber-200 hover:text-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-10 sm:w-10"
                    aria-label={t('nav.adminPanel')}
                    title={t('nav.adminPanel')}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7.5 3v5.25c0 4.244-2.66 7.912-6.405 9.402a3.09 3.09 0 01-2.19 0C7.16 19.162 4.5 15.494 4.5 11.25V6L12 3z" />
                    </svg>
                  </LocalizedLink>
                )}
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-earth-100 text-earth-700 transition hover:bg-earth-200 hover:text-earth-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-earth-400 sm:h-10 sm:w-10"
                  aria-label={t('nav.signOut')}
                  title={t('nav.signOut')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5H8.25A2.25 2.25 0 006 6.75v10.5A2.25 2.25 0 008.25 19.5h5.25M12 12h9m0 0l-3-3m3 3l-3 3" />
                  </svg>
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuAberto(!menuAberto)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-earth-600 hover:bg-earth-100 hover:text-earth-900 sm:h-10 sm:w-10"
              aria-expanded={menuAberto}
              aria-label={menuAberto ? t('nav.closeMenu') : t('nav.openMenu')}
            >
              {menuAberto ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuAberto && (
          <div className="border-t border-earth-200 py-4 xl:hidden">
            <div className="flex flex-col gap-1">
              <div className="px-4 pb-2">
                <HeaderCredits className="w-full justify-center" onNavigate={fecharMenu} />
              </div>
              <LocalizedLink
                toRoute="home"
                onClick={fecharMenu}
                className={mobileQuietClass(location.pathname === homePath)}
                aria-current={location.pathname === homePath ? 'page' : undefined}
              >
                <NavItemLabel icon="home">{t('nav.home')}</NavItemLabel>
              </LocalizedLink>
              <LocalizedLink
                toRoute={storeMainRoute}
                onClick={fecharMenu}
                className={mobileQuietClass(isProductsRoute)}
                aria-current={isProductsRoute ? 'page' : undefined}
              >
                <NavItemLabel icon="products">{t('nav.products')}</NavItemLabel>
              </LocalizedLink>
              {storeSubmenuItems.map((item) => (
                <LocalizedLink
                  key={item.id}
                  toRoute={item.toRoute}
                  search={item.search}
                  onClick={fecharMenu}
                  className={`rounded-lg px-4 py-2 pl-8 text-sm ${
                    currentStoreSection === item.id
                      ? 'bg-earth-100 font-semibold text-earth-900'
                      : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'
                  }`}
                >
                  {item.label}
                </LocalizedLink>
              ))}
              {openingsEnabled ? (
                <LocalizedLink
                  toRoute="collectorBatches"
                  onClick={fecharMenu}
                  className={mobileFeaturedBoxClass(isCollectorRipsRoute)}
                  aria-current={isCollectorRipsRoute ? 'page' : undefined}
                >
                  <NavItemLabel icon="boxBreak" badgeClass={featuredBoxBadge(isCollectorRipsRoute)}>
                    {t('nav.batches')}
                  </NavItemLabel>
                </LocalizedLink>
              ) : null}
              <LocalizedLink
                toRoute="forwardingHome"
                onClick={fecharMenu}
                className={mobileFeaturedServicesClass(isForwardingRoute)}
                aria-current={isForwardingRoute ? 'page' : undefined}
              >
                <NavItemLabel icon="services" badgeClass={featuredServicesBadge(isForwardingRoute)}>
                  {t('nav.japanServices')}
                </NavItemLabel>
              </LocalizedLink>
              {japanServicesSubmenuItems.map((item) => (
                <LocalizedLink
                  key={item.id}
                  toRoute={item.toRoute}
                  onClick={fecharMenu}
                  className={`rounded-lg px-4 py-2 pl-8 text-sm ${
                    currentJapanServicesSection === item.id
                      ? 'bg-earth-100 font-semibold text-earth-900'
                      : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'
                  }`}
                >
                  {item.label}
                </LocalizedLink>
              ))}
              <LocalizedLink
                toRoute="contact"
                onClick={fecharMenu}
                className={mobileQuietClass(isContactRoute)}
                aria-current={isContactRoute ? 'page' : undefined}
              >
                <NavItemLabel icon="contact">{t('nav.contact')}</NavItemLabel>
              </LocalizedLink>
              {isAuthenticated ? (
                <>
                  <LocalizedLink
                    toRoute="collectorCollection"
                    onClick={fecharMenu}
                    className={`${mobileQuietClass(isCollectionRoute)} mt-2 border-t border-earth-200`}
                    aria-current={isCollectionRoute ? 'page' : undefined}
                  >
                    <NavItemLabel icon="collection">{t('nav.collection')}</NavItemLabel>
                  </LocalizedLink>
                  <LocalizedLink
                    toRoute="minhaYuumeBoxBreak"
                    onClick={fecharMenu}
                    className={mobileQuietClass(isRouteActive('minhaYuumeBoxBreak', location.pathname, true))}
                    aria-current={isRouteActive('minhaYuumeBoxBreak', location.pathname, true) ? 'page' : undefined}
                  >
                    <NavItemLabel icon="boxBreak">{t('platform.boxBreak.title', { defaultValue: 'Meus Box Breaks' })}</NavItemLabel>
                  </LocalizedLink>
                </>
              ) : null}
              <div className="px-4 py-2">
                <LanguageSwitcherInline onNavigate={fecharMenu} />
              </div>
              <div className="mt-4 flex justify-center gap-4 border-t border-earth-200 pt-4">
                {REDES_SOCIAIS.map((rede) => (
                  <a
                    key={rede.nome}
                    href={rede.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fecharMenu}
                    className="p-2 text-earth-500 transition hover:text-earth-600"
                    aria-label={rede.nome}
                  >
                    {rede.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </nav>
      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
        staticIndex={staticSearchIndex}
        locale={locale}
      />
    </>
  )
}

export default Navbar

