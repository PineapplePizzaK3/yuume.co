import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { listWishlistItems, removeWishlistItem, upsertWishlistItem } from '../../services/wishlistCatalogService'
import { catalogItemPath } from '../../lib/localeRoutes'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { VisualEmptyState } from '../../components/VisualEmptyState'
import { IconBookmark } from '../../components/home/HomeSectionIcons'

function WishlistPage() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const location = useLocation()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [targetDraft, setTargetDraft] = useState({})

  const reload = async () => {
    setLoading(true)
    setError('')
    const res = await listWishlistItems()
    setItems(Array.isArray(res.data) ? res.data : [])
    if (res.error) setError(res.error.message || '')
    setLoading(false)
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([])
      setLoading(false)
      return
    }
    void reload()
  }, [isAuthenticated])

  const saveTarget = async (row) => {
    const catalogId = row.catalog_item_id
    if (!catalogId) return
    setBusyId(catalogId)
    const raw = targetDraft[catalogId]
    const value = raw === '' || raw == null ? null : Number(raw)
    const res = await upsertWishlistItem(catalogId, { targetPriceJpy: value, notes: row.notes })
    setBusyId('')
    if (res.error) {
      setError(res.error.message || '')
      return
    }
    void reload()
  }

  const remove = async (catalogId) => {
    if (!catalogId) return
    setBusyId(catalogId)
    const res = await removeWishlistItem(catalogId)
    setBusyId('')
    if (res.error) {
      setError(res.error.message || '')
      return
    }
    setItems((prev) => prev.filter((r) => r.catalog_item_id !== catalogId))
  }

  if (!isAuthenticated) {
    return (
      <section className="mx-auto mt-24 max-w-3xl rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-earth-900">
          {t('collector.wishlist.title', { defaultValue: 'Wishlist' })}
        </h1>
        <p className="mt-2 text-sm text-earth-600">
          {t('collector.wishlist.loginRequired', { defaultValue: 'Entre para gerenciar sua wishlist de catálogo.' })}
        </p>
        <Link
          to={path('login')}
          state={{ from: location }}
          className="mt-4 inline-flex rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
        >
          {t('collector.actions.loginToContinue', { defaultValue: 'Entrar' })}
        </Link>
      </section>
    )
  }

  return (
    <>
      <PageSeo routeKey="collectorWishlist" title={t('collector.meta.wishlistTitle', { defaultValue: 'Wishlist | YuumeCo' })} />
      <section className="px-4 pb-12 pt-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-3xl font-semibold text-earth-900">
            {t('collector.wishlist.title', { defaultValue: 'Wishlist' })}
          </h1>
          <p className="mt-2 text-earth-600">
            {t('collector.wishlist.subtitle', {
              defaultValue: 'Itens de catálogo que você quer. Links de URL continuam em Desejos no Lounge.',
            })}
          </p>
          {error ? <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {loading ? (
            <p className="mt-6 text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</p>
          ) : items.length === 0 ? (
            <VisualEmptyState
              image="/home/anime-1-figures.png"
              icon={IconBookmark}
              title={t('collector.wishlist.empty', { defaultValue: 'Lista vazia.' })}
              hint={t('collector.wishlist.emptyHint', {
                defaultValue: 'Abra um item do catálogo e toque em “Quero este”.',
              })}
              toRoute="collectorExplore"
              cta={t('collector.actions.exploreSets', { defaultValue: 'Explorar sets' })}
            />
          ) : (
            <ul className="mt-6 space-y-3">
              {items.map((row) => {
                const ci = row.catalog_item
                const name = localeKey === 'en' ? ci?.name_en || ci?.name_ja : ci?.name_ja || ci?.name_en
                const setCode = ci?.set?.set_code
                const draft =
                  targetDraft[row.catalog_item_id] !== undefined
                    ? targetDraft[row.catalog_item_id]
                    : row.target_price_jpy ?? ''
                return (
                  <li key={row.id} className="rounded-xl border border-earth-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          to={catalogItemPath(row.catalog_item_id, locale)}
                          className="font-medium text-earth-900 hover:underline"
                        >
                          {name || '—'}
                        </Link>
                        <p className="text-xs text-earth-500">
                          {[setCode, ci?.number ? `#${ci.number}` : null, ci?.rarity].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-earth-600">
                          {t('collector.wishlist.target', { defaultValue: 'Alvo ¥' })}
                          <input
                            type="number"
                            min="0"
                            value={draft}
                            onChange={(e) =>
                              setTargetDraft((prev) => ({ ...prev, [row.catalog_item_id]: e.target.value }))
                            }
                            className="ml-2 w-28 rounded border border-earth-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busyId === row.catalog_item_id}
                          onClick={() => saveTarget(row)}
                          className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-800 hover:bg-earth-50"
                        >
                          {t('collector.wishlist.save', { defaultValue: 'Salvar' })}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.catalog_item_id}
                          onClick={() => remove(row.catalog_item_id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          {t('collector.wishlist.remove', { defaultValue: 'Remover' })}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}

export default WishlistPage
