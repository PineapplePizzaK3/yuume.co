import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import { LiveRipProductCard } from '../../components/live-rips/LiveRipProductCard'
import {
  getLiveRipProductName,
  LIVE_RIPS_LAST_UPDATED_AT,
  LIVE_RIPS_NEXT_LIVE,
  LIVE_RIPS_PRODUCT_CATEGORIES,
  LIVE_RIPS_SOURCE,
  getLiveRipProductsByCategory,
} from '../../data/liveRipsMock'
import { liveRipDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

const HUB_STEPS = ['concept', 'howItWorks', 'catalog']

function LiveRipsPage() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const [activeCategoryId, setActiveCategoryId] = useState(LIVE_RIPS_PRODUCT_CATEGORIES[0]?.id || '')
  const [cardZoomPercent, setCardZoomPercent] = useState(100)

  const categoryProducts = useMemo(
    () => getLiveRipProductsByCategory(activeCategoryId),
    [activeCategoryId]
  )

  const groupedProducts = useMemo(() => {
    const groups = new Map()
    categoryProducts.forEach((product) => {
      const key = String(product.collectionTitle || product.name || '').trim() || product.id
      const current = groups.get(key) || []
      current.push(product)
      groups.set(key, current)
    })

    const order = { with: 0, without: 1 }
    return [...groups.entries()]
      .map(([title, items]) => ({
        title,
        items: [...items].sort((a, b) => {
          const left = order[a.shrinkwrapOption] ?? 99
          const right = order[b.shrinkwrapOption] ?? 99
          if (left !== right) return left - right
          return (a.popularityRank || 9999) - (b.popularityRank || 9999)
        }),
        rank: Math.min(...items.map((item) => Number(item.popularityRank) || 9999)),
      }))
      .sort((a, b) => a.rank - b.rank)
  }, [categoryProducts])

  const updatedAtLabel = useMemo(() => {
    const date = new Date(LIVE_RIPS_LAST_UPDATED_AT)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(date)
  }, [locale])

  const cardZoom = useMemo(
    () => Math.max(85, Math.min(125, Number(cardZoomPercent) || 100)),
    [cardZoomPercent]
  )
  const cardScale = cardZoom / 100
  const displayProducts = useMemo(
    () =>
      groupedProducts.map((group) => {
        const withShrink = group.items.find((item) => item.shrinkwrapOption === 'with') || null
        const withoutShrink = group.items.find((item) => item.shrinkwrapOption === 'without') || null
        const fallbackProduct = group.items[0]
        const primaryProduct = withShrink || fallbackProduct
        const shrinkwrapPrices =
          withShrink && withoutShrink
            ? {
                with: withShrink.priceLabel,
                without: withoutShrink.priceLabel,
              }
            : null

        return {
          ...primaryProduct,
          id: primaryProduct.id,
          shrinkwrapPrices,
          availableRips: group.items.reduce(
            (acc, item) => acc + (Number.isFinite(item.availableRips) ? item.availableRips : 0),
            0
          ),
        }
      }),
    [groupedProducts]
  )
  const featuredProducts = useMemo(() => displayProducts.slice(0, 3), [displayProducts])
  const placeholderImage = (label, width = 640, height = 360) =>
    `https://placehold.co/${width}x${height}/E8E1D8/4B3A2A?text=${encodeURIComponent(label)}`

  return (
    <>
      <PageSeo
        routeKey="liveRipsHub"
        title={t('meta.liveRips.title')}
        description={t('meta.liveRips.description')}
        noindex
      />

      <section className="px-4 pb-8 pt-8 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">Live Rips</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
                  {t('liveRips.hero.title')}
                </h1>
                <p className="mt-4 max-w-2xl text-earth-600">{t('liveRips.hero.description')}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LocalizedLink
                    toRoute="liveRipsLive"
                    className="inline-flex items-center justify-center rounded-lg bg-earth-900 px-5 py-3 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
                  >
                    {t('liveRips.hero.cta')}
                  </LocalizedLink>
                  <LocalizedLink
                    toRoute="liveRipsMine"
                    className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                  >
                    {t('liveRips.hero.secondaryCta')}
                  </LocalizedLink>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-earth-200">
                <img
                  src={placeholderImage('Live Rip Hero')}
                  alt="Live Rip hero placeholder"
                  className="h-48 w-full object-cover sm:h-56"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-earth-200 bg-earth-100/70 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-earth-600">
            {t('liveRips.hubSteps.eyebrow')}
          </p>
          <div className="flex flex-col gap-2.5">
            {HUB_STEPS.map((step, index) => {
              return (
                <a
                  key={step}
                  href={`#live-rips-step-${step}`}
                  className="rounded-xl border border-earth-300 bg-white px-4 py-3 text-left text-earth-800 transition hover:border-earth-400 hover:bg-earth-50"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                    {t('liveRips.hubSteps.stepLabel', { number: index + 1 })}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{t(`liveRips.hubSteps.${step}.title`)}</p>
                  <p className="mt-1 text-xs text-earth-600">{t(`liveRips.hubSteps.${step}.description`)}</p>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <section id="live-rips-step-concept" className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-earth-900">{t('liveRips.hubSteps.concept.title')}</h2>
              <p className="mt-3 text-earth-700">{t('liveRips.hubSteps.concept.description')}</p>
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <img
                    src={placeholderImage(t('liveRips.hubSteps.concept.card1Title'), 800, 280)}
                    alt={t('liveRips.hubSteps.concept.card1Title')}
                    className="mb-3 h-24 w-full rounded-md object-cover"
                  />
                  <p className="font-semibold text-earth-900">{t('liveRips.hubSteps.concept.card1Title')}</p>
                  <p className="mt-1 text-sm text-earth-700">{t('liveRips.hubSteps.concept.card1Body')}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <img
                    src={placeholderImage(t('liveRips.hubSteps.concept.card2Title'), 800, 280)}
                    alt={t('liveRips.hubSteps.concept.card2Title')}
                    className="mb-3 h-24 w-full rounded-md object-cover"
                  />
                  <p className="font-semibold text-earth-900">{t('liveRips.hubSteps.concept.card2Title')}</p>
                  <p className="mt-1 text-sm text-earth-700">{t('liveRips.hubSteps.concept.card2Body')}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                  <img
                    src={placeholderImage(t('liveRips.hubSteps.concept.card3Title'), 800, 280)}
                    alt={t('liveRips.hubSteps.concept.card3Title')}
                    className="mb-3 h-24 w-full rounded-md object-cover"
                  />
                  <p className="font-semibold text-earth-900">{t('liveRips.hubSteps.concept.card3Title')}</p>
                  <p className="mt-1 text-sm text-earth-700">{t('liveRips.hubSteps.concept.card3Body')}</p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-earth-900">{t('liveRips.hubSteps.concept.featuredTitle')}</h3>
              <p className="mt-2 text-sm text-earth-600">{t('liveRips.hubSteps.concept.featuredDescription')}</p>
              <div className="mt-4 space-y-3">
                {featuredProducts.map((product) => (
                  <a
                    key={product.id}
                    href="#live-rips-step-catalog"
                    className="flex items-center gap-3 rounded-lg border border-earth-200 bg-earth-50 p-3 transition hover:border-earth-300 hover:bg-white"
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-earth-200">
                      <img
                        src={product.image || placeholderImage(getLiveRipProductName(product, locale), 320, 220)}
                        alt={getLiveRipProductName(product, locale)}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-earth-900">{getLiveRipProductName(product, locale)}</p>
                      <p className="text-xs text-earth-600">{product.priceLabel}</p>
                      <p className="text-xs text-earth-500">
                        {t('liveRips.products.availableCount', { count: product.availableRips })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="live-rips-step-howItWorks" className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-earth-900">{t('liveRips.hubSteps.howItWorks.heading')}</h2>
            <p className="mt-2 text-earth-600">{t('liveRips.hubSteps.howItWorks.lead')}</p>
            <ol className="mt-6 space-y-4">
              {['step1', 'step2', 'step3', 'step4'].map((stepKey, index) => (
                <li key={stepKey} className="flex gap-4">
                  <div className="flex w-9 flex-shrink-0 flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-900 text-sm font-semibold text-earth-50">
                      {index + 1}
                    </div>
                    {index < 3 ? <div className="mt-1 h-full w-px bg-earth-300" /> : null}
                  </div>
                  <div className="flex-1 rounded-lg border border-earth-200 bg-earth-50 p-4">
                    <img
                      src={placeholderImage(t(`liveRips.hubSteps.howItWorks.${stepKey}`), 960, 220)}
                      alt={t(`liveRips.hubSteps.howItWorks.${stepKey}`)}
                      className="mb-3 h-20 w-full rounded-md object-cover"
                    />
                    <p className="text-sm font-semibold text-earth-900">{t(`liveRips.hubSteps.howItWorks.${stepKey}`)}</p>
                    <p className="mt-1 text-sm text-earth-600">{t(`liveRips.hubSteps.howItWorks.${stepKey}Detail`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-earth-200 bg-earth-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-earth-900">{t('liveRips.hubSteps.trust.title')}</h2>
          <p className="mt-2 text-earth-600">{t('liveRips.hubSteps.trust.description')}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <img
                src={placeholderImage(t('liveRips.hubSteps.trust.card1Title'), 640, 280)}
                alt={t('liveRips.hubSteps.trust.card1Title')}
                className="mb-3 h-24 w-full rounded-md object-cover"
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">{t('liveRips.hubSteps.trust.card1Eyebrow')}</p>
              <h3 className="mt-2 font-bold text-earth-900">{t('liveRips.hubSteps.trust.card1Title')}</h3>
              <p className="mt-2 text-sm text-earth-700">{t('liveRips.hubSteps.trust.card1Body')}</p>
            </article>
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <img
                src={placeholderImage(t('liveRips.hubSteps.trust.card2Title'), 640, 280)}
                alt={t('liveRips.hubSteps.trust.card2Title')}
                className="mb-3 h-24 w-full rounded-md object-cover"
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">{t('liveRips.hubSteps.trust.card2Eyebrow')}</p>
              <h3 className="mt-2 font-bold text-earth-900">{t('liveRips.hubSteps.trust.card2Title')}</h3>
              <p className="mt-2 text-sm text-earth-700">{t('liveRips.hubSteps.trust.card2Body')}</p>
            </article>
            <article className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
              <img
                src={placeholderImage(t('liveRips.hubSteps.trust.card3Title'), 640, 280)}
                alt={t('liveRips.hubSteps.trust.card3Title')}
                className="mb-3 h-24 w-full rounded-md object-cover"
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">{t('liveRips.hubSteps.trust.card3Eyebrow')}</p>
              <h3 className="mt-2 font-bold text-earth-900">{t('liveRips.hubSteps.trust.card3Title')}</h3>
              <p className="mt-2 text-sm text-earth-700">{t('liveRips.hubSteps.trust.card3Body')}</p>
            </article>
          </div>
        </div>
      </section>

      <>
          <section id="live-rips-step-catalog" className="border-t border-earth-200 bg-earth-50 px-4 py-12">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-bold text-earth-900">{t('liveRips.nextLive.title')}</h2>
              <div className="mt-6 rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-earth-900">{LIVE_RIPS_NEXT_LIVE.title}</h3>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.nextLive.date')}</dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">
                      {LIVE_RIPS_NEXT_LIVE.dateLabel[locale]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.nextLive.time')}</dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">{LIVE_RIPS_NEXT_LIVE.timeLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.nextLive.status')}</dt>
                    <dd className="mt-1 text-sm font-medium text-earth-900">
                      {t('liveRips.nextLive.availableCount', { count: LIVE_RIPS_NEXT_LIVE.availableRips })}
                    </dd>
                  </div>
                  <div className="flex items-end">
                    <a
                      href="#live-rips-products"
                      className="inline-flex items-center justify-center rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                    >
                      {t('liveRips.nextLive.productsButton')}
                    </a>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section id="live-rips-products" className="border-t border-earth-200 px-4 py-12">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-earth-900">{t('liveRips.products.title')}</h2>
                <p className="mt-2 text-earth-600">{t('liveRips.products.description')}</p>
                <p className="mt-2 text-xs text-earth-500">
                  {t('liveRips.products.snapshotInfo', {
                    source: LIVE_RIPS_SOURCE.name,
                    categoryPath: LIVE_RIPS_SOURCE.categoryPath,
                    updatedAt: updatedAtLabel,
                  })}
                </p>
              </div>

              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-500">
                  {t('liveRips.products.categoriesTitle')}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {LIVE_RIPS_PRODUCT_CATEGORIES.map((category) => {
                    const isActive = category.id === activeCategoryId
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setActiveCategoryId(category.id)}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          isActive
                            ? 'border-earth-900 bg-earth-900 text-earth-50'
                            : 'border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                        }`}
                      >
                        {category.label[locale]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mb-6 rounded-lg border border-earth-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="live-rips-card-zoom" className="text-sm font-medium text-earth-800">
                    {t('liveRips.products.cardSizeLabel')}
                  </label>
                  <input
                    id="live-rips-card-zoom"
                    type="range"
                    min="85"
                    max="125"
                    step="5"
                    value={cardZoom}
                    onChange={(event) => setCardZoomPercent(Number(event.target.value))}
                    className="h-2 w-56 cursor-pointer appearance-none rounded-lg bg-earth-200"
                  />
                  <span className="rounded-md bg-earth-100 px-2 py-1 text-xs font-semibold text-earth-700">
                    {cardZoom}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-earth-600">{t('liveRips.products.cardSizeHint')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {displayProducts.map((product) => (
                  <div
                    key={product.id}
                    className="origin-top-left"
                    style={{ transform: `scale(${cardScale})`, width: `${100 / cardScale}%` }}
                  >
                    <LiveRipProductCard
                      product={{
                        ...product,
                        name: getLiveRipProductName(product, locale),
                        categoryLabel:
                          LIVE_RIPS_PRODUCT_CATEGORIES.find((category) => category.id === product.categoryId)?.label?.[
                            locale
                          ] || '',
                        type: product.type[locale],
                        language: product.language[locale],
                      }}
                      reserveHref={liveRipDetailPath(product.id, locale)}
                      t={t}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
      </>
    </>
  )
}

export default LiveRipsPage
