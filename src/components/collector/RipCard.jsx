import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LocalizedLink } from '../LocalizedLink'
import { CreditsAmount } from '../CreditsAmount'
import { DemoBadge } from './DemoBadge'
import { isCollectorMockMode } from '../../services/collectorService'

function statusTone(status) {
  if (status === 'OPENING' || status === 'OPEN') return 'bg-collector-100 text-collector-700 border-collector-600'
  if (status === 'COMPLETED' || status === 'FULFILLING') return 'bg-earth-100 text-earth-700 border-earth-300'
  return 'bg-earth-50 text-earth-700 border-earth-300'
}

function resolveBoxAndPackCredits(rip, product) {
  const packs = Math.max(0, Number(rip?.totalPacks ?? product?.packsPerBox ?? 0))
  const packFromBatch = Number(rip?.pricePerPositionJpy)
  const boxFromBatch = Number(rip?.boxPriceJpy)
  const listed = Number(product?.priceJpy || 0)

  let pricePerPack = Number.isFinite(packFromBatch) && packFromBatch > 0 ? packFromBatch : 0
  let boxTotal = Number.isFinite(boxFromBatch) && boxFromBatch > 0 ? boxFromBatch : 0

  if (!(boxTotal > 0) && listed > 0) {
    // product.priceJpy do catálogo Live Rips = total da caixa
    boxTotal = listed
  }
  if (!(pricePerPack > 0) && boxTotal > 0 && packs > 0) {
    pricePerPack = Math.round((boxTotal / packs) * 100) / 100
  }
  if (!(boxTotal > 0) && pricePerPack > 0 && packs > 0) {
    boxTotal = Math.round(pricePerPack * packs * 100) / 100
  }

  return { boxTotal, pricePerPack }
}

export function RipCard({ rip, product, ctaRoute = 'collectorBatches', ctaLabel, search = '', ctaTo = '' }) {
  const { t, i18n } = useTranslation()
  const { boxTotal, pricePerPack } = resolveBoxAndPackCredits(rip, product)
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR'
  const productName = product?.name?.[locale] || product?.name?.['pt-BR'] || product?.id || ''
  const reserved = Number(rip?.reservedPositions ?? rip?.packsOpened ?? 0)
  const total = Number(rip?.totalPacks ?? rip?.packsPlanned ?? 0)
  const remaining = Math.max(0, Number(rip?.availablePositions ?? total - reserved))
  const percentage = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
  const showDemoBadge = isCollectorMockMode()

  return (
    <article className="overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-earth-100">
        <img src={product?.image || '/logo.png'} alt={productName} className="h-full w-full object-cover" />
        {showDemoBadge ? (
          <div className="absolute left-3 top-3">
            <DemoBadge />
          </div>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-earth-500">{product?.set}</p>
            <h3 className="font-display text-lg font-semibold text-earth-900">{productName}</h3>
          </div>
          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(rip?.status)}`}>
            {t(`collector.status.${rip?.status}`, { defaultValue: rip?.status || 'OPEN' })}
          </span>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm text-earth-700">
            <span>{t('collector.batchCard.remainingLabel', { defaultValue: 'Posicoes disponiveis' })}</span>
            <span className="font-medium tabular-nums">
              {t('collector.batchCard.positions', {
                defaultValue: '{{reserved}}/{{total}}',
                reserved: remaining,
                total,
              })}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-earth-200"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('collector.batchCard.remainingLabel', { defaultValue: 'Posicoes disponiveis' })}
          >
            <div className="h-full rounded-full bg-collector-600 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
          </div>
        </div>
        {boxTotal > 0 || pricePerPack > 0 ? (
          <div className="space-y-2">
            {boxTotal > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-earth-500">
                  {t('collector.batchCard.boxTotal', { defaultValue: 'Valor da caixa' })}
                </p>
                <CreditsAmount amount={boxTotal} variant="default" showFiat />
              </div>
            ) : null}
            {pricePerPack > 0 ? (
              <div>
                <p className="mb-0.5 text-xs font-medium text-earth-500">
                  {t('collector.batchCard.pricePerPack', { defaultValue: 'Valor por pack' })}
                </p>
                <CreditsAmount amount={pricePerPack} variant="compact" showFiat={false} />
              </div>
            ) : null}
          </div>
        ) : null}
        {ctaTo ? (
          <Link
            to={ctaTo}
            className="inline-flex w-full items-center justify-center rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
          >
            {ctaLabel || t('collector.actions.viewBatch', { defaultValue: 'Ver abertura' })}
          </Link>
        ) : (
          <LocalizedLink
            toRoute={ctaRoute}
            search={search}
            className="inline-flex w-full items-center justify-center rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
          >
            {ctaLabel || t('collector.actions.viewBatch', { defaultValue: 'Ver abertura' })}
          </LocalizedLink>
        )}
      </div>
    </article>
  )
}
