import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageSeo } from '../components/PageSeo'
import {
  clearEphemeralOpenPayload,
  resolveEphemeralOpenItem,
} from '../lib/ephemeralOpenSession'
import { LOCALE_EN, localizedPath, publicEphemeralProductPath } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { createEphemeralProductSnapshot } from '../services/ephemeralProductService'

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

function encodedPayloadFromHash() {
  if (typeof window === 'undefined') return ''
  const hash = String(window.location.hash || '').replace(/^#/, '')
  if (!hash) return ''
  const params = new URLSearchParams(hash.includes('=') ? hash : `d=${hash}`)
  return String(params.get('d') || '').trim()
}

export default function EphemeralProductOpen() {
  const navigate = useNavigate()
  const siteLocale = useSiteLocale()
  const isEn = siteLocale === LOCALE_EN
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const run = async () => {
      const sid = String(searchParams.get('s') || '').trim()
      const item = resolveEphemeralOpenItem({
        sid,
        encodedPayload: encodedPayloadFromHash(),
      })
      if (!item?.productUrl) {
        if (!active) return
        setError(
          isEn
            ? 'This temporary product link expired. Go back to search and open it again.'
            : 'Este link temporario expirou. Volte a busca e abra o item novamente.',
        )
        return
      }

      // Fast path: create with listing photos we already have; detail page enriches the rest.
      const imageUrls = uniqueImageUrls([
        item?.imageUrl,
        ...(Array.isArray(item?.imageUrls) ? item.imageUrls : []),
      ])
      const { data, error: createError } = await createEphemeralProductSnapshot({
        ...item,
        imageUrl: imageUrls[0] || item?.imageUrl || null,
        imageUrls,
      })
      if (!active) return
      if (createError || !data?.token) {
        setError(
          createError?.message
            || (isEn
              ? 'Could not open temporary product. Please try again from search.'
              : 'Nao foi possivel abrir o produto temporario. Tente novamente pela busca.'),
        )
        return
      }
      clearEphemeralOpenPayload(sid)
      navigate(publicEphemeralProductPath(data.token, siteLocale), { replace: true })
    }
    void run()
    return () => {
      active = false
    }
  }, [searchParams, navigate, siteLocale, isEn])

  return (
    <>
      <PageSeo
        routeKey="catalogSearchPublic"
        title={isEn ? 'Opening product...' : 'Abrindo produto...'}
        noindex
      />
      <section className="px-4 pb-16 pt-24">
        <div className="mx-auto max-w-lg rounded-xl border border-earth-200 bg-white p-6 text-center shadow-sm">
          {error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-700">{error}</p>
              <Link
                to={localizedPath('catalogSearchPublic', siteLocale)}
                className="inline-block text-sm font-medium text-earth-900 underline"
              >
                {isEn ? 'Back to catalog search' : 'Voltar para a busca'}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-earth-700">
              {isEn ? 'Preparing temporary product page...' : 'Preparando pagina temporaria do produto...'}
            </p>
          )}
        </div>
      </section>
    </>
  )
}
