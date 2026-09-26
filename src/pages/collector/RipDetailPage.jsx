import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditsAmount, CreditsInline, formatCredits } from '../../components/CreditsAmount'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { RipProgress } from '../../components/collector/RipProgress'
import { TopCardTile } from '../../components/collector/TopCardTile'
import {
  getCollectionTopCards,
  getOpeningBatch,
  isCollectorMockMode,
  reserveOpeningBatch,
} from '../../services/collectorService'
import { getWallet } from '../../services/walletService'
import { collectorCollectionRipPath, collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useAuth } from '../../shared/auth/useAuth'
import { PageSeo } from '../../shared/seo/PageSeo'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

/** JP TCG sealed cases are commonly 12 boxes. */
const DEFAULT_BOXES_PER_CASE = 12

function buildQuickQuantityOptions({ available, packsPerBox, boxesPerCase, t }) {
  const max = Math.max(0, Math.floor(Number(available) || 0))
  if (max < 1) return []

  const boxSize = Math.max(1, Math.floor(Number(packsPerBox) || max))
  const boxesInCase = Math.max(1, Math.floor(Number(boxesPerCase) || DEFAULT_BOXES_PER_CASE))
  const halfBox = Math.max(1, Math.floor(boxSize / 2))
  const caseSize = boxSize * boxesInCase

  const candidates = [
    { id: 'one', qty: 1, label: t('collector.batchDetail.quickQty.onePack', { defaultValue: '1 pack' }) },
    { id: 'five', qty: 5, label: t('collector.batchDetail.quickQty.fivePacks', { defaultValue: '5 packs' }) },
    {
      id: 'half',
      qty: halfBox,
      label: t('collector.batchDetail.quickQty.halfBox', {
        defaultValue: '1/2 box ({{count}})',
        count: halfBox,
      }),
    },
    {
      id: 'box',
      qty: boxSize,
      label: t('collector.batchDetail.quickQty.fullBox', {
        defaultValue: '1 box ({{count}})',
        count: boxSize,
      }),
    },
    {
      id: 'case',
      qty: caseSize,
      label: t('collector.batchDetail.quickQty.fullCase', {
        defaultValue: '1 case ({{count}})',
        count: caseSize,
      }),
    },
    {
      id: 'remaining',
      qty: max,
      label: t('collector.batchDetail.quickQty.remaining', {
        defaultValue: 'Restante ({{count}})',
        count: max,
      }),
    },
  ]

  const seen = new Set()
  return candidates.filter((option) => {
    if (!(option.qty >= 1) || option.qty > max) return false
    if (seen.has(option.qty)) return false
    seen.add(option.qty)
    return true
  })
}

function RipDetailPage() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const { ripId, batchId } = useParams()
  const targetBatchId = batchId || ripId || ''
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [walletBalance, setWalletBalance] = useState(null)
  const [topCardsPayload, setTopCardsPayload] = useState(null)
  const [topCardsLoading, setTopCardsLoading] = useState(false)
  const isMockMode = isCollectorMockMode()

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

  useEffect(() => {
    let active = true
    async function loadWallet() {
      if (!user?.id || isMockMode) {
        setWalletBalance(null)
        return
      }
      const walletResult = await getWallet(user.id)
      if (!active) return
      setWalletBalance(Number(walletResult?.data?.balance || 0))
    }
    void loadWallet()
    return () => {
      active = false
    }
  }, [user?.id, isMockMode])

  useEffect(() => {
    let active = true
    if (!batch) {
      setTopCardsPayload(null)
      return () => {
        active = false
      }
    }
    setTopCardsLoading(true)
    void getCollectionTopCards(batch).then((res) => {
      if (!active) return
      setTopCardsPayload(res?.data || null)
      setTopCardsLoading(false)
    })
    return () => {
      active = false
    }
  }, [batch])

  const availablePositions = Math.max(0, Number(batch?.availablePositions || 0))
  const packsPerBox = Math.max(
    1,
    Number(batch?.product?.packsPerBox || batch?.totalPacks || batch?.packsPlanned || 1)
  )
  const boxesPerCase = Math.max(1, Number(batch?.product?.boxesPerCase || DEFAULT_BOXES_PER_CASE))

  useEffect(() => {
    if (!(availablePositions > 0)) {
      setQuantity(1)
      return
    }
    setQuantity((prev) => Math.min(Math.max(1, Number(prev) || 1), availablePositions))
  }, [availablePositions])

  const quickQuantityOptions = useMemo(
    () =>
      buildQuickQuantityOptions({
        available: availablePositions,
        packsPerBox,
        boxesPerCase,
        t,
      }),
    [availablePositions, packsPerBox, boxesPerCase, t]
  )

  const unitPriceCredits = Number(batch?.pricePerPositionJpy || 0)
  const selectedQty = Math.max(1, Number(quantity) || 1)
  const totalChargeCredits = unitPriceCredits * selectedQty
  const boxTotalCredits = Number(
    batch?.boxPriceJpy
      || (unitPriceCredits > 0 && packsPerBox > 0 ? unitPriceCredits * packsPerBox : 0)
      || batch?.product?.priceJpy
      || 0
  )
  const walletGap = walletBalance == null ? 0 : Math.max(0, totalChargeCredits - walletBalance)
  const canReserveMore = availablePositions > 0
  const labels = {
    packs: t('collector.batchDetail.remainingLabel', { defaultValue: 'Posicoes disponiveis' }),
    OPEN: t('collector.status.OPEN', { defaultValue: 'Aberta' }),
    SCHEDULED: t('collector.status.SCHEDULED', { defaultValue: 'Agendada' }),
    OPENING: t('collector.status.OPENING', { defaultValue: 'Em abertura' }),
    COMPLETED: t('collector.status.COMPLETED', { defaultValue: 'Concluida' }),
    FULFILLING: t('collector.status.FULFILLING', { defaultValue: 'Em fulfillment' }),
  }
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const topCards = Array.isArray(topCardsPayload?.cards) ? topCardsPayload.cards : []
  const topCardsUpdatedAt = topCardsPayload?.updatedAt ? new Date(topCardsPayload.updatedAt) : null
  const topCardsUpdatedLabel =
    topCardsUpdatedAt && !Number.isNaN(topCardsUpdatedAt.getTime())
      ? topCardsUpdatedAt.toLocaleString(localeKey === 'en' ? 'en-US' : 'pt-BR')
      : null

  const onReserve = async () => {
    if (!batch) return
    if (!isMockMode && !isAuthenticated) {
      navigate(path('login'), { state: { from: location } })
      return
    }
    setReserving(true)
    setNotice('')
    setErrorNotice('')
    const qty = Math.min(Math.max(1, Number(quantity) || 1), availablePositions || 1)
    const res = await reserveOpeningBatch(batch.id, { quantity: qty })
    setReserving(false)
    if (res?.error) {
      setErrorNotice(
        res.error.message
          || t('collector.errors.reserveFailed', { defaultValue: 'Nao foi possivel reservar posicao agora.' })
      )
      return
    }
    const refresh = await getOpeningBatch(batch.id)
    setBatch(refresh?.data || batch)
    if (user?.id && !isMockMode) {
      const walletResult = await getWallet(user.id)
      setWalletBalance(Number(walletResult?.data?.balance || 0))
    }
    const charged = Number(res?.data?.chargedJpy || totalChargeCredits)
    setNotice(
      isMockMode
        ? t('collector.batchDetail.reserveSuccess', { defaultValue: 'Posicao reservada no modo demo.' })
        : t('collector.batchDetail.reservePaidSuccess', {
            defaultValue: 'Posicao reservada com {{amount}} creditos.',
            amount: formatCredits(charged),
          })
    )
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('loading')}</div>
  }
  if (!batch) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.errors.batchNotFound', { defaultValue: 'Abertura nao encontrada.' })}</div>
  }

  const reserved = Number(batch.reservedPositions ?? batch.packsOpened ?? 0)
  const total = Number(batch.totalPacks ?? batch.packsPlanned ?? 0)
  const remaining = Math.max(0, Number(batch.availablePositions ?? total - reserved))
  const remainingPct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.meta.batchDetailTitle', { defaultValue: 'Detalhe da Abertura | Collector MVP' })}
        description={t('collector.meta.batchDetailDescription', { defaultValue: 'Detalhe da abertura e progresso das reservas.' })}
        noindex={isMockMode}
      />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              {isMockMode ? <DemoBadge /> : null}
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-semibold text-earth-700">{batch.batchCode}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-earth-900">{batch.product?.name?.[localeKey] || batch.product?.id}</h1>
            <p className="mt-2 text-sm text-earth-600">
              {batch.product?.set} • {batch.product?.language}
            </p>
            <div className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-earth-700">
                <span className="font-medium">
                  {t('collector.batchDetail.remainingLabel', { defaultValue: 'Posicoes disponiveis' })}
                </span>
                <span className="tabular-nums font-semibold text-earth-900">
                  {remaining}/{total}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-earth-200"
                role="progressbar"
                aria-valuenow={remainingPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('collector.batchDetail.remainingLabel', { defaultValue: 'Posicoes disponiveis' })}
              >
                <div
                  className="h-full rounded-full bg-collector-600 transition-[width] duration-300"
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-earth-500">
                {t('collector.batchDetail.availablePositions', { defaultValue: 'Posicoes disponiveis' })}:{' '}
                <span className="font-medium text-earth-700">{remaining}</span>
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {boxTotalCredits > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">
                    {t('collector.batchCard.boxTotal', { defaultValue: 'Valor da caixa' })}
                  </p>
                  <CreditsAmount amount={boxTotalCredits} />
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-earth-500">
                  {t('collector.batchDetail.pricePerPosition', { defaultValue: 'Preco por posicao' })}
                </p>
                <CreditsAmount amount={unitPriceCredits} variant="compact" />
              </div>
              <div className="rounded-xl border border-earth-200 bg-earth-50 p-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-earth-500">
                  {t('collector.batchDetail.selectedTotalLabel', {
                    defaultValue: 'Total para {{count}} pack(s)',
                    count: selectedQty,
                  })}
                </p>
                <CreditsAmount amount={totalChargeCredits} variant="lg" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-earth-700">
                  <span>{t('collector.batchDetail.quantityLabel', { defaultValue: 'Quantidade' })}</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, availablePositions)}
                    value={quantity}
                    onChange={(event) => {
                      const next = Math.max(1, Number(event.target.value) || 1)
                      setQuantity(availablePositions > 0 ? Math.min(next, availablePositions) : next)
                    }}
                    className="w-20 rounded-lg border border-earth-300 px-2 py-1 text-earth-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={onReserve}
                  disabled={reserving || !canReserveMore}
                  className="rounded-lg bg-collector-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-collector-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!canReserveMore
                    ? t('collector.actions.soldOut', { defaultValue: 'Sem posicoes disponiveis' })
                    : reserving
                      ? t('collector.actions.reservingCredits', { defaultValue: 'Debitando creditos...' })
                      : !isMockMode && !isAuthenticated
                        ? t('collector.actions.loginToReserve', { defaultValue: 'Entrar para reservar' })
                        : t('collector.actions.reserveWithCredits', { defaultValue: 'Reservar com creditos' })}
                </button>
              </div>
              {quickQuantityOptions.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-earth-500">
                    {t('collector.batchDetail.quickQty.label', { defaultValue: 'Quantidades rapidas' })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuantityOptions.map((option) => {
                      const selected = Number(quantity) === option.qty
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setQuantity(option.qty)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? 'border-collector-600 bg-collector-100 text-collector-800'
                              : 'border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
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
            </div>
            {!isMockMode ? (
              <div className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4 text-sm text-earth-700">
                <p>{t('collector.batchDetail.walletOnlyHint', { defaultValue: 'Aberturas sao cobradas somente com creditos da carteira.' })}</p>
                <p className="mt-1 text-xs text-earth-500">
                  {t('credits.parityHint', { defaultValue: '1 crédito = ¥1' })}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <span>{t('collector.batchDetail.totalCreditsLabel', { defaultValue: 'Total desta reserva' })}:</span>
                  <CreditsInline amount={totalChargeCredits} className="font-semibold text-earth-900" />
                </p>
                {walletBalance != null ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <span>{t('collector.batchDetail.walletBalanceLabel', { defaultValue: 'Seus creditos' })}:</span>
                    <CreditsInline amount={walletBalance} className="font-semibold text-earth-900" />
                    {walletGap > 0 ? (
                      <span className="inline-flex items-center gap-1 text-earth-600">
                        • {t('collector.batchDetail.walletGapLabel', { defaultValue: 'Faltam' })}:
                        <CreditsInline amount={walletGap} />
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {batch.reservedByUser > 0 ? (
                  <p className="mt-1 text-xs text-earth-600">
                    {t('collector.batchDetail.alreadyReserved', {
                      defaultValue: 'Voce ja tem {{count}} posicao(oes) nesta abertura.',
                      count: batch.reservedByUser,
                    })}
                  </p>
                ) : null}
                <Link to={path('appLounge')} className="mt-2 inline-block text-xs font-medium text-earth-800 underline">
                  {t('collector.batchDetail.addCreditsCta', { defaultValue: 'Adicionar saldo na carteira' })}
                </Link>
              </div>
            ) : null}
            {notice ? <p className="mt-4 text-sm text-collector-700">{notice}</p> : null}
            {errorNotice ? <p className="mt-4 text-sm text-red-700">{errorNotice}</p> : null}
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
            {t('collector.topCards.title', { defaultValue: 'Principais cartas da colecao' })}
          </h3>
          <p className="mt-1 text-sm text-earth-600">
            {t('collector.topCards.subtitle', { defaultValue: 'Ranking automatico por valor em creditos (SNKRDUNK).' })}
          </p>
          <p className="mt-2 text-xs text-earth-500">
            {t('collector.topCards.source', { defaultValue: 'Fonte: SNKRDUNK' })}
            {topCardsUpdatedLabel
              ? ` • ${t('collector.topCards.updatedAt', { defaultValue: 'Atualizado em {{value}}', value: topCardsUpdatedLabel })}`
              : ''}
          </p>

          {topCardsLoading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`top-card-skeleton-${index}`} className="animate-pulse rounded-xl border border-earth-200 bg-earth-100 p-3">
                  <div className="aspect-[3/4] w-full rounded-lg bg-earth-200" />
                  <div className="mt-3 h-4 w-11/12 rounded bg-earth-200" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-earth-200" />
                </div>
              ))}
            </div>
          ) : topCards.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topCards.map((card) => (
                <TopCardTile key={`${card.snkrdunkId}-${card.cardNumber || card.name}`} card={card} locale={localeKey} t={t} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-earth-200 bg-earth-50 px-4 py-3 text-sm text-earth-600">
              {t('collector.topCards.empty', { defaultValue: 'Ainda nao encontramos cartas relevantes para esta colecao.' })}
            </p>
          )}
        </div>
      </section>
    </>
  )
}

export default RipDetailPage
