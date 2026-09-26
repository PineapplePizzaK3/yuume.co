import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { RipCard } from '../../components/collector/RipCard'
import { COLLECTOR_GAMES } from '../../data/collectorMock'
import { listOpeningBatches } from '../../services/collectorService'
import { collectorBatchDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function RipsPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
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

  const gameLabelById = useMemo(
    () =>
      new Map(
        COLLECTOR_GAMES.map((row) => [row.id, row.label[i18n.language === 'en' ? 'en' : 'pt-BR'] || row.id])
      ),
    [i18n.language]
  )

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.meta.batchesTitle', { defaultValue: 'Aberturas | Collector MVP' })}
        description={t('collector.meta.batchesDescription', { defaultValue: 'Descubra aberturas disponiveis e reserve suas posicoes.' })}
        noindex
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
            {COLLECTOR_GAMES.map((item) => (
              <option key={item.id} value={item.id}>
                {gameLabelById.get(item.id)}
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
