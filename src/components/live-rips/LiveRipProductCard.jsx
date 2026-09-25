import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TriCurrencyDisplay } from '../TriCurrencyDisplay'
import { useExchangeRates } from '../../hooks/useExchangeRates'
import { computeProductSalePrice, SALE_CHANNEL_STORE } from '../../lib/productSalePrice'
import { LiveRipJpVersionBadge } from './LiveRipJpVersionBadge'

function resolveProductYen(product) {
  const yen = Number(product?.priceYen ?? product?.priceJpy ?? 0)
  return Number.isFinite(yen) && yen > 0 ? yen : 0
}

export function LiveRipPriceBlock({ yen, rates, variant = 'compact' }) {
  const sale = useMemo(() => {
    if (!(yen > 0) || !rates) return null
    return computeProductSalePrice({
      priceJpy: yen,
      channel: SALE_CHANNEL_STORE,
      rates,
    })
  }, [yen, rates])

  if (!(yen > 0)) return <span className="font-semibold text-earth-900">—</span>

  return (
    <TriCurrencyDisplay
      jpy={yen}
      brl={sale?.unitSaleBrl || 0}
      usd={sale?.priceUsd ?? sale?.unitSaleUsd ?? 0}
      variant={variant}
      primary="jpy"
    />
  )
}

export function LiveRipProductCard({ product, reserveHref, t }) {
  const { rates } = useExchangeRates()
  const hasShrinkPairPrices = Boolean(
    product?.shrinkwrapPrices?.withYen > 0 && product?.shrinkwrapPrices?.withoutYen > 0
  )
  const primaryYen = hasShrinkPairPrices
    ? Number(product.shrinkwrapPrices.withYen)
    : resolveProductYen(product)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-earth-200">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium text-earth-600">
            {t('liveRips.products.placeholder')}
          </div>
        )}
        <LiveRipJpVersionBadge size={24} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-snug text-earth-900 sm:text-lg">{product.name}</h3>
        <div className="mt-3">
          {hasShrinkPairPrices ? (
            <div className="space-y-1.5">
              <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs">
                <p className="font-medium text-emerald-900">{t('liveRips.products.shrinkWith')}</p>
                <div className="mt-1">
                  <LiveRipPriceBlock yen={Number(product.shrinkwrapPrices.withYen)} rates={rates} />
                </div>
              </div>
              <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs">
                <p className="font-medium text-amber-900">{t('liveRips.products.shrinkWithout')}</p>
                <div className="mt-1">
                  <LiveRipPriceBlock yen={Number(product.shrinkwrapPrices.withoutYen)} rates={rates} />
                </div>
              </div>
            </div>
          ) : (
            <LiveRipPriceBlock yen={primaryYen} rates={rates} />
          )}
        </div>
        <Link
          to={reserveHref}
          className="mt-auto inline-flex items-center justify-center rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 transition hover:bg-earth-800 pt-4"
        >
          {t('liveRips.products.reserveButton')}
        </Link>
      </div>
    </article>
  )
}
