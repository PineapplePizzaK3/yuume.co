import { useTranslation } from 'react-i18next'
import { FlagIcon } from './FlagIcon'
import { CreditsIcon } from './CreditsIcon'
import { formatBRL, formatUSD } from '../lib/fx'
import { jpyAmountToTri } from '../lib/quoteMoneyTri'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { LOCALE_EN } from '../lib/localeRoutes'

/** 1 crédito da plataforma = ¥1. */
export function formatCredits(amount) {
  const n = Math.max(0, Number(amount) || 0)
  return Math.round(n).toLocaleString('ja-JP')
}

/**
 * Exibe valores oficiais em créditos (com ícone da moeda interna).
 * Opcionalmente mostra equivalentes BRL/USD (1 crédito = ¥1).
 */
export function CreditsAmount({
  amount,
  variant = 'default',
  showFiat = true,
  showUnitLabel = true,
  className = '',
}) {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const credits = Math.max(0, Number(amount) || 0)
  const tri = jpyAmountToTri(credits)
  const isEn = siteLocale === LOCALE_EN

  const iconSize = variant === 'compact' ? 14 : variant === 'lg' ? 22 : 18
  const amountCls =
    variant === 'compact'
      ? 'text-sm font-semibold'
      : variant === 'lg'
        ? 'text-2xl font-bold'
        : 'text-lg font-semibold'
  const unitCls = variant === 'compact' ? 'text-xs' : 'text-sm'

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5 text-earth-900">
        <CreditsIcon
          size={iconSize}
          title={t('credits.iconTitle', { defaultValue: 'Créditos YuumeCo' })}
        />
        <span className={`tabular-nums ${amountCls}`}>{formatCredits(credits)}</span>
        {showUnitLabel ? (
          <span className={`${unitCls} font-medium text-earth-600`}>
            {t('credits.unit', { defaultValue: 'créditos' })}
          </span>
        ) : null}
      </div>
      {showFiat && tri ? (
        <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-earth-600 ${variant === 'compact' ? 'text-[11px]' : 'text-xs'}`}>
          <span className="inline-flex items-center gap-1">
            <FlagIcon code="JP" size={variant === 'compact' ? 12 : 14} />
            <span>¥{formatCredits(credits)}</span>
            <span className="text-earth-500">
              ({t('credits.parityHint', { defaultValue: '1 crédito = ¥1' })})
            </span>
          </span>
          {isEn ? (
            <span className="inline-flex items-center gap-1">
              <FlagIcon code="US" size={variant === 'compact' ? 12 : 14} />
              <span>{formatUSD(tri.usd)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <FlagIcon code="BR" size={variant === 'compact' ? 12 : 14} />
              <span>{formatBRL(tri.brl)}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Valor inline compacto: ícone + número (sem bloco fiat). */
export function CreditsInline({ amount, className = '', size = 14 }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <CreditsIcon size={size} title={t('credits.iconTitle', { defaultValue: 'Créditos YuumeCo' })} />
      <span>{formatCredits(amount)}</span>
    </span>
  )
}
