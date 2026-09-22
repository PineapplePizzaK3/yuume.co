import { Link } from 'react-router-dom'

export function LiveRipProductCard({ product, reserveHref, t }) {
  const hasShrinkPairPrices = Boolean(
    product?.shrinkwrapPrices?.with && product?.shrinkwrapPrices?.without
  )

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden bg-earth-200">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium text-earth-600">
            {t('liveRips.products.placeholder')}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {product.categoryLabel ? (
            <p className="inline-flex self-start rounded-full bg-earth-100 px-2.5 py-1 text-xs font-medium text-earth-700">
              {product.categoryLabel}
            </p>
          ) : null}
          {product.shrinkwrapOption && !hasShrinkPairPrices ? (
            <p
              className={`inline-flex self-start rounded-full px-2.5 py-1 text-xs font-semibold ${
                product.shrinkwrapOption === 'without'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {product.shrinkwrapOption === 'without'
                ? t('liveRips.products.shrinkWithout')
                : t('liveRips.products.shrinkWith')}
            </p>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold text-earth-900">{product.name}</h3>
        <dl className="mt-4 space-y-1 text-sm text-earth-600">
          <div className="flex items-center justify-between gap-3">
            <dt>{t('liveRips.products.type')}</dt>
            <dd className="font-medium text-earth-800">{product.type}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>{t('liveRips.products.language')}</dt>
            <dd className="font-medium text-earth-800">{product.language}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>{t('liveRips.products.price')}</dt>
            <dd className="font-semibold text-earth-900">
              {hasShrinkPairPrices ? product.shrinkwrapPrices.with : product.priceLabel}
            </dd>
          </div>
          {hasShrinkPairPrices ? (
            <div className="space-y-1.5 rounded-md border border-earth-200 bg-earth-50 px-2 py-1.5">
              <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-2 py-1.5 text-xs">
                <dt>{t('liveRips.products.shrinkWith')}</dt>
                <dd className="font-semibold text-emerald-900">{product.shrinkwrapPrices.with}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs">
                <dt>{t('liveRips.products.shrinkWithout')}</dt>
                <dd className="font-semibold text-amber-900">{product.shrinkwrapPrices.without}</dd>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt>{t('liveRips.products.availability')}</dt>
            <dd className="font-medium text-earth-800">
              {t('liveRips.products.availableCount', { count: product.availableRips })}
            </dd>
          </div>
        </dl>
        {product.source ? (
          <p className="mt-3 text-xs text-earth-500">
            {t('liveRips.products.sourceLabel', { source: product.source })}
          </p>
        ) : null}
        <Link
          to={reserveHref}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
        >
          {t('liveRips.products.reserveButton')}
        </Link>
      </div>
    </article>
  )
}
