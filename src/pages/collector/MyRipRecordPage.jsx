import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { CreditsInline, formatCredits } from '../../components/CreditsAmount'
import { PullReveal } from '../../components/collector/PullReveal'
import { BoxBreakSellBackHighlight } from '../../components/collector/BoxBreakSellBackHighlight'
import { BoxBreakSetSummary } from '../../components/collector/BoxBreakSetSummary'
import { LiveRipStatusTimeline } from '../../components/live-rips/LiveRipStatusTimeline'
import { getMyRipRecord, isCollectorMockMode } from '../../services/collectorService'
import { getAssetByPullId, getCollectorCardById } from '../../data/collectorMock'
import { collectorBatchDetailPath, collectorCardAssetPath } from '../../lib/localeRoutes'
import {
  liveParticipationBoxProgress,
  liveParticipationPaidCredits,
  liveParticipationProgressItems,
  liveParticipationQty,
  liveParticipationStatusTone,
  resolveLiveParticipationStatus,
} from '../../lib/liveRipParticipation'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

function MyRipRecordPage() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const { ripId } = useParams()
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()

  useEffect(() => {
    let active = true
    void getMyRipRecord(ripId).then((res) => {
      if (!active) return
      if (res?.error) {
        setError(res.error.message || 'error')
        setRecord(null)
      } else {
        setError('')
        setRecord(res?.data || null)
      }
    })
    return () => {
      active = false
    }
  }, [ripId])

  const participationStatus = record ? resolveLiveParticipationStatus(record) : 'WAITING_BOX'
  const qty = liveParticipationQty(record)
  const paidCredits = liveParticipationPaidCredits(record)
  const boxProgress = liveParticipationBoxProgress(record)
  const timelineLabels = {
    PAID: t('collector.participation.status.PAID', { defaultValue: 'Compra confirmada' }),
    WAITING_BOX: t('collector.participation.status.WAITING_BOX', { defaultValue: 'Aguardando a caixa completar' }),
    WAITING_OPEN: t('collector.participation.status.WAITING_OPEN', { defaultValue: 'Aguardando abertura' }),
    OPENING: t('collector.participation.status.OPENING', { defaultValue: 'Em Box Break' }),
    COMPLETED: t('collector.participation.status.COMPLETED', { defaultValue: 'Cartas na coleção' }),
  }
  const timelineItems = record ? liveParticipationProgressItems(record, timelineLabels) : []
  const batchId = record?.batch?.id || record?.allocation?.batchId || ''

  if (!isMockMode && !isAuthenticated) {
    return (
      <section className="mx-auto mt-24 max-w-3xl rounded-2xl border border-earth-200 bg-white p-6 text-earth-700 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-earth-900">
          {t('collector.collection.loginRequiredTitle', { defaultValue: 'Entre para ver sua colecao' })}
        </h1>
        <p className="mt-2 text-sm text-earth-600">
          {t('collector.collection.loginRequiredBody', { defaultValue: 'Sua colecao e seus registros de Box Break ficam disponiveis apos o login.' })}
        </p>
        <Link
          to={path('login')}
          state={{ from: location }}
          className="mt-4 inline-flex rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
        >
          {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
        </Link>
      </section>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">
        {t('collector.errors.joinRequired', { defaultValue: 'Participe do rip para acessar este registro.' })}
      </div>
    )
  }
  if (!record) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('loading')}</div>
  }

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.recordTitle', { defaultValue: 'Registro do Rip | Collector MVP' })} noindex={isMockMode} />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <p className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${liveParticipationStatusTone(participationStatus)}`}>
              {t(`collector.participation.status.${participationStatus}`, {
                defaultValue: timelineLabels[participationStatus],
              })}
            </p>
            <div className="mt-4">
              <BoxBreakSetSummary
                product={record.product}
                packs={record.batch?.totalPacks || record.product?.packsPerBox}
                localeKey={localeKey}
                title={record.product?.name?.[localeKey] || record.product?.id}
                titleAs="h1"
              />
            </div>
            <dl className="mt-4 grid gap-2 text-sm text-earth-700 sm:grid-cols-2">
              {record.code || record.batch?.batchCode ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-earth-500">
                    {t('collector.ripDetail.code', { defaultValue: 'Código' })}
                  </dt>
                  <dd className="font-medium text-earth-900">{record.batch?.batchCode || record.code}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide text-earth-500">
                  {t('collector.participation.yourPacks', { defaultValue: 'Seus packs' })}
                </dt>
                <dd className="font-medium text-earth-900">
                  {t('collector.ripDetail.reservedPacks', {
                    defaultValue: '{{count}} pack(s) comprados',
                    count: qty,
                  })}
                </dd>
              </div>
              {paidCredits > 0 ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-earth-500">
                    {t('collector.participation.paidAmount', { defaultValue: 'Valor pago' })}
                  </dt>
                  <dd>
                    <CreditsInline amount={paidCredits} className="font-medium text-earth-900" />
                  </dd>
                </div>
              ) : null}
            </dl>
            {location.state?.reserved ? (
              <p className="mt-3 rounded-lg bg-collector-100 p-3 text-sm text-collector-800">
                {t('collector.ripDetail.afterReserve', {
                  defaultValue: 'Participação reservada com {{amount}} créditos. As cartas entram na coleção depois que a caixa for aberta.',
                  amount: formatCredits(Number(location.state?.chargedJpy || paidCredits || 0)),
                })}
              </p>
            ) : null}
            <p className="mt-3 rounded-lg bg-earth-50 p-3 text-sm text-earth-700">
              {t(`collector.participation.message.${participationStatus}`, {
                defaultValue: timelineLabels[participationStatus],
              })}
            </p>
            <div className="mt-4">
              <LiveRipStatusTimeline items={timelineItems} />
            </div>
            {boxProgress.total > 0 && participationStatus === 'WAITING_BOX' ? (
              <div className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-earth-700">
                  <span>{t('collector.participation.boxRemaining', { defaultValue: 'Packs restantes nesta caixa' })}</span>
                  <span className="tabular-nums font-medium text-earth-900">
                    {boxProgress.remaining}/{boxProgress.total}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-earth-200"
                  role="progressbar"
                  aria-valuenow={boxProgress.remainingPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('collector.participation.boxRemaining', { defaultValue: 'Packs restantes nesta caixa' })}
                >
                  <div
                    className="h-full rounded-full bg-collector-600 transition-[width] duration-300"
                    style={{ width: `${boxProgress.remainingPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {participationStatus === 'WAITING_OPEN' ? (
              <p className="mt-4 text-sm text-earth-600">
                {t('collector.participation.boxSoldOut', {
                  defaultValue: 'Caixa completa. Seus packs entram na abertura.',
                })}
              </p>
            ) : null}
            {record.openingSession?.openingVideo ? (
              <a
                href={record.openingSession.openingVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-xs font-medium text-earth-700 hover:underline"
              >
                {t('collector.actions.watchRecordedOpening', { defaultValue: 'Assistir Box Break gravado' })}
              </a>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {batchId ? (
                <Link
                  to={collectorBatchDetailPath(batchId, locale)}
                  className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50"
                >
                  {t('collector.actions.viewBatch', { defaultValue: 'Ver Box Break' })}
                </Link>
              ) : null}
              <Link
                to={`${path('collectorCollection')}?tab=rips`}
                className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50"
              >
                {t('collector.actions.viewCollection', { defaultValue: 'Ver na colecao' })}
              </Link>
              <Link
                to={`${path('collectorCollection')}?tab=cards`}
                className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50"
              >
                {t('collector.actions.viewCollectionCards', { defaultValue: 'Ver cartas' })}
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-earth-900">
              {t('collector.ripDetail.pullHighlights', { defaultValue: 'Cartas encontradas' })}
            </h2>
            {(record.pulls || []).length > 0 ? (
              <p className="mt-2 text-sm text-earth-600">
                {t('collector.ripDetail.demoPullsHint', {
                  defaultValue: 'Pode vender de volta por 85% do valor de mercado e recuperar créditos.',
                })}
              </p>
            ) : (
              <p className="mt-2 text-sm text-earth-600">
                {t('collector.ripDetail.noPullsYet', {
                  defaultValue: 'Ainda sem cartas. Elas entram aqui depois do Box Break.',
                })}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {(record.pulls || []).map((pull) => {
                const card = pull.card || getCollectorCardById(pull.cardId)
                const relatedAsset = pull.asset || getAssetByPullId(pull.id)
                return (
                  <div key={pull.id} className="rounded-xl border border-earth-200 bg-earth-50 p-3">
                    <PullReveal
                      compact
                      pull={{
                        card_name: card?.name?.[localeKey] || card?.name?.['pt-BR'] || card?.id || '',
                        rarity: card?.rarity || pull.rarity || '',
                        image_url: card?.image || pull.image || '',
                      }}
                    />
                    {relatedAsset ? (
                      <Link
                        to={collectorCardAssetPath(relatedAsset.id, locale)}
                        className="mt-2 inline-flex text-xs font-medium text-earth-700 hover:underline"
                      >
                        {t('collector.actions.viewRelatedAsset', { defaultValue: 'Ver card asset relacionado' })}
                      </Link>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </article>
        </div>
      </section>
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <BoxBreakSellBackHighlight />
        </div>
      </section>
    </>
  )
}

export default MyRipRecordPage
