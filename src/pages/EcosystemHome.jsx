import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../components/PageSeo'
import { LocalizedLink } from '../components/LocalizedLink'
import { BoxBreakCategoryLanes } from '../components/collector/BoxBreakCategoryLanes'
import { VisualEmptyState } from '../components/VisualEmptyState'
import { getProductImages, ProductPriceBlock } from '../components/StoreProductDisplay'
import { CATALOG_STORE_OPTIONS, catalogStoreBrand } from '../components/CatalogSearchPanel'
import { useAuth } from '../hooks/useAuth'
import { useCollectorFlags } from '../hooks/useCollectorFlags'
import { useSiteLocale } from '../hooks/useSiteLocale'
import {
  appStoreProductPath,
  localizedPath,
  publicStoreProductPath,
} from '../lib/localeRoutes'
import { pageShell } from '../lib/layout'
import { listOpeningBatches } from '../services/collectorService'
import { getProducts } from '../services/productService'
import {
  HomeIconBadge,
  IconBag,
  IconBookmark,
  IconCalc,
  IconCards,
  IconChat,
  IconCheckList,
  IconHeart,
  IconJapan,
  IconLayers,
  IconPackage,
  IconPin,
  IconRoute,
  IconSearch,
  IconTag,
  IconUser,
  IconWay,
} from '../components/home/HomeSectionIcons'

const CARD_LINK =
  'group flex h-full min-h-[10.5rem] flex-col rounded-2xl border border-earth-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md'

const BUY_LOOKS = [
  { id: 'tcg', image: '/home/tcg-1-japanese-booster-boxes-WLC.png' },
  { id: 'anime', image: '/home/anime-1-figures.png' },
  { id: 'usados', image: '/home/usados-1.jpg' },
  { id: 'stationery', image: '/home/stationery-1-upload.png' },
  { id: 'cosmeticos', image: '/home/cosmeticos-1-comesticos.png' },
]

const AFTER_CARDS = [
  { id: 'collection', toRoute: 'collectorCollection', titleKey: 'afterCollection', bodyKey: 'afterCollectionBody', Icon: IconHeart },
  { id: 'wishlist', toRoute: 'collectorWishlist', titleKey: 'afterWishlist', bodyKey: 'afterWishlistBody', Icon: IconBookmark },
  { id: 'holdings', toRoute: 'appLounge', titleKey: 'afterHoldings', bodyKey: 'afterHoldingsBody', Icon: IconPackage },
  { id: 'shipments', toRoute: 'appLounge', search: '?tab=envios', titleKey: 'afterShipments', bodyKey: 'afterShipmentsBody', Icon: IconRoute },
]

const CYCLE_STEPS = [
  { id: 'find', n: '1', toRoute: 'catalogSearchPublic', titleKey: 'cycle1Title', bodyKey: 'cycle1Body', Icon: IconSearch },
  { id: 'buy', n: '2', toRoute: 'forwardingHome', titleKey: 'cycle2Title', bodyKey: 'cycle2Body', Icon: IconBag },
  { id: 'ship', n: '3', toRoute: 'appLounge', search: '?tab=envios', titleKey: 'cycle3Title', bodyKey: 'cycle3Body', Icon: IconPackage },
  { id: 'own', n: '4', toRoute: 'collectorCollection', titleKey: 'cycle4Title', bodyKey: 'cycle4Body', Icon: IconCheckList },
]

const START_ACTIONS = [
  {
    id: 'account',
    guestToRoute: 'register',
    authToRoute: 'minhaYuume',
    titleKey: 'startAccountTitle',
    bodyKey: 'startAccountBody',
    ctaKey: 'startAccountCta',
    ctaSignedInKey: 'startAccountCtaSignedIn',
    Icon: IconUser,
  },
  {
    id: 'find',
    href: '#busca',
    titleKey: 'startFindTitle',
    bodyKey: 'startFindBody',
    ctaKey: 'startFindCta',
    Icon: IconSearch,
  },
  {
    id: 'service',
    toRoute: 'servicosPrecos',
    titleKey: 'startServiceTitle',
    bodyKey: 'startServiceBody',
    ctaKey: 'startServiceCta',
    Icon: IconLayers,
  },
  {
    id: 'quote',
    toRoute: 'servicosSimulador',
    titleKey: 'startQuoteTitle',
    bodyKey: 'startQuoteBody',
    ctaKey: 'startQuoteCta',
    Icon: IconCalc,
  },
]

const CONCEPT_POINTS = [
  { id: 'japan', titleKey: 'conceptJapanTitle', bodyKey: 'conceptJapanBody', Icon: IconJapan },
  { id: 'way', titleKey: 'conceptWayTitle', bodyKey: 'conceptWayBody', Icon: IconWay },
  { id: 'collection', titleKey: 'conceptCollectionTitle', bodyKey: 'conceptCollectionBody', Icon: IconCards },
]

const TRUST_CARDS = [
  { id: 'address', titleKey: 'trustAddressTitle', bodyKey: 'trustAddressBody', Icon: IconPin },
  { id: 'lang', titleKey: 'trustLangTitle', bodyKey: 'trustLangBody', Icon: IconChat },
  {
    id: 'price',
    titleKey: 'trustPriceTitle',
    bodyKey: 'trustPriceBody',
    toRoute: 'servicosSimulador',
    ctaKey: 'trustPriceCta',
    Icon: IconTag,
  },
  {
    id: 'track',
    titleKey: 'trustTrackTitle',
    bodyKey: 'trustTrackBody',
    toRoute: 'faqIndex',
    ctaKey: 'trustFaqCta',
    Icon: IconRoute,
  },
]

function productHasPrice(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const variantPrice = variants.some((v) => {
    const n = Number(v?.price_jpy)
    return Number.isFinite(n) && n > 0
  })
  const jpy = Number(product?.price_jpy ?? product?.price) || 0
  const brl = Number(product?.price_brl) || 0
  return variantPrice || jpy > 0 || brl > 0
}

function EcosystemHome() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { openings: openingsEnabled } = useCollectorFlags()
  const showOpenings = openingsEnabled
  const locale = useSiteLocale()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [catalogQuery, setCatalogQuery] = useState('')

  useEffect(() => {
    let active = true
    void getProducts().then((res) => {
      if (!active) return
      setProducts(Array.isArray(res?.data) ? res.data.slice(0, 4) : [])
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!showOpenings) return undefined
    let active = true
    void listOpeningBatches().then((res) => {
      if (!active) return
      setBatches(Array.isArray(res?.data) ? res.data : [])
    })
    return () => {
      active = false
    }
  }, [showOpenings])

  const handleCatalogSearch = (event) => {
    event.preventDefault()
    const q = catalogQuery.trim()
    const queryString = q ? `?catalogQuery=${encodeURIComponent(q)}` : ''
    navigate(localizedPath('catalogSearchPublic', locale, queryString))
  }

  const scrollToSearch = (event) => {
    event.preventDefault()
    const section = document.getElementById('busca')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section?.querySelector('input[type="search"]')?.focus()
  }

  const openStoreSearch = (storeId) => {
    navigate(localizedPath('catalogSearchPublic', locale, `?catalogStore=${encodeURIComponent(storeId)}`))
  }

  return (
    <>
      <PageSeo
        routeKey="home"
        title={t('meta.home.title')}
        description={t('meta.home.description')}
      />

      <section className="px-4 pb-10 pt-24">
        <div className={pageShell}>
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('home.ecosystem.eyebrow')}
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-earth-900 sm:text-5xl">
                {t('home.ecosystem.heroTitle')}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-earth-600">
                {t('home.ecosystem.subtitle')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#busca"
                  onClick={scrollToSearch}
                  className="inline-flex rounded-lg bg-earth-900 px-5 py-3 text-sm font-medium text-earth-50 hover:bg-earth-800"
                >
                  {t('home.hierarchy.ctaSearch')}
                </a>
                <LocalizedLink
                  toRoute={isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'}
                  className="inline-flex rounded-lg border border-earth-300 bg-white px-5 py-3 text-sm font-medium text-earth-800 hover:bg-earth-50"
                >
                  {t('home.hierarchy.ctaProducts')}
                </LocalizedLink>
                {showOpenings ? (
                  <LocalizedLink
                    toRoute="collectorBatches"
                    className="inline-flex px-2 py-3 text-sm font-medium text-earth-700 underline-offset-4 hover:underline"
                  >
                    {t('home.hierarchy.ctaOpenings')}
                  </LocalizedLink>
                ) : null}
                <LocalizedLink
                  toRoute="forwardingHome"
                  className="inline-flex px-2 py-3 text-sm font-medium text-earth-700 underline-offset-4 hover:underline"
                >
                  {t('home.hierarchy.ctaServices')}
                </LocalizedLink>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src="/voando.png?v=2"
                alt={t('home.heroImgAlt')}
                className="w-full max-w-md animate-voar object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-earth-50 px-4 py-12 sm:py-16">
        <div className={pageShell}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                {t('home.ecosystem.conceptEyebrow')}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-earth-900 sm:text-3xl">
                {t('home.ecosystem.conceptTitle')}
              </h2>
              <p className="mt-3 max-w-xl text-earth-600">
                {t('home.ecosystem.conceptLead')}
              </p>
              <p className="mt-4 text-sm font-medium text-earth-800">
                {t('home.ecosystem.conceptName')}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {CONCEPT_POINTS.map((point) => {
                const PointIcon = point.Icon
                return (
                  <li
                    key={point.id}
                    className="group rounded-2xl border border-earth-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md"
                  >
                    <HomeIconBadge>
                      <PointIcon />
                    </HomeIconBadge>
                    <h3 className="font-display text-base font-semibold text-earth-900">
                      {t(`home.ecosystem.${point.titleKey}`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-earth-600">
                      {t(`home.ecosystem.${point.bodyKey}`)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      <section id="busca" className="scroll-mt-24 border-t border-earth-200 bg-white px-4 py-12 sm:py-16">
        <div className={pageShell}>
          <h2 className="font-display text-2xl font-semibold text-earth-900">
            {t('home.hierarchy.searchTitle')}
          </h2>
          <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.searchSubtitle')}</p>
          <form
            onSubmit={handleCatalogSearch}
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch"
            aria-label={t('home.hierarchy.searchAria')}
          >
            <input
              type="search"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder={t('home.hierarchy.searchPlaceholder')}
              className="h-12 min-w-0 flex-1 rounded-lg border border-earth-300 bg-earth-50 px-4 text-sm text-earth-900 placeholder:text-earth-400 focus:border-earth-800 focus:outline-none focus:ring-2 focus:ring-earth-200"
            />
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-earth-900 px-6 text-sm font-medium text-earth-50 hover:bg-earth-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {t('home.hierarchy.searchCta')}
            </button>
          </form>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CATALOG_STORE_OPTIONS.map((store) => {
              const brand = catalogStoreBrand(store.id)
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    onClick={() => openStoreSearch(store.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-earth-200 bg-earth-50 px-3 py-1 text-xs font-medium text-earth-700 transition hover:border-earth-400 hover:bg-white"
                  >
                    {brand.logo ? (
                      <img src={brand.logo} alt="" className="h-3.5 w-3.5 rounded-sm" />
                    ) : null}
                    {store.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-earth-200 px-4 py-16">
        <div className={pageShell}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-earth-900">
                {t('home.buyTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-earth-600">{t('home.buySubtitle')}</p>
            </div>
            <LocalizedLink toRoute="ondeComprar" className="text-sm font-medium text-earth-900 hover:underline">
              {t('home.guideWhereCta')}
            </LocalizedLink>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BUY_LOOKS.map((look) => (
              <li key={look.id} className="min-w-0">
                <LocalizedLink
                  toRoute="ondeComprar"
                  search={`?categoria=${encodeURIComponent(look.id)}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-earth-400 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-earth-100">
                    <img
                      src={look.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-sm font-semibold text-earth-900">
                      {t(`home.quickAccess.${look.id}.title`)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-earth-600">
                      {t(`home.quickAccess.${look.id}.desc`)}
                    </p>
                  </div>
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
        <div className={pageShell}>
          <h2 className="font-display text-2xl font-semibold text-earth-900">
            {t('home.hierarchy.cycleTitle')}
          </h2>
          <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.cycleSubtitle')}</p>
          <ol className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CYCLE_STEPS.map((step) => {
              const StepIcon = step.Icon
              return (
                <li key={step.id} className="min-w-0">
                  <LocalizedLink
                    toRoute={step.toRoute}
                    search={step.search}
                    className={`${CARD_LINK} bg-white`}
                  >
                    <div className="flex items-center justify-between">
                      <HomeIconBadge>
                        <StepIcon />
                      </HomeIconBadge>
                      <span className="text-xs font-semibold tabular-nums text-earth-400">
                        {step.n}
                      </span>
                    </div>
                    <h3 className="mt-1 line-clamp-2 font-display text-lg font-semibold text-earth-900">
                      {t(`home.hierarchy.${step.titleKey}`)}
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-earth-600">
                      {t(`home.hierarchy.${step.bodyKey}`)}
                    </p>
                  </LocalizedLink>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-white px-4 py-16">
        <div className={pageShell}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-earth-900">
                {t('home.hierarchy.startHereTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.startHereSubtitle')}</p>
            </div>
            <LocalizedLink toRoute="forwardingHome" className="text-sm font-medium text-earth-900 hover:underline">
              {t('home.hierarchy.ctaServices')} →
            </LocalizedLink>
          </div>
          <ul className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {START_ACTIONS.map((action) => {
              const toRoute = action.authToRoute
                ? isAuthenticated
                  ? action.authToRoute
                  : action.guestToRoute
                : action.toRoute
              const cta = action.ctaSignedInKey && isAuthenticated
                ? t(`home.hierarchy.${action.ctaSignedInKey}`)
                : t(`home.hierarchy.${action.ctaKey}`)
              const ActionIcon = action.Icon
              const inner = (
                <>
                  <HomeIconBadge>
                    <ActionIcon />
                  </HomeIconBadge>
                  <h3 className="line-clamp-2 font-display text-lg font-semibold text-earth-900">
                    {t(`home.hierarchy.${action.titleKey}`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-earth-600">
                    {t(`home.hierarchy.${action.bodyKey}`)}
                  </p>
                  <span className="mt-4 text-sm font-medium text-earth-900">{cta} →</span>
                </>
              )
              const className = `${CARD_LINK} bg-earth-50`
              if (action.href) {
                return (
                  <li key={action.id} className="min-w-0">
                    <a href={action.href} onClick={scrollToSearch} className={className}>
                      {inner}
                    </a>
                  </li>
                )
              }
              return (
                <li key={action.id} className="min-w-0">
                  <LocalizedLink toRoute={toRoute} className={className}>
                    {inner}
                  </LocalizedLink>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-earth-200 px-4 py-16">
        <div className={pageShell}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-earth-900">
                {t('home.hierarchy.productsTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.productsSubtitle')}</p>
            </div>
            <LocalizedLink
              toRoute={isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'}
              className="text-sm font-medium text-earth-900 hover:underline"
            >
              {t('home.hierarchy.ctaProducts')} →
            </LocalizedLink>
          </div>
          {products.length ? (
            <ul className="mt-8 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => {
                const image = getProductImages(product)[0] || '/logo.png'
                const href = isAuthenticated
                  ? appStoreProductPath(product.id, locale)
                  : publicStoreProductPath(product.id, locale)
                return (
                  <li key={product.id} className="min-w-0">
                    <Link
                      to={href}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md"
                    >
                      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-earth-100">
                        <img
                          src={image}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="line-clamp-2 font-medium leading-snug text-earth-900">{product.name}</h3>
                        {productHasPrice(product) ? <ProductPriceBlock product={product} /> : null}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-8 overflow-hidden rounded-2xl border border-earth-200 bg-earth-50">
              <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
                <div className="aspect-[4/3] bg-earth-100 sm:aspect-auto">
                  <img
                    src="/home/anime-1-figures.png"
                    alt=""
                    className="h-full min-h-[12rem] w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center p-6">
                  <HomeIconBadge>
                    <IconBag />
                  </HomeIconBadge>
                  <p className="font-display text-lg font-semibold text-earth-900">
                    {t('home.hierarchy.productsEmpty')}
                  </p>
                  <p className="mt-2 text-sm text-earth-600">{t('home.hierarchy.productsEmptyHint')}</p>
                  <LocalizedLink
                    toRoute={isAuthenticated ? 'appLoja' : 'lojaPublicVitrine'}
                    className="mt-4 inline-flex w-fit rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
                  >
                    {t('home.hierarchy.productsEmptyCta')}
                  </LocalizedLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {showOpenings ? (
        <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
          <div className={pageShell}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-earth-900">
                  {t('home.hierarchy.openingsTitle')}
                </h2>
                <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.openingsSubtitle')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LocalizedLink
                  toRoute="collectorBatches"
                  className="text-sm font-medium text-earth-900 hover:underline"
                >
                  {t('home.hierarchy.ctaOpenings')} →
                </LocalizedLink>
                <LocalizedLink
                  toRoute="liveRipsHub"
                  className="text-sm text-earth-600 hover:underline"
                >
                  {t('home.hierarchy.openingsLiveCta')}
                </LocalizedLink>
              </div>
            </div>
            {batches.length ? (
              <div className="mt-8">
                <BoxBreakCategoryLanes batches={batches} compact />
              </div>
            ) : (
              <VisualEmptyState
                image="/collector/openings-hero.png"
                icon={IconCards}
                title={t('home.hierarchy.openingsEmpty')}
                hint={t('home.hierarchy.openingsEmptyHint')}
                toRoute="collectorBatches"
                cta={t('home.hierarchy.ctaOpenings')}
              />
            )}
          </div>
        </section>
      ) : null}

      <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
        <div className={pageShell}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-earth-900">
                {t('home.hierarchy.afterTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.afterSubtitle')}</p>
            </div>
            <LocalizedLink toRoute="minhaYuume" className="text-sm font-medium text-earth-900 hover:underline">
              {t('home.hierarchy.ctaMyYuume')} →
            </LocalizedLink>
          </div>
          <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AFTER_CARDS.map((card) => {
              const CardIcon = card.Icon
              return (
                <LocalizedLink
                  key={card.id}
                  toRoute={card.toRoute}
                  search={card.search}
                  className={`${CARD_LINK} bg-white`}
                >
                  <HomeIconBadge>
                    <CardIcon />
                  </HomeIconBadge>
                  <h3 className="line-clamp-2 font-display text-lg font-semibold text-earth-900">
                    {t(`home.hierarchy.${card.titleKey}`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-earth-600">
                    {t(`home.hierarchy.${card.bodyKey}`)}
                  </p>
                </LocalizedLink>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-white px-4 py-16">
        <div className={pageShell}>
          <h2 className="font-display text-2xl font-semibold text-earth-900">
            {t('home.hierarchy.trustTitle')}
          </h2>
          <p className="mt-2 max-w-2xl text-earth-600">{t('home.hierarchy.trustSubtitle')}</p>
          <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_CARDS.map((card) => {
              const TrustIcon = card.Icon
              const inner = (
                <>
                  <HomeIconBadge>
                    <TrustIcon />
                  </HomeIconBadge>
                  <h3 className="line-clamp-2 font-display text-lg font-semibold text-earth-900">
                    {t(`home.hierarchy.${card.titleKey}`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-earth-600">
                    {t(`home.hierarchy.${card.bodyKey}`)}
                  </p>
                  {card.ctaKey ? (
                    <span className="mt-4 text-sm font-medium text-earth-900">
                      {t(`home.hierarchy.${card.ctaKey}`)} →
                    </span>
                  ) : null}
                </>
              )
              const className = `${CARD_LINK} bg-earth-50`
              if (card.toRoute) {
                return (
                  <LocalizedLink
                    key={card.id}
                    toRoute={card.toRoute}
                    className={className}
                  >
                    {inner}
                  </LocalizedLink>
                )
              }
              return (
                <div key={card.id} className={className}>
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-earth-200 bg-earth-900 px-4 py-16">
        <div className={`${pageShell} flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="font-display text-2xl font-semibold text-earth-50">
              {t('home.hierarchy.closeTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-earth-200">{t('home.hierarchy.closeSubtitle')}</p>
          </div>
          <LocalizedLink
            toRoute={isAuthenticated ? 'minhaYuume' : 'register'}
            className="inline-flex shrink-0 rounded-lg bg-earth-50 px-5 py-3 text-sm font-medium text-earth-900 hover:bg-white"
          >
            {isAuthenticated ? t('home.hierarchy.closeCtaSignedIn') : t('home.hierarchy.closeCta')}
          </LocalizedLink>
        </div>
      </section>
    </>
  )
}

export default EcosystemHome
