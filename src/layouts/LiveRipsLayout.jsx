import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../components/LocalizedLink'
import { LanguageSwitcherDropdown } from '../components/LanguageSwitcher'
import { isRouteActive } from '../lib/localeRoutes'

function LiveRipsLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  const navItemClass = (isActive) =>
    `rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition sm:text-sm ${
      isActive
        ? 'border-earth-900 bg-earth-900 text-earth-50 shadow-sm'
        : 'border-earth-300 bg-white text-earth-700 hover:border-earth-400 hover:bg-earth-100 hover:text-earth-900'
    }`

  return (
    <div className="min-h-screen bg-earth-50 text-earth-900">
      <header className="sticky top-0 z-40 border-b border-earth-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg?v=yumc-1svg-7"
                alt={t('nav.logoAlt')}
                className="h-8 w-auto object-contain sm:h-10"
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-earth-500">
                  {t('liveRips.shell.companyLine')}
                </p>
                <h1 className="truncate text-lg font-bold tracking-tight text-earth-900 sm:text-[22px]">
                  {t('liveRips.shell.brand')}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <LocalizedLink
              toRoute="servicosPrecos"
              className="inline-flex items-center rounded-full border border-earth-200 bg-white px-3 py-1.5 text-xs font-medium text-earth-700 transition hover:border-earth-300 hover:bg-earth-100 hover:text-earth-900 sm:text-sm"
            >
              {t('liveRips.shell.backToServices')}
            </LocalizedLink>
            <LanguageSwitcherDropdown />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 border-t border-earth-100 px-4 py-2 sm:px-6">
          <p className="rounded-full bg-earth-100 px-3 py-1 text-[11px] font-medium text-earth-700">
            {t('liveRips.shell.infoSupport')}
          </p>
          <p className="rounded-full bg-earth-100 px-3 py-1 text-[11px] font-medium text-earth-700">
            {t('liveRips.shell.infoSource')}
          </p>
        </div>

        <div className="mx-auto w-full max-w-6xl border-t border-earth-100 px-4 py-3 sm:px-6">
          <nav className="flex flex-wrap gap-2" aria-label={t('liveRips.shell.navAria')}>
            <LocalizedLink
              toRoute="liveRipsHub"
              className={navItemClass(isRouteActive('liveRipsHub', location.pathname, true))}
            >
              {t('liveRips.shell.navCatalog')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="liveRipsMine"
              className={navItemClass(isRouteActive('liveRipsMine', location.pathname, true))}
            >
              {t('liveRips.shell.navMyRip')}
            </LocalizedLink>
            <LocalizedLink
              toRoute="liveRipsLive"
              className={navItemClass(isRouteActive('liveRipsLive', location.pathname, true))}
            >
              {t('liveRips.shell.navLive')}
            </LocalizedLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default LiveRipsLayout
