/**
 * LegalLayout - Reusable layout for legal pages.
 * Provides centered readable content, max-width container, clear section headings.
 * Includes language switcher (JP / PT-BR / EN) with flag buttons. JP is default.
 */
import { Outlet, Link, useLocation } from 'react-router-dom'
import { LegalLanguageProvider, useLegalLanguage } from '../contexts/LegalLanguageContext'

const LEGAL_LINKS = [
  { to: '/legal/commercial-disclosure', labelJa: '特定商取引法に基づく表記', labelPt: 'Divulgação Comercial', labelEn: 'Commercial Disclosure' },
  { to: '/legal/privacy', labelJa: 'プライバシーポリシー', labelPt: 'Política de Privacidade', labelEn: 'Privacy Policy' },
  { to: '/legal/terms', labelJa: '利用規約', labelPt: 'Termos de Uso', labelEn: 'Terms of Service' },
]

function LegalLayoutInner() {
  const location = useLocation()
  const { lang, setLang } = useLegalLanguage()

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            Legal
          </h1>
          <div className="flex gap-2" role="group" aria-label="言語 / Idioma / Language">
            <button
              type="button"
              onClick={() => setLang('ja')}
              title="日本語"
              className={`rounded-lg px-3 py-2 text-2xl transition hover:bg-earth-200 ${
                lang === 'ja' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'ja'}
            >
              🇯🇵
            </button>
            <button
              type="button"
              onClick={() => setLang('pt-BR')}
              title="Português (Brasil)"
              className={`rounded-lg px-3 py-2 text-2xl transition hover:bg-earth-200 ${
                lang === 'pt-BR' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'pt-BR'}
            >
              🇧🇷
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              title="English"
              className={`rounded-lg px-3 py-2 text-2xl transition hover:bg-earth-200 ${
                lang === 'en' ? 'ring-2 ring-earth-700 ring-offset-2' : 'opacity-70 hover:opacity-100'
              }`}
              aria-pressed={lang === 'en'}
            >
              🇺🇸
            </button>
          </div>
        </div>

        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-4 sm:gap-6">
            {LEGAL_LINKS.map(({ to, labelJa, labelPt, labelEn }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`block border-b-2 pb-3 text-sm font-medium transition ${
                    location.pathname === to
                      ? 'border-earth-900 text-earth-900'
                      : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                  }`}
                >
                  {lang === 'ja' ? labelJa : lang === 'pt-BR' ? labelPt : labelEn}
                </Link>
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
