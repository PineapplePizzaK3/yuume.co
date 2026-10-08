import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { LocalizedLink } from '../../components/LocalizedLink'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { CollectorHomeDashboard } from '../../components/collector/CollectorHomeDashboard'
import { LiveCard } from '../../components/collector/LiveCard'
import { BoxBreakCategoryLanes } from '../../components/collector/BoxBreakCategoryLanes'
import { BoxBreakHowItWorksCarousel } from '../../components/collector/BoxBreakHowItWorksCarousel'
import { BoxBreakSellBackHighlight } from '../../components/collector/BoxBreakSellBackHighlight'
import { isCollectorMockMode, listOpeningBatches, listOpeningSessions } from '../../services/collectorService'
import { collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import {
  HomeIconBadge,
  IconCards,
  IconHeart,
  IconJapan,
  IconPlay,
  IconTag,
} from '../../components/home/HomeSectionIcons'

const OPENINGS_HERO_IMAGE = `${import.meta.env.BASE_URL}collector/openings-hero.png`

function CollectorHome() {
  return <CollectorHomeDashboard />
}

/** Aberturas hub: the previous collector home, always. */
export function OpeningsHub() {
  return <CollectorHomeLegacy />
}

function CollectorHomeLegacy() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
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

  const featuredOpenings = useMemo(() => openings.slice(0, 2), [openings])

  const highlightOpening = useMemo(() => {
    const priority = ['RECORDING', 'SCHEDULED', 'PUBLISHED']
    for (const status of priority) {
      const match = openings.find((row) => row.status === status)
      if (match) return match
    }
    return openings[0] || null
  }, [openings])

  const openBatchCount = useMemo(
    () => batches.filter((batch) => batch.status === 'OPEN' || Number(batch.availablePositions || 0) > 0).length,
    [batches]
  )

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.meta.homeTitle', { defaultValue: 'Box Break | YuumeCo' })}
        description={t('collector.meta.homeDescription', {
          defaultValue: 'Reserve participações em Box Breaks e acompanhe o resultado.',
        })}
        noindex={isMockMode}
      />

      <section className="px-4 pb-8 pt-24 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                {isMockMode ? <DemoBadge /> : null}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-earth-500">
                  {t('collector.hero.eyebrow', { defaultValue: 'Box Break' })}
                </p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
                  {t('collector.hero.title', { defaultValue: 'Plataforma para colecionadores de TCG' })}
                </h1>
                <p className="mt-4 max-w-2xl text-earth-600">
                  {t('collector.hero.description', {
                    defaultValue:
                      'Descubra produtos, reserve participações em Box Breaks e acompanhe os resultados na sua coleção.',
                  })}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#openings-step-catalog"
                    className="inline-flex items-center justify-center rounded-lg bg-earth-900 px-5 py-3 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
                  >
                    {t('collector.hubSteps.nextOpening.productsButton', { defaultValue: 'Ver caixas disponíveis' })}
                  </a>
                  <LocalizedLink
                    toRoute="collectorBatchCatalog"
                    className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                  >
                    {t('collector.actions.exploreBatches', { defaultValue: 'Explorar Box Breaks' })}
                  </LocalizedLink>
                </div>
              </div>

              <div className="flex items-center justify-center px-2 py-4 sm:py-6">
                <img
                  src={OPENINGS_HERO_IMAGE}
                  alt={t('collector.hero.iconTitle', { defaultValue: 'Caixa e packs TCG' })}
                  className="h-full min-h-[220px] w-full max-w-md animate-voar object-contain object-center sm:min-h-[280px]"
                />
              </div>
            </div>
            <BoxBreakSellBackHighlight className="mt-6" />
          </div>
        </div>
      </section>

      <BoxBreakHowItWorksCarousel />

      <section id="openings-step-catalog" className="border-t border-earth-200 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-earth-900">
                {t('collector.home.availableBatches', { defaultValue: 'Box Breaks disponíveis' })}
              </h2>
              <p className="mt-2 text-earth-600">
                {t('collector.hubSteps.catalog.description', {
                  defaultValue: 'Compare caixas, valores em créditos e reserve sua participação.',
                })}
              </p>
            </div>
            <LocalizedLink
              toRoute="collectorBatchCatalog"
              className="text-sm font-medium text-earth-700 hover:underline"
            >
              {t('collector.actions.viewAllBatches', { defaultValue: 'Ver todas as caixas' })}
            </LocalizedLink>
          </div>

          <BoxBreakCategoryLanes batches={batches} />
        </div>
      </section>

      <section id="openings-step-concept" className="border-t border-earth-200 bg-earth-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-earth-900">
            {t('collector.hubSteps.concept.title', { defaultValue: 'O que é Box Break' })}
          </h2>
          <p className="mt-2 max-w-2xl text-earth-600">
            {t('collector.hubSteps.concept.description', {
              defaultValue: 'Reserve packs em caixas reais, pague com créditos e acompanhe o Box Break registrado.',
            })}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconJapan />
              </HomeIconBadge>
              <h3 className="font-bold text-earth-900">
                {t('collector.hubSteps.concept.card1Title', { defaultValue: 'Caixas reais no Japão' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.concept.card1Body', {
                  defaultValue: 'Cada Box Break corresponde a uma caixa física com participações limitadas.',
                })}
              </p>
            </article>
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconTag />
              </HomeIconBadge>
              <h3 className="font-bold text-earth-900">
                {t('collector.hubSteps.concept.card2Title', { defaultValue: 'Pagamento em créditos' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.concept.card2Body', {
                  defaultValue: '1 crédito = ¥1. Adicione saldo na carteira e reserve packs na hora.',
                })}
              </p>
            </article>
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconCards />
              </HomeIconBadge>
              <h3 className="font-bold text-earth-900">
                {t('collector.hubSteps.concept.card3Title', { defaultValue: 'Resultado na sua coleção' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.concept.card3Body', {
                  defaultValue: 'Acompanhe a sessão gravada e as cartas geradas após o Box Break.',
                })}
              </p>
            </article>
          </div>

          <h2 className="mt-10 text-2xl font-bold text-earth-900">
            {t('collector.hubSteps.trust.title', { defaultValue: 'Transparência que você consegue verificar' })}
          </h2>
          <p className="mt-2 text-earth-600">
            {t('collector.hubSteps.trust.description', {
              defaultValue: 'A experiência combina a emoção do Box Break com critérios claros de confiança.',
            })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconTag />
              </HomeIconBadge>
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card1Eyebrow', { defaultValue: 'Moeda' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card1Title', { defaultValue: 'Créditos oficiais' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card1Body', {
                  defaultValue: 'Todos os valores de Box Break são cobrados em créditos (1 crédito = ¥1).',
                })}
              </p>
            </article>
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconPlay />
              </HomeIconBadge>
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card2Eyebrow', { defaultValue: 'Registro' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card2Title', { defaultValue: 'Sessão gravada' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card2Body', {
                  defaultValue: 'Acompanhe o Box Break e o resultado com histórico na plataforma.',
                })}
              </p>
            </article>
            <article className="group rounded-xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md">
              <HomeIconBadge>
                <IconHeart />
              </HomeIconBadge>
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card3Eyebrow', { defaultValue: 'Coleção' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card3Title', { defaultValue: 'Cartas rastreadas' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card3Body', {
                  defaultValue: 'Os resultados ficam vinculados à sua conta para consulta e próximos passos.',
                })}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-earth-200 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-earth-900">
              {t('collector.hubSteps.nextOpening.title', { defaultValue: 'Próximo Box Break' })}
            </h2>
            <LocalizedLink toRoute="collectorOpenings" className="text-sm font-medium text-earth-700 hover:underline">
              {t('collector.actions.viewAll', { defaultValue: 'Ver tudo' })}
            </LocalizedLink>
          </div>
          <div className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
            {highlightOpening ? (
              <>
                <h3 className="text-xl font-semibold text-earth-900">
                  {highlightOpening.title?.[localeKey]
                    || highlightOpening.title
                    || highlightOpening.batch?.batchCode
                    || highlightOpening.id}
                </h3>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">
                      {t('collector.hubSteps.nextOpening.status', { defaultValue: 'Status' })}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">
                      {highlightOpening.status === 'PUBLISHED'
                        ? t('collector.opening.statusPublished', { defaultValue: 'Publicado' })
                        : highlightOpening.status === 'RECORDING'
                          ? t('collector.opening.statusRecording', { defaultValue: 'Gravando' })
                          : t('collector.opening.statusScheduled', { defaultValue: 'Agendada' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">
                      {t('collector.hubSteps.nextOpening.available', { defaultValue: 'Caixas abertas' })}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">
                      {t('collector.hubSteps.nextOpening.availableCount', {
                        defaultValue: '{{count}} disponíveis',
                        count: openBatchCount,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">
                      {t('collector.hubSteps.nextOpening.sessions', { defaultValue: 'Sessões' })}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">{openings.length}</dd>
                  </div>
                  <div className="flex items-end">
                    <a
                      href="#openings-step-catalog"
                      className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                    >
                      {t('collector.hubSteps.nextOpening.productsButton', { defaultValue: 'Ver caixas disponíveis' })}
                    </a>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-sm text-earth-600">
                {t('collector.home.emptyOpenings', { defaultValue: 'Nenhuma sessão de Box Break agendada no momento.' })}
              </p>
            )}
          </div>
          {featuredOpenings.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {featuredOpenings.map((opening) => (
                <LiveCard key={opening.id} live={opening} to={collectorOpeningDetailPath(opening.id, locale)} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

export default CollectorHome
