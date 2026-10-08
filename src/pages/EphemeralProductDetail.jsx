import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../components/PageSeo'
import { TriCurrencyDisplay } from '../components/TriCurrencyDisplay'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { useAuth } from '../hooks/useAuth'
import { useExchangeRates } from '../hooks/useExchangeRates'
import { LOCALE_EN, localizedPath, publicEphemeralProductPath } from '../lib/localeRoutes'
import { computeProductSalePrice, SALE_CHANNEL_STORE } from '../lib/productSalePrice'
import ImageLightbox from '../components/ImageLightbox'
import { fetchCatalogProductGallery } from '../services/catalogSearchService'
import EphemeralListingRecommendations from '../components/EphemeralListingRecommendations'
import { addEphemeralToCart } from '../services/cartService'
import {
  createEphemeralProductSnapshot,
  getPublicEphemeralProduct,
  updateEphemeralProductImages,
} from '../services/ephemeralProductService'
import { listingFromCatalogHit, listingFromEphemeralRow, listingFromIndexRow } from '../lib/ephemeralListing'
import { clearEphemeralOpenPayload, ephemeralOpenSid } from '../lib/ephemeralOpenSession'
import { displayListingImages, filterOwnedListingImages, filterTrustedGalleryImages, hasEnoughOwnedListingPhotos } from '../lib/listingImages'

function uniqueImageUrls(values) {
  const out = []
  const seen = new Set()
  const list = Array.isArray(values) ? values : []
  for (const value of list) {
    const url = String(value || '').trim()
    if (!url || !/^https?:\/\//i.test(url)) continue
    if (/(null|undefined|about:blank)$/i.test(url)) continue
    if (/(placeholder|no[_-]?image|blank|spacer|pixel|1x1|clear\.gif|transparent|spaceball)/i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function resolveSeedListing(seedHit, locationState) {
  return (
    listingFromCatalogHit(seedHit)
    || listingFromIndexRow(seedHit)
    || listingFromEphemeralRow(seedHit)
    || listingFromCatalogHit(locationState?.listing)
    || listingFromIndexRow(locationState?.listing)
    || listingFromEphemeralRow(locationState?.listing)
    || null
  )
}

export default function EphemeralProductDetail({ seedHit = null, promoteUrl = false }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const locale = useSiteLocale()
  const isEn = locale === LOCALE_EN
  const { user } = useAuth()
  const { token } = useParams()
  const seedListing = useMemo(
    () => resolveSeedListing(seedHit, location.state),
    [seedHit, location.state],
  )
  const [loading, setLoading] = useState(() => !seedListing && Boolean(token))
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [product, setProduct] = useState(() => seedListing)
  const [imageIndex, setImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const snapshotPromiseRef = useRef(null)
  const { rates: pricingRates, loading: ratesLoading } = useExchangeRates()

  const trackEphemeralEvent = (eventName, payload = {}) => {
    const safePayload = { area: 'ephemeral-product', eventName, ...payload }
    if (typeof window !== 'undefined') {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'ephemeral_product', safePayload)
      }
      if (typeof window.plausible === 'function') {
        window.plausible('ephemeral_product', { props: safePayload })
      }
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (seedListing && !token) {
        setProduct(seedListing)
        setLoading(false)
        setError('')
        trackEphemeralEvent('page_open', { source: seedListing.source, storeId: seedListing.store_id })
        return
      }
      if (!token) {
        if (!seedListing) {
          setLoading(false)
          setError(
            isEn
              ? 'This temporary product is unavailable or expired.'
              : 'Este produto temporario esta indisponivel ou expirou.',
          )
        }
        return
      }
      if (!seedListing) setLoading(true)
      setError('')
      const { data, error: rpcError } = await getPublicEphemeralProduct(token)
      if (!active) return
      if (rpcError || !data) {
        if (!seedListing) {
          setProduct(null)
          setError(
            rpcError?.message
              || (isEn
                ? 'This temporary product is unavailable or expired.'
                : 'Este produto temporario esta indisponivel ou expirou.')
          )
        }
      } else {
        const row = listingFromEphemeralRow(data)
        setProduct((prev) => {
          if (!prev) return row
          const cover = prev.image_url || row.image_url
          const productUrl = prev.external_url || row.external_url
          const images = filterOwnedListingImages(
            productUrl,
            [
              ...(Array.isArray(prev.image_urls) ? prev.image_urls : []),
              ...(Array.isArray(row.image_urls) ? row.image_urls : []),
              cover,
            ],
            cover,
          )
          return {
            ...prev,
            ...row,
            image_url: images[0] || cover,
            image_urls: images,
          }
        })
        trackEphemeralEvent('page_open', { token: data.token, storeId: data.store_id })
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [token, isEn, seedListing])

  const ensureSnapshot = async (listing) => {
    if (listing?.token) return { data: { token: listing.token, expires_at: listing.expires_at }, error: null }
    if (snapshotPromiseRef.current) return snapshotPromiseRef.current
    const pending = createEphemeralProductSnapshot(listing).then((result) => {
      if (result.error || !result.data?.token) {
        snapshotPromiseRef.current = null
        return result
      }
      setProduct((prev) => (
        prev
          ? {
              ...prev,
              token: result.data.token,
              expires_at: result.data.expires_at || prev.expires_at,
            }
          : prev
      ))
      clearEphemeralOpenPayload(ephemeralOpenSid(listing?.external_url || listing?.productUrl))
      return result
    })
    snapshotPromiseRef.current = pending
    return pending
  }

  useEffect(() => {
    if (!product?.external_url || product.token) return undefined
    void ensureSnapshot(product)
    return undefined
  }, [product?.external_url, product?.token])

  useEffect(() => {
    if (!promoteUrl || !product?.token) return
    const next = publicEphemeralProductPath(product.token, locale)
    const onBridge = /\/abrir$|\/open$/.test(location.pathname)
    if (!onBridge) return
    navigate(next, { replace: true, state: { listing: product } })
  }, [promoteUrl, product?.token, locale, location.pathname, navigate])

  const images = useMemo(() => {
    const listed = Array.isArray(product?.image_urls) ? product.image_urls : []
    return displayListingImages(product?.external_url, [...listed, product?.image_url], product?.image_url)
  }, [product])

  const dropBrokenImage = (brokenUrl) => {
    const target = String(brokenUrl || '').trim()
    if (!target) return
    setProduct((prev) => {
      if (!prev) return prev
      const current = uniqueImageUrls([
        ...(Array.isArray(prev.image_urls) ? prev.image_urls : []),
        prev.image_url,
      ])
      const next = current.filter((url) => url !== target)
      if (next.length === current.length) return prev
      return {
        ...prev,
        image_url: next[0] || '',
        image_urls: next,
      }
    })
    setImageIndex((idx) => {
      const nextLen = Math.max(0, uniqueImageUrls([
        ...(Array.isArray(product?.image_urls) ? product.image_urls : []),
        product?.image_url,
      ]).filter((url) => url !== target).length)
      if (nextLen <= 0) return 0
      return Math.min(idx, nextLen - 1)
    })
  }

  useEffect(() => {
    setImageIndex(0)
    setLightboxOpen(false)
  }, [product?.token])

  // Enrich gallery in background after the page is already open with the cover photo.
  useEffect(() => {
    let active = true
    const productUrl = String(product?.external_url || '').trim()
    const tokenValue = String(product?.token || '').trim()
    if (!productUrl || !tokenValue) return undefined

    const initialImages = uniqueImageUrls([
      ...(Array.isArray(product?.image_urls) ? product.image_urls : []),
      product?.image_url,
    ])
    const cover = product?.image_url || initialImages[0] || ''
    const filteredInitial = filterOwnedListingImages(productUrl, initialImages, cover)
    if (hasEnoughOwnedListingPhotos(productUrl, filteredInitial, cover)) return undefined

    const enrich = async () => {
      setGalleryLoading(true)
      try {
        const gallery = await fetchCatalogProductGallery({
          productUrl,
          storeId: product?.store_id,
          timeoutMs: 15000,
        })
        if (!active) return

        const galleryOk = !gallery?.error && Array.isArray(gallery?.data?.imageUrls)
        let fetched = galleryOk
          ? filterTrustedGalleryImages(productUrl, uniqueImageUrls(gallery.data.imageUrls), cover)
          : []

        if (!fetched.length && filteredInitial.length) {
          fetched = filteredInitial
        }

        if (!fetched.length) return

        const nextImages = fetched
        if (
          nextImages.length === initialImages.length &&
          nextImages.every((url, idx) => url === initialImages[idx])
        ) {
          return
        }

        setProduct((prev) => {
          if (!prev || prev.token !== tokenValue) return prev
          return {
            ...prev,
            image_url: nextImages[0] || prev.image_url,
            image_urls: nextImages,
          }
        })
        if (tokenValue) void updateEphemeralProductImages(tokenValue, nextImages)
        trackEphemeralEvent('gallery_enriched', {
          token: tokenValue,
          storeId: product?.store_id,
          imageCount: nextImages.length,
        })
      } finally {
        if (active) setGalleryLoading(false)
      }
    }

    void enrich()
    return () => {
      active = false
    }
  }, [product?.token, product?.external_url, product?.store_id])

  const salePrice = useMemo(() => {
    const jpy = Number(product?.price_jpy)
    if (!Number.isFinite(jpy) || jpy <= 0) return null
    if (product?.unit_sale_brl != null && Number(product.unit_sale_brl) > 0) {
      const brl = Number(product.unit_sale_brl)
      const usd = Number(product.price_usd) || null
      return { unitSaleBrl: brl, priceUsd: usd, priceJpy: jpy }
    }
    if (!pricingRates) return null
    const computed = computeProductSalePrice({
      priceJpy: jpy,
      channel: SALE_CHANNEL_STORE,
      rates: pricingRates,
    })
    return computed
  }, [product?.price_jpy, product?.unit_sale_brl, product?.price_usd, pricingRates])

  const formattedPrice = useMemo(() => {
    if (salePrice?.unitSaleBrl > 0) {
      return new Intl.NumberFormat(isEn ? 'en-US' : 'pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      }).format(salePrice.unitSaleBrl)
    }
    const raw = Number(product?.price_jpy)
    if (!Number.isFinite(raw)) return '----'
    return new Intl.NumberFormat(isEn ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: (product?.currency || 'JPY').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(raw)
  }, [salePrice, product?.price_jpy, product?.currency, isEn])

  const handleAddToCart = async () => {
    if (!user) {
      navigate(localizedPath('login', locale))
      return
    }
    setAdding(true)
    setFeedback('')
    const snapshot = await ensureSnapshot(product)
    const tokenValue = snapshot?.data?.token || product?.token
    if (!tokenValue) {
      setFeedback(
        snapshot?.error?.message
          || (isEn ? 'Could not prepare this listing for the cart.' : 'Nao foi possivel preparar este anuncio para o carrinho.'),
      )
      setAdding(false)
      return
    }
    const { error: addError } = await addEphemeralToCart(tokenValue, 1)
    if (addError) {
      trackEphemeralEvent('add_to_cart_error', { token: tokenValue, reason: addError.message || 'unknown' })
      setFeedback(addError.message || (isEn ? 'Failed to add to cart.' : 'Falha ao adicionar ao carrinho.'))
    } else {
      trackEphemeralEvent('add_to_cart', { token: tokenValue })
      setFeedback(isEn ? 'Added to cart. Price will be revalidated at checkout.' : 'Adicionado ao carrinho. O preco sera revalidado no checkout.')
    }
    setAdding(false)
  }

  return (
    <>
      <PageSeo
        routeKey="catalogSearchPublic"
        title={isEn ? 'Instant Product' : 'Produto Temporario'}
        description={
          isEn
            ? 'Temporary product generated from catalog search result.'
            : 'Produto temporario gerado a partir da busca de catalogo.'
        }
      />
      <section className="px-4 pb-16 pt-24">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="rounded-xl border border-earth-200 bg-white p-6 text-sm text-earth-600">
              {isEn ? 'Loading temporary product...' : 'Carregando produto temporario...'}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              <p>{error}</p>
              <Link to={localizedPath('catalogSearchPublic', locale)} className="mt-3 inline-block text-earth-900 underline">
                {isEn ? 'Back to catalog search' : 'Voltar para a busca'}
              </Link>
            </div>
          ) : null}

          {!loading && product ? (
            <>
            <div className="grid gap-6 rounded-xl border border-earth-200 bg-white p-5 shadow-sm md:grid-cols-[320px,1fr]">
              <div className="overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
                {images.length > 0 ? (
                  <>
                    <div className="relative">
                      <img
                        src={images[imageIndex] || images[0]}
                        alt={product.title}
                        className="h-72 w-full cursor-zoom-in object-contain sm:h-96"
                        onClick={() => setLightboxOpen(true)}
                        onError={() => dropBrokenImage(images[imageIndex] || images[0])}
                      />
                      {images.length > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setImageIndex((current) => (current === 0 ? images.length - 1 : current - 1))}
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                            aria-label={isEn ? 'Previous photo' : 'Foto anterior'}
                          >
                            <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageIndex((current) => (current === images.length - 1 ? 0 : current + 1))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                            aria-label={isEn ? 'Next photo' : 'Próxima foto'}
                          >
                            <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      ) : null}
                    </div>
                    {images.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto p-2">
                        {images.map((url, index) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setImageIndex(index)}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded border ${
                              index === imageIndex ? 'border-earth-800' : 'border-earth-200'
                            }`}
                            aria-label={isEn ? `Photo ${index + 1}` : `Foto ${index + 1}`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() => dropBrokenImage(url)}
                            />
                          </button>
                        ))}
                      </div>
                    ) : galleryLoading ? (
                      <p className="px-2 py-1.5 text-center text-[11px] text-earth-500">
                        {isEn ? 'Loading more photos…' : 'Carregando mais fotos…'}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-72 items-center justify-center text-sm text-earth-500">
                    {isEn ? 'No image available' : 'Sem imagem disponivel'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-earth-500">
                  {isEn ? 'Temporary listing' : 'Anuncio temporario'}
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-earth-900">{product.title}</h1>
                <div className="mt-3">
                  {salePrice?.unitSaleBrl > 0 || Number(product.price_jpy) > 0 ? (
                    <TriCurrencyDisplay
                      brl={salePrice?.unitSaleBrl || 0}
                      jpy={Number(product.price_jpy) || 0}
                      usd={salePrice?.priceUsd ?? salePrice?.unitSaleUsd ?? 0}
                      variant="page"
                      primary="jpy"
                      footnote={
                        salePrice?.unitSaleBrl > 0
                          ? isEn
                            ? 'Sale price includes exchange fees. Shipping not included.'
                            : 'Preço já inclui taxas de câmbio. Frete não incluso.'
                          : ratesLoading
                            ? isEn
                              ? 'Loading BRL/USD conversion…'
                              : 'Carregando conversão BRL/USD…'
                            : null
                      }
                    />
                  ) : (
                    <p className="text-3xl font-bold text-earth-900">{formattedPrice}</p>
                  )}
                </div>
                <p className="mt-3 text-sm text-earth-600">
                  {isEn
                    ? 'This page expires automatically. Final price and availability are revalidated at checkout.'
                    : 'Esta pagina expira automaticamente. Preco final e disponibilidade sao revalidados no checkout.'}
                </p>
                {product.expires_at ? (
                  <p className="mt-2 text-xs text-earth-500">
                    {isEn ? 'Expires at:' : 'Expira em:'} {new Date(product.expires_at).toLocaleString(isEn ? 'en-US' : 'pt-BR')}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={adding}
                    className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-900 disabled:opacity-60"
                  >
                    {adding
                      ? (isEn ? 'Adding...' : 'Adicionando...')
                      : (isEn ? 'Add to cart' : 'Adicionar ao carrinho')}
                  </button>
                  <a
                    href={product.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-earth-700 underline"
                  >
                    {isEn ? 'View original listing' : 'Ver anuncio original'}
                  </a>
                  <Link to={localizedPath('appCart', locale)} className="text-sm text-earth-700 underline">
                    {isEn ? 'Go to cart' : 'Ir para carrinho'}
                  </Link>
                </div>

                {feedback ? (
                  <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 px-3 py-2 text-sm text-earth-700">
                    {feedback}
                  </div>
                ) : null}
              </div>
            </div>
            <EphemeralListingRecommendations product={product} isEn={isEn} />
            </>
          ) : null}
        </div>
      </section>
      <ImageLightbox
        open={lightboxOpen}
        src={images[imageIndex] || images[0]}
        alt={product?.title || ''}
        onClose={() => setLightboxOpen(false)}
        hasNavigation={images.length > 1}
        onPrev={() => setImageIndex((current) => (current === 0 ? images.length - 1 : current - 1))}
        onNext={() => setImageIndex((current) => (current === images.length - 1 ? 0 : current + 1))}
        prevLabel={isEn ? 'Previous photo' : 'Foto anterior'}
        nextLabel={isEn ? 'Next photo' : 'Próxima foto'}
      />
    </>
  )
}
