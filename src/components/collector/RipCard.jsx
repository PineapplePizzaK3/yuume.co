import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LocalizedLink } from '../LocalizedLink'
import { TriCurrencyDisplay } from '../TriCurrencyDisplay'
import { DemoBadge } from './DemoBadge'
import { jpyAmountToTri } from '../../lib/quoteMoneyTri'

function statusTone(status) {
  if (status === 'OPENING' || status === 'OPEN') return 'bg-collector-100 text-collector-700 border-collector-600'
  if (status === 'COMPLETED' || status === 'FULFILLING') return 'bg-earth-100 text-earth-700 border-earth-300'
  return 'bg-earth-50 text-earth-700 border-earth-300'
}

export function RipCard({ rip, product, ctaRoute = 'collectorBatches', ctaLabel, search = '', ctaTo = '' }) {
  const { t, i18n } = useTranslation()
  const tri = jpyAmountToTri(product?.priceJpy)
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR'
  const productName = product?.name?.[locale] || product?.name?.['pt-BR'] || product?.id || ''
  const reserved = Number(rip?.reservedPositions ?? rip?.packsOpened ?? 0)
  const total = Number(rip?.totalPacks ?? rip?.packsPlanned ?? 0)
  const percentage = total > 0 ? Math.min(100, Math.round((reserved / total) * 100)) : 0

  return (
    <article className="overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-earth-100">
        <img src={product?.image || '/logo.png'} alt={productName} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3">
          <DemoBadge />
        </div>
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
            <span>{t('collector.batchCard.positionsLabel', { defaultValue: 'Posicoes reservadas' })}</span>
            <span className="font-medium tabular-nums">
              {t('collector.batchCard.positions', {
                defaultValue: '{{reserved}}/{{total}}',
                reserved,
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
            aria-label={t('collector.batchCard.positionsLabel', { defaultValue: 'Posicoes reservadas' })}
          >
            <div className="h-full rounded-full bg-collector-600 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
          </div>
        </div>
        {tri ? <TriCurrencyDisplay jpy={tri.jpy} brl={tri.brl} usd={tri.usd} variant="compact" /> : null}
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
