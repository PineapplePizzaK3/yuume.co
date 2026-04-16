import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isRouteActive } from '../lib/localeRoutes'
import { LocalizedLink } from './LocalizedLink'
import { LanguageSwitcherFooterRow } from './LanguageSwitcher'

function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const location = useLocation()

  const linkClasse = (routeKey, prefix = false) =>
    `text-sm transition hover:text-earth-900 py-1 ${
      isRouteActive(routeKey, location.pathname, prefix) ? 'font-semibold text-earth-900' : 'text-earth-600'
    }`

  return (
    <footer className="border-t border-earth-200 bg-earth-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <p className="text-sm text-earth-600 w-full sm:w-auto sm:order-first">
            © {currentYear} YuumeCo. {t('footer.rights')}
          </p>
          <LanguageSwitcherFooterRow />
          <nav className="flex flex-col gap-2" aria-label={t('footer.menu')}>
            <span className="text-xs font-semibold uppercase tracking-wide text-earth-500">
              {t('footer.menu')}
            </span>
            <div className="flex flex-col gap-1">
              <LocalizedLink toRoute="home" className={linkClasse('home')}>
                {t('nav.home')}
              </LocalizedLink>
              <LocalizedLink toRoute="servicosPrecos" className={linkClasse('servicosPrecos', true)}>
                {t('nav.services')}
              </LocalizedLink>
              <LocalizedLink toRoute="faqIndex" className={linkClasse('faqIndex', true)}>
                {t('nav.faq')}
              </LocalizedLink>
              <LocalizedLink toRoute="ondeComprar" className={linkClasse('ondeComprar')}>
                {t('nav.whereToBuy')}
              </LocalizedLink>
              <LocalizedLink toRoute="contact" className={linkClasse('contact')}>
                {t('nav.contact')}
              </LocalizedLink>
            </div>
          </nav>
          <nav className="flex flex-col gap-2" aria-label={t('footer.legal')}>
            <span className="text-xs font-semibold uppercase tracking-wide text-earth-500">
              {t('footer.legal')}
            </span>
            <div className="flex flex-col gap-1">
              <LocalizedLink toRoute="legalPrivacy" className={linkClasse('legalPrivacy')}>
                {t('footer.privacy')}
              </LocalizedLink>
              <LocalizedLink toRoute="legalTerms" className={linkClasse('legalTerms')}>
                {t('footer.terms')}
              </LocalizedLink>
              <LocalizedLink toRoute="legalCommercial" className={linkClasse('legalCommercial')}>
                {t('footer.commercial')}
              </LocalizedLink>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default Footer
