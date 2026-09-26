import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { LocalizedLink } from '../../components/LocalizedLink'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { RipCard } from '../../components/collector/RipCard'
import { LiveCard } from '../../components/collector/LiveCard'
import { listOpeningBatches, listOpeningSessions } from '../../services/collectorService'
import { collectorBatchDetailPath, collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function CollectorHome() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const [batches, setBatches] = useState([])
  const [openings, setOpenings] = useState([])

  useEffect(() => {
    let active = true
    void Promise.all([listOpeningBatches(), listOpeningSessions()]).then(([batchRes, openingRes]) => {
      if (!active) return
      setBatches(Array.isArray(batchRes?.data) ? batchRes.data : [])
      setOpenings(Array.isArray(openingRes?.data) ? openingRes.data : [])
    })
    return () => {
      active = false
    }
  }, [])

  const featuredBatches = useMemo(() => batches.slice(0, 4), [batches])
  const featuredOpenings = useMemo(() => openings.slice(0, 2), [openings])

  return (
    <>
      <PageSeo
        routeKey="home"
        title={t('collector.meta.homeTitle', { defaultValue: 'Collector MVP | YuumeCo' })}
        description={t('collector.meta.homeDescription', {
          defaultValue: 'Reserve posicoes em aberturas e acompanhe seus pulls registrados.',
        })}
        noindex
      />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto max-w-6xl rounded-2xl border border-earth-200 bg-white p-6 shadow-sm sm:p-8">
          <DemoBadge />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-earth-900 sm:text-5xl">
            {t('collector.hero.title', { defaultValue: 'Plataforma para colecionadores de TCG' })}
          </h1>
          <p className="mt-4 max-w-3xl text-earth-600">
            {t('collector.hero.description', {
              defaultValue:
                'Descubra produtos, reserve posicoes em aberturas e acompanhe os resultados na sua colecao.',
            })}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LocalizedLink
              toRoute="collectorBatches"
              className="rounded-lg bg-collector-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-collector-700"
            >
              {t('collector.actions.exploreBatches', { defaultValue: 'Explorar aberturas' })}
            </LocalizedLink>
            <LocalizedLink
              toRoute="collectorCollection"
              className="rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
            >
              {t('collector.actions.openCollection', { defaultValue: 'Ver minha colecao' })}
            </LocalizedLink>
            <LocalizedLink
              toRoute="forwardingHome"
              className="rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
            >
              {t('collector.actions.japanServices', { defaultValue: 'Servicos de redirecionamento JP' })}
            </LocalizedLink>
          </div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-earth-900">
              {t('collector.scope.inTitle', { defaultValue: 'MVP atual (abertura-first)' })}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-earth-700">
              <li>{t('collector.scope.in1', { defaultValue: 'Explorar produtos e aberturas' })}</li>
              <li>{t('collector.scope.in2', { defaultValue: 'Reservar posicoes em aberturas (demo mock)' })}</li>
              <li>{t('collector.scope.in3', { defaultValue: 'Ver opening session gravada e pulls relevantes' })}</li>
              <li>{t('collector.scope.in4', { defaultValue: 'Acompanhar card assets na colecao' })}</li>
            </ul>
          </article>
          <article className="rounded-xl border border-earth-200 bg-earth-50 p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-earth-900">
              {t('collector.scope.outTitle', { defaultValue: 'Fora do MVP agora' })}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-earth-700">
              <li>{t('collector.scope.out1', { defaultValue: 'Marketplace de sellers externos' })}</li>
              <li>{t('collector.scope.out2', { defaultValue: 'Grading, buyback, vault e trading entre usuarios' })}</li>
              <li>{t('collector.scope.out3', { defaultValue: 'Sistema avancado provably-fair' })}</li>
              <li>{t('collector.scope.out4', { defaultValue: 'Dependencia obrigatoria de abertura ao vivo' })}</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="border-y border-earth-200 bg-earth-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-earth-900">
              {t('collector.home.openingHighlights', { defaultValue: 'Openings registradas' })}
            </h2>
            <LocalizedLink toRoute="collectorOpenings" className="text-sm font-medium text-earth-700 hover:underline">
              {t('collector.actions.viewAll', { defaultValue: 'Ver tudo' })}
            </LocalizedLink>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {featuredOpenings.map((opening) => (
              <LiveCard key={opening.id} live={opening} to={collectorOpeningDetailPath(opening.id, locale)} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-earth-900">
              {t('collector.home.availableBatches', { defaultValue: 'Aberturas disponiveis' })}
            </h2>
            <LocalizedLink toRoute="collectorBatches" className="text-sm font-medium text-earth-700 hover:underline">
              {t('collector.actions.viewAll', { defaultValue: 'Ver tudo' })}
            </LocalizedLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredBatches.map((rip) => (
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

export default CollectorHome
