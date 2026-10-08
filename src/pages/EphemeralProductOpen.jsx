import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageSeo } from '../components/PageSeo'
import {
  decodeEphemeralOpenPayload,
  resolveEphemeralOpenItem,
} from '../lib/ephemeralOpenSession'
import { listingFromIndexRow } from '../lib/ephemeralListing'
import { LOCALE_EN, localizedPath } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { getListingIndexByUrl } from '../services/listingIndexService'
import EphemeralProductDetail from './EphemeralProductDetail'

function encodedPayloadFromHash() {
  if (typeof window === 'undefined') return ''
  const hash = String(window.location.hash || '').replace(/^#/, '')
  if (!hash) return ''
  const params = new URLSearchParams(hash.includes('=') ? hash : `d=${hash}`)
  return String(params.get('d') || '').trim()
}

function hitFromIndexRow(row, fallback = {}) {
  const listing = listingFromIndexRow(row)
  if (!listing?.external_url) return null
  return {
    ...fallback,
    productUrl: listing.external_url,
    title: listing.title,
    price: listing.price_jpy,
    currency: listing.currency || fallback.currency || 'JPY',
    imageUrl: listing.image_url || fallback.imageUrl,
    imageUrls: listing.image_urls?.length ? listing.image_urls : fallback.imageUrls,
    storeId: listing.store_id || fallback.storeId,
    source: 'index',
  }
}

export default function EphemeralProductOpen() {
  const siteLocale = useSiteLocale()
  const isEn = siteLocale === LOCALE_EN
  const [searchParams] = useSearchParams()
  const sid = String(searchParams.get('s') || '').trim()
  const urlFromQuery = String(searchParams.get('u') || '').trim()

  const [seedHit, setSeedHit] = useState(() => {
    const resolved = resolveEphemeralOpenItem({
      sid,
      encodedPayload: encodedPayloadFromHash(),
    })
    if (resolved?.productUrl) return resolved
    const decoded = decodeEphemeralOpenPayload(encodedPayloadFromHash())
    if (decoded?.productUrl) return decoded
    return urlFromQuery ? { productUrl: urlFromQuery } : null
  })
  const [resolving, setResolving] = useState(() => Boolean((seedHit?.productUrl && !seedHit?.title) || (!seedHit?.productUrl && urlFromQuery)))

  useEffect(() => {
    let active = true
    const encoded = encodedPayloadFromHash()
    const resolved = resolveEphemeralOpenItem({ sid, encodedPayload: encoded })
      || decodeEphemeralOpenPayload(encoded)
    const url = String(resolved?.productUrl || urlFromQuery || '').trim()

    if (resolved?.productUrl && resolved?.title) {
      setSeedHit(resolved)
      setResolving(false)
      return undefined
    }

    if (!url) {
      setSeedHit(null)
      setResolving(false)
      return undefined
    }

    setResolving(true)
    getListingIndexByUrl({
      storeId: resolved?.storeId || resolved?.store_id,
      productUrl: url,
    }).then(({ data }) => {
      if (!active) return
      const fromIndex = data ? hitFromIndexRow(data, resolved || { productUrl: url }) : null
      setSeedHit(fromIndex || (resolved?.productUrl ? resolved : null))
      setResolving(false)
    }).catch(() => {
      if (!active) return
      setSeedHit(resolved?.productUrl ? resolved : null)
      setResolving(false)
    })

    return () => {
      active = false
    }
  }, [sid, urlFromQuery])

  if (resolving) {
    return (
      <>
        <PageSeo
          routeKey="catalogSearchPublic"
          title={isEn ? 'Temporary product' : 'Produto temporario'}
          noindex
        />
        <section className="px-4 pb-16 pt-24">
          <div className="mx-auto max-w-lg rounded-xl border border-earth-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-earth-700">
              {isEn ? 'Opening listing…' : 'Abrindo o anuncio…'}
            </p>
          </div>
        </section>
      </>
    )
  }

  if (!seedHit?.productUrl || !seedHit?.title) {
    return (
      <>
        <PageSeo
          routeKey="catalogSearchPublic"
          title={isEn ? 'Temporary product' : 'Produto temporario'}
          noindex
        />
        <section className="px-4 pb-16 pt-24">
          <div className="mx-auto max-w-lg rounded-xl border border-earth-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-700">
              {isEn
                ? 'This temporary product link expired. Go back to search and open it again.'
                : 'Este link temporario expirou. Volte a busca e abra o item novamente.'}
            </p>
            <Link
              to={localizedPath('catalogSearchPublic', siteLocale)}
              className="mt-3 inline-block text-sm font-medium text-earth-900 underline"
            >
              {isEn ? 'Back to catalog search' : 'Voltar para a busca'}
            </Link>
          </div>
        </section>
      </>
    )
  }

  return <EphemeralProductDetail seedHit={seedHit} promoteUrl />
}
