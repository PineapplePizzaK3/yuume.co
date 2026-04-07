/**
 * LegalLayout - Reusable layout for legal pages.
 * Includes language switcher (JP / PT-BR / EN) with flag buttons.
 * Site locale from URL (/en/legal vs /legal) sets default legal document language.
 */
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LegalLanguageProvider, useLegalLanguage } from '../contexts/LegalLanguageContext'
import { isRouteActive } from '../lib/localeRoutes'
import { LocalizedLink } from '../components/LocalizedLink'
import { FlagIcon } from '../components/FlagIcon'

const LEGAL_LINKS = [
  { routeKey: 'legalCommercial', labelJa: '特定商取引法に基づく表記', labelPt: 'Divulgação Comercial', labelEn: 'Commercial Disclosure' },
  { routeKey: 'legalPrivacy', labelJa: 'プライバシーポリシー', labelPt: 'Política de Privacidade', labelEn: 'Privacy Policy' },
  { routeKey: 'legalTerms', labelJa: '利用規約', labelPt: 'Termos de Uso e Serviços', labelEn: 'Terms of Use & Services' },
]

function LegalLayoutInner() {
  const { t } = useTranslation()
  const location = useLocation()
  const { lang, setLang } = useLegalLanguage()

  useEffect(() => {
    if (location.pathname.startsWith('/en/legal')) setLang('en')
    else if (location.pathname.startsWith('/legal')) setLang('pt-BR')
  }, [location.pathname, setLang])

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            {t('layout.legal.title')}
          </h1>
          <div className="flex gap-2" role="group" aria-label="言語 / Idioma / Language">
            <button
              type="button"
              onClick={() => setLang('ja')}
              title="日本語"
              className={`inline-flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-earth-200 ${
                lang === 'ja' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'ja'}
            >
              <span aria-hidden className="inline-flex">
                <FlagIcon code="JP" size={28} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLang('pt-BR')}
              title="Português (Brasil)"
              className={`inline-flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-earth-200 ${
                lang === 'pt-BR' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'pt-BR'}
            >
              <span aria-hidden className="inline-flex">
                <FlagIcon code="BR" size={28} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              title="English"
              className={`inline-flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-earth-200 ${
                lang === 'en' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'en'}
            >
              <span aria-hidden className="inline-flex">
                <FlagIcon code="US" size={28} />
              </span>
            </button>
          </div>
        </div>

        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-4 sm:gap-6">
            {LEGAL_LINKS.map(({ routeKey, labelJa, labelPt, labelEn }) => (
              <li key={routeKey}>
                <LocalizedLink
                  toRoute={routeKey}
                  className={`block border-b-2 pb-3 text-sm font-medium transition ${
                    isRouteActive(routeKey, location.pathname)
                      ? 'border-earth-900 text-earth-900'
                      : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                  }`}
                >
                  {lang === 'ja' ? labelJa : lang === 'pt-BR' ? labelPt : labelEn}
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </nav>

        <article className="prose legal-content space-y-8">
          <Outlet />
        </article>
      </div>
    </section>
  )
}

export default function LegalLayout() {
  return (
    <LegalLanguageProvider>
      <LegalLayoutInner />
    </LegalLanguageProvider>
  )
}
