/**
 * Exibe a lista de produtos do orçamento quando orders.message contém dados estruturados.
 * A descrição do pedido (orderDescription) aparece no topo.
 */
import { useTranslation } from 'react-i18next'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { parseQuoteMessage } from '../lib/quoteProducts'
import { formatBrlForSite, formatJpyForSite } from '../lib/moneyDisplay'
import LinkifyText from './LinkifyText'
import {
  SERVICE_FEE_JPY_PER_ITEM,
  REDIR_ASSISTIDO_FEE_PERCENT,
  PERSONAL_SHOPPING_FEE_PERCENT,
} from '../data/serviceFees'

export default function QuoteProductsList({ message, quoteCurrency = 'JPY', formatMoney, orderModule = 'personal_shopping' }) {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const parsed = parseQuoteMessage(message)
  if (!parsed) {
    if (message?.trim()) {
      return (
        <p className="mt-1 text-sm text-earth-500 italic whitespace-pre-wrap">
          <LinkifyText text={message} />
        </p>
      )
    }
    return null
  }

  const { products, orderDescription } = parsed
  if (!products || products.length === 0) {
    if (orderDescription?.trim()) {
      return (
        <p className="mt-1 text-sm text-earth-500 italic whitespace-pre-wrap">
          <LinkifyText text={orderDescription} />
        </p>
      )
    }
    if (message?.trim()) {
      return (
        <p className="mt-1 text-sm text-earth-500 italic whitespace-pre-wrap">
          <LinkifyText text={message} />
        </p>
      )
    }
    return null
  }

  const baseTotal = products.reduce((s, p) => {
    const valor = Number(p.valor) || 0
    const qty = Math.max(1, parseInt(p.quantidade, 10) || 1)
    return s + valor * qty
  }, 0)

  const isAssistedBuy = orderModule === 'assisted_buy' || orderModule === 'redir-assistido'
  const servicePercent = isAssistedBuy ? REDIR_ASSISTIDO_FEE_PERCENT : PERSONAL_SHOPPING_FEE_PERCENT
  const totalItems = products.reduce((sum, p) => sum + Math.max(1, parseInt(p.quantidade, 10) || 1), 0)

  const serviceFeePercent = Math.round(baseTotal * (servicePercent / 100))
  const serviceFeeFixed = isAssistedBuy ? 0 : SERVICE_FEE_JPY_PER_ITEM * totalItems
  const grandTotal = baseTotal + serviceFeePercent + serviceFeeFixed

  const fmt = (v) => {
    if (formatMoney) return formatMoney(v, quoteCurrency)
    const c = String(quoteCurrency || 'JPY').toUpperCase()
    if (c === 'BRL') return formatBrlForSite(siteLocale, v)
    return formatJpyForSite(siteLocale, v, null)
  }

  return (
    <div className="mt-2 rounded-lg border border-earth-200 bg-white p-3">
      {orderDescription?.trim() && (
        <p className="mb-3 border-b border-earth-200 pb-3 text-sm text-earth-600 italic whitespace-pre-wrap">
          <LinkifyText text={orderDescription} />
        </p>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-600">
        {t('platform.quoteList.budgetItems')}
      </p>
      <ul className="space-y-2">
        {products.map((p, i) => {
          const valor = Number(p.valor) || 0
          const qty = Math.max(1, parseInt(p.quantidade, 10) || 1)
          const lineTotal = valor * qty
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-earth-800">
                {p.name || t('platform.quoteList.itemFallback', { n: i + 1 })}
                {qty > 1 && <span className="ml-1 font-normal text-earth-600">× {qty}</span>}
              </span>
              <span className="text-earth-700">{fmt(lineTotal)}</span>
              {p.descricao && (
                <span className="w-full text-xs text-earth-500 whitespace-pre-wrap">
                  <LinkifyText text={p.descricao} />
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 border-t border-earth-200 pt-3 text-sm">
        <div className="space-y-1 text-earth-600">
          <div className="flex justify-between">
            <span>{t('platform.quoteList.productBase')}</span>
            <span>{fmt(baseTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('platform.quoteList.serviceFeePercent', { percent: servicePercent })}</span>
            <span>{fmt(serviceFeePercent)}</span>
          </div>
          {!isAssistedBuy && (
            <div className="flex justify-between">
              <span>
                {t('platform.quoteList.perItemTimes', {
                  fee: fmt(SERVICE_FEE_JPY_PER_ITEM),
                  count: totalItems,
                })}
              </span>
              <span>{fmt(serviceFeeFixed)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-earth-900 pt-2 flex justify-between font-semibold text-earth-900">
          <span>{t('platform.quoteList.quoteTotal')}</span>
          <span>{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
