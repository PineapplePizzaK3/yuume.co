import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import GrupoDeCompras from './GrupoDeCompras'

function resolveMode(pathname = '') {
  const p = String(pathname || '').toLowerCase()
  if (p.endsWith('/online')) return 'online'
  if (p.endsWith('/fisica') || p.endsWith('/physical')) return 'fisica'
  return 'online'
}

export default function ComprasProgramadas({ publicMode = false }) {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const location = useLocation()
  const mode = resolveMode(location.pathname)

  const tabs = useMemo(
    () => [
      {
        id: 'online',
        label: t('platform.groupBuy.tabOnline'),
        to: publicMode ? lp('lojaPublicProgramadasOnline') : lp('appGrupoComprasOnline'),
      },
      {
        id: 'fisica',
        label: t('platform.groupBuy.tabPhysical'),
        to: publicMode ? lp('lojaPublicProgramadasFisica') : lp('appGrupoComprasFisica'),
      },
    ],
    [lp, publicMode, t]
  )

  return (
    <>
      {!publicMode && (
        <PageSeo
          routeKey="appGrupoCompras"
          title={t('meta.appGroupBuy.title')}
          description={t('meta.appGroupBuy.description')}
          noindex
        />
      )}
      <div className={publicMode ? 'px-4 pt-24 pb-12' : ''}>
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-bold text-earth-900">{t('platform.groupBuy.pageTitle')}</h1>
          <p className="mt-2 text-earth-600">{t('platform.groupBuy.intro')}</p>

          <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-earth-200 bg-earth-50 p-2">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.to}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === tab.id
                    ? 'bg-earth-900 text-earth-50'
                    : 'bg-white text-earth-700 hover:bg-earth-100'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            {mode === 'online' ? (
              <GrupoDeCompras embedded hideHeader destination="online" />
            ) : (
              <GrupoDeCompras embedded hideHeader destination="physical" />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
