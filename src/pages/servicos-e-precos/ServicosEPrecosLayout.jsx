import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isRouteActive } from '../../lib/localeRoutes'
import { LocalizedLink } from '../../components/LocalizedLink'

function ServicosEPrecosLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
          {t('layout.servicos.title')}
        </h1>

        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-6">
            <li>
              <LocalizedLink
                toRoute="servicosPrecos"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('servicosPrecos', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.servicos.navServicos')}
              </LocalizedLink>
            </li>
            <li>
              <LocalizedLink
                toRoute="servicosFretes"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('servicosFretes', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.servicos.navFretes')}
              </LocalizedLink>
            </li>
            <li>
              <LocalizedLink
                toRoute="servicosSimulador"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('servicosSimulador', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.servicos.navSimulador')}
              </LocalizedLink>
            </li>
          </ul>
        </nav>

        <Outlet />
      </div>
    </section>
  )
}

export default ServicosEPrecosLayout
