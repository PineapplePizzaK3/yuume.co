import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { FindInJapanPanel } from '../../components/collector/FindInJapanPanel'
import { getItem } from '../../services/catalogService'
import { getOwnedCollectionItem, setCatalogItemOwned } from '../../services/collectionService'
import { getWishlistItemForCatalog, removeWishlistItem, upsertWishlistItem } from '../../services/wishlistCatalogService'
import { useAuth } from '../../hooks/useAuth'
import { useCollectorFlags } from '../../hooks/useCollectorFlags'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { localizedPath } from '../../lib/localeRoutes'

function CatalogItemPage() {
  const { t, i18n } = useTranslation()
  const { itemId } = useParams()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const { isAuthenticated } = useAuth()
  const { market: marketEnabled } = useCollectorFlags()
  const [item, setItem] = useState(null)
  const [ownedRow, setOwnedRow] = useState(null)
  const [wishRow, setWishRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void getItem(itemId).then(async (res) => {
      if (!active) return
      if (res.error) {
        setError(res.error.message || t('collector.errors.itemNotFound', { defaultValue: 'Item não encontrado.' }))
        setItem(null)
        setOwnedRow(null)
        setWishRow(null)
        setLoading(false)
        return
      }
      setItem(res.data)
      if (isAuthenticated && res.data?.id) {
        const [owned, wish] = await Promise.all([
          getOwnedCollectionItem(res.data.id),
          getWishlistItemForCatalog(res.data.id),
        ])
        if (!active) return
        setOwnedRow(owned.data)
        setWishRow(wish.data)
        setTargetPrice(wish.data?.target_price_jpy != null ? String(wish.data.target_price_jpy) : '')
      } else {
        setOwnedRow(null)
        setWishRow(null)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [itemId, isAuthenticated, t])

  const handleToggleOwned = async () => {
    if (!item?.id || busy) return
    if (!isAuthenticated) return
    setBusy(true)
    setError('')
    const nextOwned = !ownedRow
    const res = await setCatalogItemOwned(item.id, nextOwned)
    setBusy(false)
    if (res.error) {
      setError(res.error.message || t('collector.errors.collectionUpdate', { defaultValue: 'Não foi possível atualizar a coleção.' }))
      return
    }
    setOwnedRow(nextOwned ? res.data?.item || { id: 'owned' } : null)
    if (nextOwned) setWishRow(null)
  }

  const handleToggleWishlist = async () => {
    if (!item?.id || busy || ownedRow) return
    if (!isAuthenticated) return
    setBusy(true)
    setError('')
    if (wishRow) {
      const res = await removeWishlistItem(item.id)
      setBusy(false)
      if (res.error) {
        setError(res.error.message || '')
        return
      }
      setWishRow(null)
      return
    }
    const res = await upsertWishlistItem(item.id, {
      targetPriceJpy: targetPrice === '' ? null : Number(targetPrice),
    })
    setBusy(false)
    if (res.error) {
      setError(res.error.message || '')
      return
    }
    setWishRow(res.data || { catalog_item_id: item.id })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-earth-600">
        {t('collector.common.loading', { defaultValue: 'Carregando...' })}
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-earth-600">
        {error || t('collector.errors.itemNotFound', { defaultValue: 'Item não encontrado.' })}
      </div>
    )
  }

  const set = item.set
  const name = localeKey === 'en' ? item.name_en || item.name_ja : item.name_ja || item.name_en
  const setName = localeKey === 'en' ? set?.name_en || set?.name_ja : set?.name_ja || set?.name_en
  const isOwned = Boolean(ownedRow)
  const onWishlist = Boolean(wishRow)

  return (
    <>
      <PageSeo routeKey="catalogItem" title={`${name || item.number || 'Item'} | YuumeCo`} />
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-24">
        <Link to={localizedPath('collectorCollection', locale)} className="text-sm text-earth-600 hover:text-earth-900">
          ← {t('collector.collection.title', { defaultValue: 'Minha coleção' })}
        </Link>

        <div className="mt-4 rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-earth-500">
            {set?.set_code || item.franchise}
            {item.number ? ` · #${item.number}` : ''}
            {item.rarity ? ` · ${item.rarity}` : ''}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-earth-900">{name || '—'}</h1>
          {setName ? <p className="mt-1 text-sm text-earth-600">{setName}</p> : null}
          {set?.status && set.status !== 'VERIFIED' ? (
            <p className="mt-2 text-xs text-amber-700">
              {t('collector.item.setNotVerified', {
                defaultValue: 'Checklist deste set ainda não está verificado ({{status}}).',
                status: set.status,
              })}
            </p>
          ) : null}

          {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleOwned}
                  disabled={busy}
                  className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                    isOwned
                      ? 'border border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                      : 'bg-earth-900 text-earth-50 hover:bg-earth-800'
                  }`}
                >
                  {busy
                    ? t('collector.common.saving', { defaultValue: 'Salvando...' })
                    : isOwned
                      ? t('collector.item.markNotOwned', { defaultValue: 'Remover da coleção' })
                      : t('collector.item.markOwned', { defaultValue: 'Tenho este item' })}
                </button>
                {!isOwned ? (
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    disabled={busy}
                    className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                      onWishlist
                        ? 'border border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                        : 'border border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                    }`}
                  >
                    {onWishlist
                      ? t('collector.item.removeWishlist', { defaultValue: 'Remover da wishlist' })
                      : t('collector.item.addWishlist', { defaultValue: 'Quero este' })}
                  </button>
                ) : null}
                {!isOwned ? (
                  <label className="text-xs text-earth-600">
                    {t('collector.wishlist.target', { defaultValue: 'Alvo ¥' })}
                    <input
                      type="number"
                      min="0"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="ml-2 w-28 rounded border border-earth-300 px-2 py-1 text-sm"
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <Link
                to={path('login')}
                state={{ from: location }}
                className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
              >
                {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
              </Link>
            )}
            {isOwned && ownedRow?.quantity > 1 ? (
              <span className="text-sm text-earth-600">×{ownedRow.quantity}</span>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-earth-500">
            {t('collector.item.noAutoAcquire', {
              defaultValue: 'Compras e holdings no Japão não entram sozinhas na coleção — só quando você marca.',
            })}
          </p>

          {marketEnabled ? <FindInJapanPanel item={item} wishlistItemId={wishRow?.id || null} /> : null}
        </div>
      </section>
    </>
  )
}

export default CatalogItemPage
