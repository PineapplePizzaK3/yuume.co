import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { RipCard } from '../../components/collector/RipCard'
import { OPENING_CATALOG_CATEGORIES } from '../../data/collectorLiveRipCatalog'
import { isCollectorMockMode, listOpeningBatches } from '../../services/collectorService'
import { collectorBatchDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function RipsPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
  const [game, setGame] = useState('')
  const [batches, setBatches] = useState([])

  useEffect(() => {
    let active = true
    void listOpeningBatches({ game }).then((res) => {
      if (!active) return
      setBatches(Array.isArray(res?.data) ? res.data : [])
    })
    return () => {
      active = false
    }
  }, [game])

  const categoryLabelById = useMemo(
    () =>
      new Map(
        OPENING_CATALOG_CATEGORIES.map((row) => [row.id, row.label[localeKey] || row.id])
      ),
    [localeKey]
  )

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.meta.batchesTitle', { defaultValue: 'Aberturas | Collector MVP' })}
        description={t('collector.meta.batchesDescription', { defaultValue: 'Descubra aberturas disponiveis e reserve suas posicoes.' })}
        noindex={isMockMode}
      />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-earth-900">
              {t('collector.batches.title', { defaultValue: 'Aberturas' })}
            </h1>
            <p className="mt-2 text-earth-600">
              {t('collector.batches.description', { defaultValue: 'Escolha o jogo, reserve posicoes e acompanhe a abertura gravada.' })}
            </p>
          </div>
          <select
            value={game}
            onChange={(event) => setGame(event.target.value)}
            className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
          >
            <option value="">{t('collector.filters.allGames', { defaultValue: 'Todos os jogos' })}</option>
            {OPENING_CATALOG_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {categoryLabelById.get(item.id)}
              </option>
            ))}
          </select>
        </div>
      </section>
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {batches.map((rip) => (
              <RipCard
                key={rip.id}
                rip={rip}
                product={rip.product}
                ctaTo={collectorBatchDetailPath(rip.id, locale)}
                ctaLabel={t('collector.actions.openBatch', { defaultValue: 'Ver abertura' })}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default RipsPage
