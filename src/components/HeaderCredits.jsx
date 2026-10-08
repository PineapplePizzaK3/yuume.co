import { useTranslation } from 'react-i18next'
import { CreditsInline, formatCredits } from './CreditsAmount'
import { LocalizedLink } from './LocalizedLink'
import { useHeaderCredits } from '../hooks/useHeaderCredits'

export function HeaderCredits({ compact = false, className = '', onNavigate }) {
  const { t } = useTranslation()
  const { balance, visible } = useHeaderCredits()

  if (!visible || balance == null) return null

  const amountLabel = formatCredits(balance)
  const label = compact
    ? t('nav.creditsCompactAria', {
        defaultValue: '{{amount}} créditos',
        amount: amountLabel,
      })
    : t('nav.creditsAria', {
        defaultValue: 'Seus créditos: {{amount}}',
        amount: amountLabel,
      })

  return (
    <LocalizedLink
      toRoute="appLounge"
      onClick={onNavigate}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-earth-200 bg-white font-medium text-earth-800 transition hover:border-earth-300 hover:bg-earth-50 ${
        compact ? 'h-9 px-2 text-xs sm:h-10 sm:px-2.5 sm:text-sm' : 'px-2.5 py-1.5 text-sm'
      } ${className}`}
      aria-label={label}
      title={t('nav.creditsTitle', { defaultValue: 'Ver créditos na carteira' })}
    >
      <CreditsInline amount={balance} size={compact ? 14 : 16} className="font-semibold text-earth-900" />
      {compact ? null : (
        <span className="hidden text-xs font-medium text-earth-500 2xl:inline">
          {t('credits.unit', { defaultValue: 'créditos' })}
        </span>
      )}
    </LocalizedLink>
  )
}
