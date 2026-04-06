import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isRouteActive } from '../../lib/localeRoutes'
import { LocalizedLink } from '../../components/LocalizedLink'

function FaqLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
          {t('layout.faq.title')}
        </h1>

        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-6">
            <li>
              <LocalizedLink
                toRoute="faqIndex"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('faqIndex', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.faq.navFaq')}
              </LocalizedLink>
            </li>
            <li>
              <LocalizedLink
                toRoute="faqProhibited"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('faqProhibited', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.faq.navProhibited')}
              </LocalizedLink>
            </li>
            <li>
              <LocalizedLink
                toRoute="faqCustoms"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  isRouteActive('faqCustoms', location.pathname)
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                {t('layout.faq.navCustoms')}
              </LocalizedLink>
            </li>
          </ul>
        </nav>

        <div className="max-w-3xl">
          <Outlet />
        </div>
      </div>
    </section>
  )
}

export default FaqLayout
