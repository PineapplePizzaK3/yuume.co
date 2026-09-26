import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { LocalizedLink } from '../../components/LocalizedLink'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { RipCard } from '../../components/collector/RipCard'
import { LiveCard } from '../../components/collector/LiveCard'
import { CreditsInline } from '../../components/CreditsAmount'
import {
  LIVE_RIP_HOW_IT_WORKS_ICONS,
} from '../../components/live-rips/LiveRipIcons'
import { OPENING_CATALOG_CATEGORIES } from '../../data/collectorLiveRipCatalog'
import { isCollectorMockMode, listOpeningBatches, listOpeningSessions } from '../../services/collectorService'
import { collectorBatchDetailPath, collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

const HUB_STEPS = ['concept', 'howItWorks', 'catalog']
const OPENINGS_HERO_IMAGE = `${import.meta.env.BASE_URL}collector/openings-hero.png`

function CollectorHome() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
  const [batches, setBatches] = useState([])
  const [openings, setOpenings] = useState([])
  const [activeGameId, setActiveGameId] = useState('')

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

  const featuredBatches = useMemo(() => batches.slice(0, 3), [batches])
  const featuredOpenings = useMemo(() => openings.slice(0, 2), [openings])

  const filteredBatches = useMemo(() => {
    const game = String(activeGameId || '').trim().toLowerCase()
    if (!game) return batches
    return batches.filter((batch) => String(batch?.product?.game || '').toLowerCase() === game)
  }, [batches, activeGameId])

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
        routeKey="home"
        title={t('collector.meta.homeTitle', { defaultValue: 'Collector MVP | YuumeCo' })}
        description={t('collector.meta.homeDescription', {
          defaultValue: 'Reserve posicoes em aberturas e acompanhe seus pulls registrados.',
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
                  {t('collector.hero.eyebrow', { defaultValue: 'Aberturas' })}
                </p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
                  {t('collector.hero.title', { defaultValue: 'Plataforma para colecionadores de TCG' })}
                </h1>
                <p className="mt-4 max-w-2xl text-earth-600">
                  {t('collector.hero.description', {
                    defaultValue:
                      'Descubra produtos, reserve posicoes em aberturas e acompanhe os resultados na sua colecao.',
                  })}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LocalizedLink
                    toRoute="collectorBatches"
                    className="inline-flex items-center justify-center rounded-lg bg-earth-900 px-5 py-3 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
                  >
                    {t('collector.actions.exploreBatches', { defaultValue: 'Explorar aberturas' })}
                  </LocalizedLink>
                  <LocalizedLink
                    toRoute="collectorCollection"
                    className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                  >
                    {t('collector.actions.openCollection', { defaultValue: 'Ver minha colecao' })}
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
          </div>
        </div>
      </section>

      <section className="border-y border-earth-200 bg-earth-100/70 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-earth-600">
            {t('collector.hubSteps.eyebrow', { defaultValue: 'Como navegar' })}
          </p>
          <div className="flex flex-col gap-2.5">
            {HUB_STEPS.map((step, index) => (
              <a
                key={step}
                href={`#openings-step-${step}`}
                className="rounded-xl border border-earth-300 bg-white px-4 py-3 text-left text-earth-800 transition hover:border-earth-400 hover:bg-earth-50"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                  {t('collector.hubSteps.stepLabel', { defaultValue: 'Passo {{number}}', number: index + 1 })}
                </p>
                <p className="mt-1 text-sm font-semibold">{t(`collector.hubSteps.${step}.title`)}</p>
                <p className="mt-1 text-xs text-earth-600">{t(`collector.hubSteps.${step}.description`)}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="openings-step-concept" className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-earth-900">
                {t('collector.hubSteps.concept.title', { defaultValue: 'O que sao as Aberturas' })}
              </h2>
              <p className="mt-3 text-earth-700">
                {t('collector.hubSteps.concept.description', {
                  defaultValue: 'Reserve packs em caixas reais, pague com creditos e acompanhe a abertura registrada.',
                })}
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <p className="font-semibold text-earth-900">
                    {t('collector.hubSteps.concept.card1Title', { defaultValue: 'Caixas reais no Japao' })}
                  </p>
                  <p className="mt-1 text-sm text-earth-700">
                    {t('collector.hubSteps.concept.card1Body', {
                      defaultValue: 'Cada abertura corresponde a uma caixa fisica com posicoes limitadas.',
                    })}
                  </p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <p className="font-semibold text-earth-900">
                    {t('collector.hubSteps.concept.card2Title', { defaultValue: 'Pagamento em creditos' })}
                  </p>
                  <p className="mt-1 text-sm text-earth-700">
                    {t('collector.hubSteps.concept.card2Body', {
                      defaultValue: '1 credito = ¥1. Adicione saldo na carteira e reserve packs na hora.',
                    })}
                  </p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <p className="font-semibold text-earth-900">
                    {t('collector.hubSteps.concept.card3Title', { defaultValue: 'Resultado na sua colecao' })}
                  </p>
                  <p className="mt-1 text-sm text-earth-700">
                    {t('collector.hubSteps.concept.card3Body', {
                      defaultValue: 'Acompanhe a sessao gravada e os card assets gerados apos a abertura.',
                    })}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-earth-900">
                {t('collector.hubSteps.concept.featuredTitle', { defaultValue: 'Aberturas em destaque' })}
              </h3>
              <p className="mt-2 text-sm text-earth-600">
                {t('collector.hubSteps.concept.featuredDescription', {
                  defaultValue: 'Uma selecao rapida para comecar a explorar as caixas disponiveis.',
                })}
              </p>
              <div className="mt-4 space-y-3">
                {featuredBatches.length === 0 ? (
                  <p className="text-sm text-earth-600">
                    {t('collector.home.emptyBatches', { defaultValue: 'Nenhuma abertura disponivel no momento.' })}
                  </p>
                ) : (
                  featuredBatches.map((batch) => {
                    const name =
                      batch.product?.name?.[localeKey] || batch.product?.name?.['pt-BR'] || batch.product?.id || batch.batchCode
                    const price = Number(
                      batch.boxPriceJpy
                        || batch.product?.priceJpy
                        || (Number(batch.pricePerPositionJpy || 0) * Number(batch.totalPacks || 0))
                        || 0
                    )
                    return (
                      <a
                        key={batch.id}
                        href="#openings-step-catalog"
                        className="flex items-center gap-3 rounded-lg border border-earth-200 bg-earth-50 p-3 transition hover:border-earth-300 hover:bg-white"
                      >
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-earth-200">
                          <img
                            src={batch.product?.image || '/logo.png'}
                            alt={name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-earth-900">{name}</p>
                          <div className="mt-1">
                            <CreditsInline amount={price} className="text-xs font-medium text-earth-800" />
                          </div>
                          <p className="text-xs text-earth-500">
                            {t('collector.batchCard.positions', {
                              defaultValue: '{{reserved}}/{{total}}',
                              reserved: Number(batch.availablePositions ?? Math.max(0, Number(batch.totalPacks || 0) - Number(batch.reservedPositions || 0))),
                              total: Number(batch.totalPacks || 0),
                            })}
                          </p>
                        </div>
                      </a>
                    )
                  })
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="openings-step-howItWorks" className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-earth-900">
              {t('collector.hubSteps.howItWorks.heading', { defaultValue: 'Como funciona na pratica' })}
            </h2>
            <p className="mt-2 max-w-2xl text-earth-600">
              {t('collector.hubSteps.howItWorks.lead', {
                defaultValue: 'Da escolha da caixa ao registro dos pulls, o fluxo acontece em quatro passos.',
              })}
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {['step1', 'step2', 'step3', 'step4'].map((stepKey, index) => {
                const Icon = LIVE_RIP_HOW_IT_WORKS_ICONS[stepKey]
                return (
                  <li
                    key={stepKey}
                    className="flex flex-col rounded-xl border border-earth-200 bg-earth-50/80 p-4"
                  >
                    <div className="flex h-20 items-center justify-center rounded-lg bg-white/90">
                      <div className="h-12 w-12 text-earth-800">
                        {Icon ? <Icon /> : null}
                      </div>
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-earth-500">
                      {t('collector.hubSteps.stepLabel', { defaultValue: 'Passo {{number}}', number: index + 1 })}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-earth-900">
                      {t(`collector.hubSteps.howItWorks.${stepKey}`)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-earth-600">
                      {t(`collector.hubSteps.howItWorks.${stepKey}Detail`)}
                    </p>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-earth-200 bg-earth-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-earth-900">
            {t('collector.hubSteps.trust.title', { defaultValue: 'Transparencia que voce consegue verificar' })}
          </h2>
          <p className="mt-2 text-earth-600">
            {t('collector.hubSteps.trust.description', {
              defaultValue: 'A experiencia combina a emocao da abertura com criterios claros de confianca.',
            })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card1Eyebrow', { defaultValue: 'Moeda' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card1Title', { defaultValue: 'Creditos oficiais' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card1Body', {
                  defaultValue: 'Todos os valores de abertura sao cobrados em creditos (1 credito = ¥1).',
                })}
              </p>
            </article>
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card2Eyebrow', { defaultValue: 'Registro' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card2Title', { defaultValue: 'Sessao gravada' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card2Body', {
                  defaultValue: 'Acompanhe a abertura e os pulls relevantes com historico na plataforma.',
                })}
              </p>
            </article>
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('collector.hubSteps.trust.card3Eyebrow', { defaultValue: 'Colecao' })}
              </p>
              <h3 className="mt-2 font-bold text-earth-900">
                {t('collector.hubSteps.trust.card3Title', { defaultValue: 'Assets rastreados' })}
              </h3>
              <p className="mt-2 text-sm text-earth-700">
                {t('collector.hubSteps.trust.card3Body', {
                  defaultValue: 'Os resultados ficam vinculados a sua conta para consulta e proximos passos.',
                })}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-earth-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-earth-900">
              {t('collector.hubSteps.nextOpening.title', { defaultValue: 'Proxima abertura' })}
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
                        defaultValue: '{{count}} disponiveis',
                        count: openBatchCount,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">
                      {t('collector.hubSteps.nextOpening.sessions', { defaultValue: 'Sessoes' })}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">{openings.length}</dd>
                  </div>
                  <div className="flex items-end">
                    <a
                      href="#openings-step-catalog"
                      className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                    >
                      {t('collector.hubSteps.nextOpening.productsButton', { defaultValue: 'Ver caixas disponiveis' })}
                    </a>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-sm text-earth-600">
                {t('collector.home.emptyOpenings', { defaultValue: 'Nenhuma sessao de abertura agendada no momento.' })}
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

      <section id="openings-step-catalog" className="border-t border-earth-200 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-earth-900">
                {t('collector.home.availableBatches', { defaultValue: 'Aberturas disponiveis' })}
              </h2>
              <p className="mt-2 text-earth-600">
                {t('collector.hubSteps.catalog.description', {
                  defaultValue: 'Compare caixas, valores em creditos e reserve suas posicoes.',
                })}
              </p>
            </div>
            <LocalizedLink toRoute="collectorBatches" className="text-sm font-medium text-earth-700 hover:underline">
              {t('collector.actions.viewAll', { defaultValue: 'Ver tudo' })}
            </LocalizedLink>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-500">
              {t('collector.filters.gamesTitle', { defaultValue: 'Jogos' })}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveGameId('')}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  !activeGameId
                    ? 'border-earth-900 bg-earth-900 text-earth-50'
                    : 'border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                }`}
              >
                {t('collector.filters.allGames', { defaultValue: 'Todos os jogos' })}
              </button>
              {OPENING_CATALOG_CATEGORIES.map((game) => {
                const isActive = game.id === activeGameId
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setActiveGameId(game.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'border-earth-900 bg-earth-900 text-earth-50'
                        : 'border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                    }`}
                  >
                    {game.label[localeKey] || game.id}
                  </button>
                )
              })}
            </div>
          </div>

          {filteredBatches.length === 0 ? (
            <p className="text-sm text-earth-600">
              {t('collector.home.emptyBatches', { defaultValue: 'Nenhuma abertura disponivel no momento.' })}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filteredBatches.map((rip) => (
                <RipCard
                  key={rip.id}
                  rip={rip}
                  product={rip.product}
                  ctaTo={collectorBatchDetailPath(rip.id, locale)}
                  ctaLabel={t('collector.actions.openBatch', { defaultValue: 'Ver abertura' })}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default CollectorHome
