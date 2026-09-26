import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { isCollectorMockMode } from '../../services/collectorService'
import CatalogSearchPublic from '../CatalogSearchPublic'

function JapanSearchPage() {
  const { t } = useTranslation()
  const isMockMode = isCollectorMockMode()
  return (
    <>
      <PageSeo
        routeKey="collectorJapanSearch"
        title={t('collector.meta.japanSearchTitle', { defaultValue: 'Japan Search | Collector MVP' })}
        description={t('collector.meta.japanSearchDescription', { defaultValue: 'Busca de produtos japoneses dentro da plataforma.' })}
        noindex={isMockMode}
      />
      <section className="px-4 pb-8 pt-24">
        <div className="mx-auto max-w-6xl rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
          <DemoBadge />
          <h1 className="mt-3 font-display text-3xl font-semibold text-earth-900">
            {t('collector.japanSearch.title', { defaultValue: 'Japan Search' })}
          </h1>
          <p className="mt-2 text-earth-600">
            {t('collector.japanSearch.description', {
              defaultValue: 'Use a busca integrada para explorar produtos em marketplaces japoneses.',
            })}
          </p>
        </div>
      </section>
      <section className="px-4 pb-12">
        <CatalogSearchPublic />
      </section>
    </>
  )
}

export default JapanSearchPage
