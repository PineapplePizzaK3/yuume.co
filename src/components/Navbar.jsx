import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { REDES_SOCIAIS } from '../data/redesSociais'
import { useAuth } from '../hooks/useAuth'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useLocalizedPath } from '../hooks/useLocalizedPath'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { isRouteActive } from '../lib/localeRoutes'
import { LocalizedLink } from './LocalizedLink'
import { LanguageSwitcherDropdown, LanguageSwitcherInline } from './LanguageSwitcher'

function Navbar() {
  const { t } = useTranslation()
  const { isAuthenticated, user, profile, isAdmin, signOut } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const path = useLocalizedPath()
  const unreadNotifications = useUnreadNotifications(user?.id, 20)
  const hasUnreadNotifications = unreadNotifications > 0

  const fecharMenu = () => setMenuAberto(false)

  const linkAtivo =
    'font-semibold text-earth-900'
  const linkNormal =
    'text-earth-600 transition hover:text-earth-900'
  const storeMainRoute = isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'

  const homePath = path('home')
  const isStorePublicRoute = isRouteActive('lojaPublic', location.pathname, true)
  const isStoreAppRoute = isRouteActive('appLoja', location.pathname, true)
  const isStoreServicesRoute = isRouteActive('appServices', location.pathname, true)
  const currentStoreSection = useMemo(() => {
    if (isStoreServicesRoute) return 'servicos'
    if (isRouteActive('appLoja', location.pathname, true) || isRouteActive('lojaPublicVitrine', location.pathname, true)) {
      return 'vitrine'
    }
    return 'vitrine'
  }, [isStoreServicesRoute, location.pathname])
  const storeSubmenuItems = useMemo(() => {
    const vitrine = {
      id: 'vitrine',
      label: t('platform.storeHub.tabShowcase'),
      toRoute: isAuthenticated ? 'appLoja' : 'lojaPublicVitrine',
    }
    const servicos = {
      id: 'servicos',
      label: t('platform.storeHub.tabServices'),
      toRoute: 'appServices',
    }
    if (isAuthenticated) {
      return [servicos, vitrine]
    }
    return [vitrine]
  }, [isAuthenticated, t])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 overflow-visible bg-earth-50 shadow-sm border-b border-earth-200">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.5rem] items-center justify-between gap-2 lg:h-[4.5rem] lg:items-stretch">
          <LocalizedLink
            toRoute="home"
            className={`relative z-10 flex min-w-0 max-w-[min(100%,9.5rem)] shrink-0 items-center sm:max-w-[11rem] lg:max-w-none ${location.pathname === homePath ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
          >
            <img
              src="/logo.svg?v=yumc-1svg-7"
              alt={t('nav.logoAlt')}
              className="h-9 w-auto max-h-[2.75rem] max-w-full object-contain object-left sm:h-12 sm:max-h-[4.5rem] sm:max-w-[12rem] lg:h-[4.5rem] lg:max-h-none lg:max-w-[13.5rem]"
            />
          </LocalizedLink>

          <div className="hidden h-full min-h-0 flex-1 items-stretch gap-6 lg:flex">
            <LocalizedLink
              toRoute="home"
              className={`flex items-center ${location.pathname === homePath ? linkAtivo : linkNormal}`}
            >
              {t('nav.home')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="servicosPrecos"
              className={`flex items-center ${isRouteActive('servicosPrecos', location.pathname, true) ? linkAtivo : linkNormal}`}
            >
              {t('nav.services')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="ondeComprar"
              className={`flex items-center ${isRouteActive('ondeComprar', location.pathname) ? linkAtivo : linkNormal}`}
            >
              {t('nav.whereToBuy')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="faqIndex"
              className={`flex items-center ${isRouteActive('faqIndex', location.pathname, true) ? linkAtivo : linkNormal}`}
            >
              {t('nav.faq')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="contact"
              className={`flex items-center ${isRouteActive('contact', location.pathname) ? linkAtivo : linkNormal}`}
            >
              {t('nav.contact')}
            </LocalizedLink>
            <div className="group relative flex h-[4.5rem] shrink-0">
              <LocalizedLink
                toRoute={storeMainRoute}
                className={`box-border flex h-full w-full items-center px-4 text-sm font-medium text-white transition hover:bg-red-400 ${
                  isStorePublicRoute || isStoreAppRoute || isStoreServicesRoute
                    ? 'bg-red-500 ring-2 ring-white'
                    : 'bg-red-300'
                }`}
              >
                {t('nav.virtualStore')}
              </LocalizedLink>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                <div className="flex items-center gap-2 rounded-none border border-earth-200 bg-white p-2 shadow-lg">
                  {storeSubmenuItems.map((item) => (
                    <LocalizedLink
                      key={item.id}
                      toRoute={item.toRoute}
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
                  toRoute="appDashboard"
                  className="relative flex items-center gap-2 rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-700"
                >
                  {hasUnreadNotifications && (
                    <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                  )}
                  <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
                  {profile?.name || user?.email?.split('@')[0] || t('nav.myAccount')}
                </LocalizedLink>
                <div className="pointer-events-none absolute right-0 top-full z-20 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="w-full whitespace-nowrap rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 shadow-sm hover:bg-earth-100"
                  >
                    {t('nav.signOut')}
                  </button>
                </div>
              </div>
            ) : (
              <LocalizedLink
                toRoute="login"
                className="self-center rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
              >
                {t('nav.loginRegister')}
              </LocalizedLink>
            )}

            <div className="flex h-full items-center gap-3 self-stretch border-l border-earth-200 pl-4">
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

          <div className="flex min-w-0 flex-shrink-0 items-center justify-end gap-1 sm:gap-2 lg:hidden">
            {isAuthenticated ? (
              <>
                <LocalizedLink
                  toRoute="appDashboard"
                  className="relative inline-flex min-w-0 max-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg bg-earth-800 px-2 py-1.5 text-xs font-medium text-earth-50 transition hover:bg-earth-700 sm:max-w-[9rem] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                >
                  {hasUnreadNotifications && (
                    <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                  )}
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" aria-hidden />
                  <span className="min-w-0 truncate">
                    {profile?.name || user?.email?.split('@')[0] || t('nav.accountShort')}
                  </span>
                </LocalizedLink>
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
            ) : (
              <LocalizedLink
                toRoute="login"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-earth-900 px-2.5 py-1.5 text-xs font-medium text-earth-50 transition hover:bg-earth-800 sm:px-3 sm:py-2 sm:text-sm"
              >
                {t('nav.loginRegister')}
              </LocalizedLink>
            )}
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
          <div className="border-t border-earth-200 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              <LocalizedLink
                toRoute="home"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${location.pathname === homePath ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                {t('nav.home')}
              </LocalizedLink>
              <LocalizedLink
                toRoute="servicosPrecos"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isRouteActive('servicosPrecos', location.pathname, true) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                {t('nav.services')}
              </LocalizedLink>
              <LocalizedLink
                toRoute="ondeComprar"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isRouteActive('ondeComprar', location.pathname) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                {t('nav.whereToBuy')}
              </LocalizedLink>
              <LocalizedLink
                toRoute="faqIndex"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isRouteActive('faqIndex', location.pathname, true) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                {t('nav.faq')}
              </LocalizedLink>
              <LocalizedLink
                toRoute="contact"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isRouteActive('contact', location.pathname) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                {t('nav.contact')}
              </LocalizedLink>
              <LocalizedLink
                toRoute={storeMainRoute}
                onClick={fecharMenu}
                className={`px-4 py-3 font-medium text-white transition hover:bg-red-400 ${
                  isStorePublicRoute || isStoreAppRoute || isStoreServicesRoute
                    ? 'bg-red-500 ring-2 ring-white'
                    : 'bg-red-300'
                }`}
              >
                {t('nav.virtualStore')}
              </LocalizedLink>
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
  )
}

export default Navbar

