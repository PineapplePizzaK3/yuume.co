import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../components/PageSeo'
import { TriCurrencyDisplay } from '../components/TriCurrencyDisplay'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { useAuth } from '../hooks/useAuth'
import { useExchangeRates } from '../hooks/useExchangeRates'
import { LOCALE_EN, localizedPath } from '../lib/localeRoutes'
import { computeProductSalePrice, SALE_CHANNEL_STORE } from '../lib/productSalePrice'
import { addEphemeralToCart } from '../services/cartService'
import { getPublicEphemeralProduct } from '../services/ephemeralProductService'

export default function EphemeralProductDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const locale = useSiteLocale()
  const isEn = locale === LOCALE_EN
  const { user } = useAuth()
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [product, setProduct] = useState(null)
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
      setLoading(true)
      setError('')
      const { data, error: rpcError } = await getPublicEphemeralProduct(token)
      if (!active) return
      if (rpcError || !data) {
        setProduct(null)
        setError(
          rpcError?.message
            || (isEn
              ? 'This temporary product is unavailable or expired.'
              : 'Este produto temporario esta indisponivel ou expirou.')
        )
      } else {
        setProduct(data)
        trackEphemeralEvent('page_open', { token: data.token, storeId: data.store_id })
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [token, isEn])

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
    if (!product?.token) return
    if (!user) {
      navigate(localizedPath('login', locale))
      return
    }
    setAdding(true)
    setFeedback('')
    const { error: addError } = await addEphemeralToCart(product.token, 1)
    if (addError) {
      trackEphemeralEvent('add_to_cart_error', { token: product.token, reason: addError.message || 'unknown' })
      setFeedback(addError.message || (isEn ? 'Failed to add to cart.' : 'Falha ao adicionar ao carrinho.'))
    } else {
      trackEphemeralEvent('add_to_cart', { token: product.token })
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
            <div className="grid gap-6 rounded-xl border border-earth-200 bg-white p-5 shadow-sm md:grid-cols-[320px,1fr]">
              <div className="overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
                  <p className="text-3xl font-bold text-earth-900">{formattedPrice}</p>
                  {salePrice?.unitSaleBrl > 0 ? (
                    <div className="mt-2">
                      <TriCurrencyDisplay
                        brl={salePrice.unitSaleBrl}
                        jpy={Number(product.price_jpy) || 0}
                        usd={salePrice.priceUsd ?? salePrice.unitSaleUsd}
                        variant="page"
                        footnote={
                          isEn
                            ? 'Sale price in BRL includes exchange fees. Shipping not included.'
                            : 'Preco de venda em reais ja inclui taxas de cambio. Frete nao incluso.'
                        }
                      />
                    </div>
                  ) : ratesLoading ? (
                    <p className="mt-1 text-sm text-earth-500">
                      {isEn ? 'Loading sale price…' : 'Carregando preco de venda…'}
                    </p>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-earth-600">
                  {isEn
                    ? 'This page expires automatically. Final price and availability are revalidated at checkout.'
                    : 'Esta pagina expira automaticamente. Preco final e disponibilidade sao revalidados no checkout.'}
                </p>
                <p className="mt-2 text-xs text-earth-500">
                  {isEn ? 'Expires at:' : 'Expira em:'} {new Date(product.expires_at).toLocaleString(isEn ? 'en-US' : 'pt-BR')}
                </p>

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
          ) : null}
        </div>
      </section>
    </>
  )
}
