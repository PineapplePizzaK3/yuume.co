/**
 * Lista de grupos de compra na vitrine — detalhes abrem em página dedicada.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { appStoreGroupPath, publicStoreGroupPath } from '../../lib/localeRoutes'
import { PageSeo } from '../../components/PageSeo'
import { getPurchaseGroups } from '../../services/groupService'
import { getPurchaseGroupProducts } from '../../services/productService'
import LinkifyText from '../../components/LinkifyText'

function getGroupImages(g) {
  if (Array.isArray(g?.image_urls) && g.image_urls.length > 0) return g.image_urls.filter(Boolean)
  if (g?.image_url) return [g.image_url]
  return []
}

export default function GrupoDeCompras({ embedded = false, hideHeader = false, destination = 'all', publicMode = false }) {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const tt = (key, options) => t(`platform.groupBuy.${key}`, options)
  const [groups, setGroups] = useState([])
  const [groupProducts, setGroupProducts] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const groupHref = (id) => (publicMode ? publicStoreGroupPath(id, locale) : appStoreGroupPath(id, locale))

  useEffect(() => {
    if (!message) return
    const timeoutId = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timeoutId)
  }, [message])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      setLoading(true)
      setMessage('')
      try {
        const { data: groupsData, error } = await getPurchaseGroups(destination)
        if (!isActive) return
        setGroups(groupsData ?? [])
        if (error) setMessage(error?.message)

        const groupIds = (groupsData ?? []).map((g) => g.id)
        const productsArrays = await Promise.all(
          groupIds.map((id) => getPurchaseGroupProducts(id).then((r) => r.data ?? []))
        )
        if (!isActive) return
        const map = Object.fromEntries(groupIds.map((id, i) => [id, productsArrays[i] ?? []]))
        setGroupProducts(map)
      } catch (e) {
        if (isActive) setMessage(e?.message || t('platform.groupBuy.loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [destination, t])

  const getGroupProducts = (group) => {
    return groupProducts[group?.id] ?? []
  }

  return (
    <>
      {!embedded && (
        <PageSeo
          routeKey="appLoja"
          title={t('meta.appStore.title')}
          description={t('meta.appStore.description')}
          noindex
        />
      )}

      <div className={embedded ? 'rounded-xl border border-earth-200 bg-white p-4 sm:p-6' : ''}>
        {!hideHeader && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-earth-900">{tt('pageTitle')}</h1>
              <p className="mt-2 text-earth-600">{tt('intro')}</p>
            </div>
          </div>
        )}

        {message && <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>}

        {loading && <p className="mt-6 text-earth-600">{tt('loading')}</p>}
        {!loading && groups.length === 0 && (
          <p className="mt-6 text-earth-600">{tt('emptyGroups')}</p>
        )}

        {!loading && groups.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const imgs = getGroupImages(g)
              const mainImg = imgs[0]
              const prods = getGroupProducts(g)

              return (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <Link
                    to={groupHref(g.id)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-xl"
                  >
                    {mainImg ? (
                      <img src={mainImg} alt={g.name} className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-earth-200 text-earth-500">
                        {t('platform.store.noImage')}
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="font-semibold text-earth-900">{g.name}</h2>
                      {g.description && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-earth-600">
                          <LinkifyText text={g.description} />
                        </p>
                      )}
                      <p className="mt-2 text-xs text-earth-500">
                        {tt('productsInGroup', { count: prods.length })}
                      </p>
                    </div>
                  </Link>

                  <div className="flex gap-2 px-4 pb-4">
                    <Link
                      to={groupHref(g.id)}
                      className="flex-1 rounded-lg bg-earth-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-earth-800"
                    >
                      {tt('viewDetails')}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
