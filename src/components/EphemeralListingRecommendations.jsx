import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { catalogStoreBrand } from './CatalogSearchPanel'
import { useSiteLocale } from '../hooks/useSiteLocale'
import {
  encodeEphemeralOpenPayload,
  stashEphemeralOpenPayload,
} from '../lib/ephemeralOpenSession'
import { localizedPath, publicEphemeralOpenPath } from '../lib/localeRoutes'
import { getEphemeralListingRecommendations } from '../services/ephemeralRecommendationService'

function formatListingPrice(value, currency, isEn) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  return new Intl.NumberFormat(isEn ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: currency || 'JPY',
    maximumFractionDigits: 0,
  }).format(numeric)
}

function recommendationHref(item, locale) {
  const sid = stashEphemeralOpenPayload(item)
  if (!sid) return ''
  return publicEphemeralOpenPath(sid, locale, encodeEphemeralOpenPayload(item), item?.productUrl || item?.external_url)
}

export default function EphemeralListingRecommendations({ product, isEn }) {
  const locale = useSiteLocale()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [storeCount, setStoreCount] = useState(0)

  useEffect(() => {
    const title = String(product?.title || '').trim()
    const token = String(product?.token || '').trim()
    if (!title || !token) {
      setItems([])
      setQuery('')
      setStoreCount(0)
      return undefined
    }

    let active = true
    const load = async () => {
      setLoading(true)
      const { data } = await getEphemeralListingRecommendations({
        title,
        productUrl: product?.external_url,
        priceJpy: product?.price_jpy,
      })
      if (!active) return
      setQuery(data?.query || '')
      setStoreCount(Number(data?.storeCount) || 0)
      setItems(Array.isArray(data?.items) ? data.items : [])
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [product?.token, product?.title, product?.external_url, product?.price_jpy])

  if (!loading && items.length === 0) return null

  const searchHref = query
    ? localizedPath('catalogSearchPublic', locale, `?catalogQuery=${encodeURIComponent(query)}`)
    : localizedPath('catalogSearchPublic', locale)

  return (
    <section className="mt-8" aria-labelledby="ephemeral-recommendations-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ephemeral-recommendations-heading" className="text-lg font-semibold text-earth-900">
            {isEn ? 'Similar listings' : 'Anúncios parecidos'}
          </h2>
          <p className="mt-1 text-sm text-earth-600">
            {storeCount > 1
              ? (isEn
                ? `From ${storeCount} marketplaces. Opening one creates a new temporary listing.`
                : `De ${storeCount} marketplaces. Abrir um deles gera outro anúncio temporário.`)
              : (isEn
                ? 'Other listings for this product. Opening one creates a new temporary listing.'
                : 'Outros anúncios deste produto. Abrir um deles gera outro anúncio temporário.')}
          </p>
        </div>
        <Link to={searchHref} className="text-sm text-earth-700 underline">
          {isEn ? 'Search all marketplaces' : 'Buscar em todos os marketplaces'}
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-xl border border-earth-200 bg-earth-100" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => {
            const brand = catalogStoreBrand(item.storeId)
            const href = recommendationHref(item, locale)
            const price = formatListingPrice(item.price, item.currency, isEn)
            return (
              <a
                key={item.productUrl}
                href={href || item.productUrl}
                onClick={(event) => {
                  if (
                    !href
                    || event.button !== 0
                    || event.metaKey
                    || event.ctrlKey
                    || event.shiftKey
                    || event.altKey
                  ) {
                    return
                  }
                  event.preventDefault()
                  navigate(href)
                }}
                className="flex flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md"
              >
                <div className="relative h-36 bg-earth-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-earth-500">
                      {isEn ? 'No image' : 'Sem imagem'}
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-1.5 inline-flex max-w-[90%] items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                    {brand.logo ? (
                      <img src={brand.logo} alt="" className="h-3.5 w-3.5 rounded-sm bg-white/90 object-contain" />
                    ) : null}
                    <span className="truncate">{item.storeName || brand.label}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-earth-900">{item.title}</p>
                  {price ? <p className="mt-auto text-sm font-semibold text-earth-800">{price}</p> : null}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
