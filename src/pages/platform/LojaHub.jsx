import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import LojaEmEstoque from './Loja'
import GrupoDeCompras from './GrupoDeCompras'
import Services from './Services'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

const STORE_SECTIONS = ['em-estoque', 'compras-programadas', 'vitrine', 'servicos']

function normalizeSection(value) {
  if (STORE_SECTIONS.includes(value)) return value
  return 'em-estoque'
}

export default function LojaHub({ publicMode = false }) {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentSection = normalizeSection(searchParams.get('sec') || '')

  const tabs = useMemo(
    () => [
      { id: 'em-estoque', label: t('platform.storeHub.tabStock') },
      { id: 'compras-programadas', label: t('platform.storeHub.tabScheduled') },
      { id: 'vitrine', label: t('platform.storeHub.tabShowcase') },
      { id: 'servicos', label: t('platform.storeHub.tabServices') },
    ],
    [t]
  )

  const selectSection = (nextSection) => {
    const next = normalizeSection(nextSection)
    const params = new URLSearchParams(searchParams)
    if (next === 'em-estoque') params.delete('sec')
    else params.set('sec', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <>
      {!publicMode && (
        <PageSeo
          routeKey="appLoja"
          title={t('meta.appStore.title')}
          description={t('meta.appStore.description')}
          noindex
        />
      )}
      <div className={`mx-auto w-full max-w-6xl ${publicMode ? 'px-4 pb-12 pt-24 lg:pt-32' : 'pb-4'}`}>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.storeHub.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.storeHub.intro')}</p>

        <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-earth-200 bg-earth-50 p-2 lg:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectSection(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                currentSection === tab.id
                  ? 'bg-earth-900 text-earth-50'
                  : 'bg-white text-earth-700 hover:bg-earth-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {currentSection === 'em-estoque' && <LojaEmEstoque embedded />}
          {currentSection === 'compras-programadas' && <GrupoDeCompras embedded />}
          {currentSection === 'vitrine' && <GrupoDeCompras embedded variant="showcase" />}
          {currentSection === 'servicos' && (
            publicMode ? (
              <div className="rounded-xl border border-earth-200 bg-white p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-earth-900">{t('platform.services.pageTitle')}</h2>
                <p className="mt-2 text-earth-600">{t('platform.services.intro')}</p>
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <Link to={lp('login')} className="font-semibold underline hover:no-underline">
                    {t('platform.groupBuy.loginLink')}
                  </Link>
                  {t('platform.groupBuy.loginSuffix')}
                </div>
              </div>
            ) : (
              <Services embedded />
            )
          )}
        </div>
      </div>
    </>
  )
}
