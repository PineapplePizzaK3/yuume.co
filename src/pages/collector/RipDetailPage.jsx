import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { RipProgress } from '../../components/collector/RipProgress'
import { PullReveal } from '../../components/collector/PullReveal'
import { getOpeningBatch, reserveOpeningBatch } from '../../services/collectorService'
import { collectorCollectionRipPath, collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { jpyAmountToTri } from '../../lib/quoteMoneyTri'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { getCollectorCardById } from '../../data/collectorMock'

function RipDetailPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const { ripId, batchId } = useParams()
  const targetBatchId = batchId || ripId || ''
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    void getOpeningBatch(targetBatchId).then((res) => {
      if (!active) return
      setBatch(res?.data || null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [targetBatchId])

  const tri = useMemo(() => jpyAmountToTri(batch?.product?.priceJpy), [batch?.product?.priceJpy])
  const labels = {
    packs: t('collector.batchDetail.packsLabel', { defaultValue: 'Posicoes reservadas' }),
    OPEN: t('collector.status.OPEN', { defaultValue: 'Aberta' }),
    SCHEDULED: t('collector.status.SCHEDULED', { defaultValue: 'Agendada' }),
    OPENING: t('collector.status.OPENING', { defaultValue: 'Em abertura' }),
    COMPLETED: t('collector.status.COMPLETED', { defaultValue: 'Concluida' }),
    FULFILLING: t('collector.status.FULFILLING', { defaultValue: 'Em fulfillment' }),
  }
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  const onReserve = async () => {
    if (!batch) return
    setReserving(true)
    const res = await reserveOpeningBatch(batch.id, { quantity: 1 })
    setReserving(false)
    if (res?.error) {
      setNotice(t('collector.errors.reserveFailed', { defaultValue: 'Nao foi possivel reservar posicao agora.' }))
      return
    }
    const refresh = await getOpeningBatch(batch.id)
    setBatch(refresh?.data || batch)
    setNotice(t('collector.batchDetail.reserveSuccess', { defaultValue: 'Posicao reservada no modo demo.' }))
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('loading')}</div>
  }
  if (!batch) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.errors.batchNotFound', { defaultValue: 'Abertura nao encontrada.' })}</div>
  }

  const reserved = Number(batch.reservedPositions ?? batch.packsOpened ?? 0)
  const total = Number(batch.totalPacks ?? batch.packsPlanned ?? 0)
  const reservedPct = total > 0 ? Math.min(100, Math.round((reserved / total) * 100)) : 0

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.meta.batchDetailTitle', { defaultValue: 'Detalhe da Abertura | Collector MVP' })}
        description={t('collector.meta.batchDetailDescription', { defaultValue: 'Detalhe da abertura e progresso das reservas.' })}
        noindex
      />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <DemoBadge />
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-semibold text-earth-700">{batch.batchCode}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-earth-900">{batch.product?.name?.[localeKey] || batch.product?.id}</h1>
            <p className="mt-2 text-sm text-earth-600">
              {batch.product?.set} • {batch.product?.language}
            </p>
            <div className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-earth-700">
                <span className="font-medium">
                  {t('collector.batchDetail.packsLabel', { defaultValue: 'Posicoes reservadas' })}
                </span>
                <span className="tabular-nums font-semibold text-earth-900">
                  {reserved}/{total}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-earth-200"
                role="progressbar"
                aria-valuenow={reservedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('collector.batchDetail.packsLabel', { defaultValue: 'Posicoes reservadas' })}
              >
                <div
                  className="h-full rounded-full bg-collector-600 transition-[width] duration-300"
                  style={{ width: `${reservedPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-earth-500">
                {t('collector.batchDetail.availablePositions', { defaultValue: 'Posicoes disponiveis' })}:{' '}
                <span className="font-medium text-earth-700">{batch.availablePositions}</span>
              </p>
            </div>
            <div className="mt-5">{tri ? <TriCurrencyDisplay jpy={tri.jpy} brl={tri.brl} usd={tri.usd} /> : null}</div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onReserve}
                disabled={reserving || batch.isJoined}
                className="rounded-lg bg-collector-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-collector-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batch.isJoined
                  ? t('collector.actions.reserved', { defaultValue: 'Reserva registrada' })
                  : reserving
                    ? t('collector.actions.reserving', { defaultValue: 'Reservando...' })
                    : t('collector.actions.reservePosition', { defaultValue: 'Reservar posicao' })}
              </button>
              {batch.myAllocations?.[0]?.id ? (
                <Link
                  to={collectorCollectionRipPath(batch.myAllocations?.[0]?.id || '', locale)}
                  className="rounded-lg border border-earth-300 bg-white px-5 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                >
                  {t('collector.actions.viewRecord', { defaultValue: 'Ver registro da abertura' })}
                </Link>
              ) : null}
              {batch.openingSessionId ? (
                <Link
                  to={collectorOpeningDetailPath(batch.openingSessionId, locale)}
                  className="rounded-lg border border-earth-300 bg-white px-5 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                >
                  {t('collector.actions.openOpening', { defaultValue: 'Ver opening session' })}
                </Link>
              ) : null}
            </div>
            {notice ? <p className="mt-4 text-sm text-collector-700">{notice}</p> : null}
          </article>
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-xl font-semibold text-earth-900">
              {t('collector.batchDetail.progressTitle', { defaultValue: 'Progresso da abertura' })}
            </h2>
            <RipProgress rip={batch} labels={labels} />
          </article>
        </div>
      </section>
      <section className="px-4 pb-14">
        <div className="mx-auto max-w-6xl rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
          <h3 className="font-display text-xl font-semibold text-earth-900">
            {t('collector.ripDetail.pullHighlights', { defaultValue: 'Pulls relevantes' })}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(batch.pulls || []).map((pull) => {
              const card = getCollectorCardById(pull.cardId)
              return (
                <PullReveal
                  key={pull.id}
                  pull={{
                    card_name: card?.name?.[localeKey] || card?.name?.['pt-BR'] || card?.id || '',
                    rarity: card?.rarity || '',
                    image_url: card?.image || '',
                  }}
                />
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}

export default RipDetailPage
