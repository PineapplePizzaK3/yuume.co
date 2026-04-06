/**
 * Tri-currency price: PT site highlights BRL; EN site highlights USD (charge or JPY/BRL-derived estimate).
 * Flags via SVG (emoji flags often render as letters on Windows).
 */
import { useTranslation } from 'react-i18next'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { LOCALE_EN } from '../lib/localeRoutes'
import { formatBRL, formatJPY, formatUSD } from '../lib/fx'
import { resolvedUsdForTri } from '../lib/moneyDisplay'
import { FlagIcon } from './FlagIcon'

function isPos(n) {
  return Number.isFinite(n) && n > 0
}

export function TriCurrencyDisplay({
  brl,
  jpy,
  usd,
  variant = 'card',
  className = '',
  /** Texto curto abaixo da linha secundária (ex.: cupom aplicado) */
  footnote = null,
}) {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const isEn = siteLocale === LOCALE_EN

  const brlCls =
    variant === 'modal'
      ? 'text-2xl sm:text-3xl'
      : variant === 'checkout'
        ? 'text-xl sm:text-2xl'
        : variant === 'compact'
          ? 'text-sm'
          : 'text-lg'
  const secondaryCls =
    variant === 'compact' ? 'text-xs text-earth-700' : 'text-sm text-earth-700'

  const showBrl = isPos(brl)
  const showJpy = isPos(jpy)
  const showUsdExplicit = isPos(usd)
  const effectiveUsd = resolvedUsdForTri(brl, jpy, usd)
  const showPrimaryUsd = isEn && isPos(effectiveUsd)

  const flagSize =
    variant === 'modal' ? 22 : variant === 'checkout' ? 20 : variant === 'compact' ? 14 : 18

  const aria = isEn
    ? t('platform.triCurrency.ariaLabelUsdPrimary')
    : t('platform.triCurrency.ariaLabel')

  if (showPrimaryUsd) {
    return (
      <div
        className={`space-y-1.5 ${className}`}
        role="group"
        aria-label={aria}
      >
        <div
          className={`flex items-center gap-2 font-bold text-earth-900 ${brlCls}`}
          title={t('platform.triCurrency.usdPrimaryTitle')}
        >
          <FlagIcon code="US" size={flagSize + 2} title={t('platform.triCurrency.flagUs')} className="self-center" />
          <span className="tabular-nums">{formatUSD(effectiveUsd)}</span>
          <span className="sr-only">{t('platform.triCurrency.srUsd')}</span>
        </div>
        <div className={`flex flex-wrap items-baseline gap-x-5 gap-y-1 ${secondaryCls}`}>
          <span
            className="inline-flex items-center gap-1.5 tabular-nums"
            title={t('platform.triCurrency.jpyTitle')}
          >
            <FlagIcon code="JP" size={flagSize} title={t('platform.triCurrency.flagJp')} className="self-center" />
            <span>{showJpy ? formatJPY(jpy) : '—'}</span>
            <span className="sr-only">{t('platform.triCurrency.srJpy')}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5 tabular-nums"
            title={t('platform.triCurrency.brlTitle')}
          >
            <FlagIcon code="BR" size={flagSize} title={t('platform.triCurrency.flagBr')} className="self-center" />
            <span>{showBrl ? formatBRL(brl) : '—'}</span>
            <span className="sr-only">{t('platform.triCurrency.srBrl')}</span>
          </span>
        </div>
        {footnote ? <p className="text-xs text-earth-500">{footnote}</p> : null}
      </div>
    )
  }

  return (
    <div
      className={`space-y-1.5 ${className}`}
      role="group"
      aria-label={aria}
    >
      <div
        className={`flex items-center gap-2 font-bold text-earth-900 ${brlCls}`}
        title={t('platform.triCurrency.brlTitle')}
      >
        <FlagIcon code="BR" size={flagSize + 2} title={t('platform.triCurrency.flagBr')} className="self-center" />
        <span className="tabular-nums">{showBrl ? formatBRL(brl) : '—'}</span>
        <span className="sr-only">{t('platform.triCurrency.srBrl')}</span>
      </div>
      <div className={`flex flex-wrap items-baseline gap-x-5 gap-y-1 ${secondaryCls}`}>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title={t('platform.triCurrency.jpyTitle')}
        >
          <FlagIcon code="JP" size={flagSize} title={t('platform.triCurrency.flagJp')} className="self-center" />
          <span>{showJpy ? formatJPY(jpy) : '—'}</span>
          <span className="sr-only">{t('platform.triCurrency.srJpy')}</span>
        </span>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title={t('platform.triCurrency.usdTitle')}
        >
          <FlagIcon code="US" size={flagSize} title={t('platform.triCurrency.flagUs')} className="self-center" />
          <span>{showUsdExplicit ? formatUSD(usd) : '—'}</span>
          <span className="sr-only">{t('platform.triCurrency.srUsd')}</span>
        </span>
      </div>
      {footnote ? <p className="text-xs text-earth-500">{footnote}</p> : null}
    </div>
  )
}
