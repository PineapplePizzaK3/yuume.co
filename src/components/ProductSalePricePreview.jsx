import { useMemo } from 'react'
import { formatBRL, formatJPY, formatUSD } from '../lib/fx'
import {
  computeProductSalePrice,
  SALE_CHANNEL_GRUPO,
  SALE_CHANNEL_STORE,
} from '../lib/productSalePrice'
import { GRUPO_COMPRAS_FEE_PERCENT, GRUPO_COMPRAS_FEE_PER_UNIT_USD } from '../data/serviceFees'
import { useExchangeRates } from '../hooks/useExchangeRates'

/**
 * Preview admin: preço de venda unitário em BRL com taxas embutidas.
 */
export default function ProductSalePricePreview({
  priceJpy,
  channel = SALE_CHANNEL_STORE,
  quantity = 1,
}) {
  const { rates, loading, error } = useExchangeRates()
  const jpy = Number(priceJpy) || 0

  const sale = useMemo(() => {
    if (jpy <= 0 || !rates) return null
    return computeProductSalePrice({
      priceJpy: jpy,
      channel: channel === SALE_CHANNEL_GRUPO ? SALE_CHANNEL_GRUPO : SALE_CHANNEL_STORE,
      quantity,
      rates,
    })
  }, [jpy, channel, quantity, rates])

  if (jpy <= 0) return null

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">
      <p className="font-semibold">
        Preço de venda (cliente):{' '}
        {loading && !sale ? '…' : sale ? formatBRL(sale.unitSaleBrl) : '—'}
      </p>
      {sale ? (
        <ul className="mt-1 space-y-0.5 text-xs text-emerald-900/90">
          <li>
            Base: {formatJPY(jpy)} → {formatUSD(sale.priceUsd)} → {formatBRL(sale.priceBrl)}
          </li>
          <li>
            Câmbio com markup Wise ({sale.rates.wiseMarkupPercent}%):{' '}
            {formatBRL(sale.priceBrl)} / un.
          </li>
          {channel === SALE_CHANNEL_GRUPO ? (
            <li>
              + Taxa grupo ({GRUPO_COMPRAS_FEE_PERCENT}% + US${' '}
              {sale.rates.grupoFeePerUnitUsd ?? GRUPO_COMPRAS_FEE_PER_UNIT_USD}/un.) embutida
            </li>
          ) : null}
          <li className="text-emerald-800/80">Frete internacional não incluído.</li>
        </ul>
      ) : null}
      {error && !sale ? (
        <p className="mt-1 text-xs text-amber-800">{error}</p>
      ) : null}
    </div>
  )
}
