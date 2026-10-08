import { useTranslation } from 'react-i18next'
import { SELL_BACK_MARKET_PERCENT } from '../../lib/sellBack'
import { BuybackIcon } from './BuybackIcon'

export function BoxBreakSellBackHighlight({ className = '' }) {
  const { t } = useTranslation()

  return (
    <aside
      className={`flex flex-col gap-3 rounded-xl bg-collector-600 px-5 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:gap-5 ${className}`.trim()}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem]" aria-hidden="true">
        <BuybackIcon className="h-12 w-12 text-white sm:h-14 sm:w-14" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
          {t('collector.sellBack.eyebrow', { defaultValue: 'Revenda para a YuumeCo' })}
        </p>
        <p className="mt-0.5 font-display text-lg font-semibold leading-snug">
          {t('collector.sellBack.title', {
            defaultValue: 'Você pode revender para nós as cartas tiradas no Box Break',
          })}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/90">
          {t('collector.sellBack.teaser', {
            defaultValue: 'Até {{percent}}% do valor de mercado, pago em créditos na carteira.',
            percent: SELL_BACK_MARKET_PERCENT,
          })}
        </p>
      </div>
    </aside>
  )
}
