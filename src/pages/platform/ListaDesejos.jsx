/**
 * Lista de Desejos - Itens adicionados por link.
 * Usuário cola a URL do produto; o sistema extrai nome e preço.
 * Preços são atualizáveis para detectar promoções.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import ImageLightbox from '../../components/ImageLightbox'
import {
  getWishlistLinks,
  addWishlistLink,
  updateWishlistLink,
  removeWishlistLink,
  scrapeProductUrl,
} from '../../services/wishlistLinkService'
import { useAuth } from '../../hooks/useAuth'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { LOCALE_EN } from '../../lib/localeRoutes'
import { formatBrlForSite, formatJpyForSite } from '../../lib/moneyDisplay'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

function parsePriceInput(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = text.replace(/[^\d.,-]/g, '')
  if (!normalized) return null

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')
  let candidate = normalized

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(',')
    const lastDot = normalized.lastIndexOf('.')
    if (lastComma > lastDot) {
      candidate = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      candidate = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = normalized.split(',')
    const tail = parts[parts.length - 1] ?? ''
    candidate = tail.length <= 2 ? `${parts.slice(0, -1).join('')}.${tail}` : parts.join('')
  } else if (hasDot) {
    const parts = normalized.split('.')
    const tail = parts[parts.length - 1] ?? ''
    candidate = tail.length > 2 ? parts.join('') : normalized
  }

  const parsed = Number(candidate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export default function ListaDesejos() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const numberLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'
  const { user } = useAuth()

  const formatMoney = (v, currency = 'JPY') => {
    if (v == null) return '—'
    if (currency === 'BRL') return formatBrlForSite(siteLocale, v)
    return formatJpyForSite(siteLocale, v, null)
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString(numberLocale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  const [urlInput, setUrlInput] = useState('')
  const [linkItems, setLinkItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [message, setMessage] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' })
  const [editForm, setEditForm] = useState({
    url: '',
    product_name: '',
    price: '',
    currency: 'JPY',
    image_url: '',
  })

  const load = async (active = () => true) => {
    if (!user?.id) {
      if (active()) setLoading(false)
      return
    }
    if (active()) setLoading(true)
    try {
      const k = cacheKey(user.id, 'wishlist_links_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && active()) {
        setLinkItems(Array.isArray(cached) ? cached : [])
        setLoading(false)
      }
      const { data, error } = await getWishlistLinks(user.id)
      if (!active()) return
      setLinkItems(data ?? [])
      writeCache(k, data ?? [])
      if (error) setMessage(error.message || t('platform.wishlist.loadError'))
    } catch (e) {
      if (active()) setMessage(e?.message || t('platform.wishlist.loadError'))
    } finally {
      if (active()) setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      await load(() => isActive)
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, t])

  const doAddItem = async (url, product_name, price, currency = 'JPY', image_url = null) => {
    if (!user?.id) {
      setMessage(t('platform.wishlist.loginToAdd'))
      return
    }
    setAdding(true)
    setMessage('')
    const { error } = await addWishlistLink(user.id, {
      url,
      product_name: product_name || t('platform.wishlist.productDefault'),
      price: parsePriceInput(price),
      currency: currency || 'JPY',
      image_url: image_url || null,
    })
    setAdding(false)
    if (error) {
      setMessage(error.message || t('platform.wishlist.addError'))
      return
    }
    setUrlInput('')
    setManualUrl('')
    setManualName('')
    setManualPrice('')
    setShowManual(false)
    setMessage(t('platform.wishlist.added'))
    load()
  }

  const handleAddByUrl = async (e) => {
    e.preventDefault()
    const url = urlInput.trim()
    if (!url) return
    setAdding(true)
    setMessage('')
    setShowManual(false)
    const { data, error } = await scrapeProductUrl(url)
    if (error) {
      setMessage(error.message || t('platform.wishlist.scrapeError'))
      setShowManual(true)
      setManualUrl(url)
      setAdding(false)
      return
    }
    await doAddItem(
      url,
      data.name || t('platform.wishlist.productDefault'),
      data.price,
      data.currency || 'JPY',
      data.imageUrl || null
    )
  }

  const handleOpenManual = () => {
    setShowManual(true)
    setManualUrl(urlInput.trim())
  }

  const handleUpdatePrice = async (item) => {
    setUpdatingId(item.id)
    setMessage('')
    const { data, error } = await scrapeProductUrl(item.url)
    if (error) {
      setMessage(error.message || t('platform.wishlist.updateScrapeError'))
      setUpdatingId(null)
      return
    }
    const previousPrice = item.price
    const newPrice = data.price ?? null
    const { error: updateErr } = await updateWishlistLink(user.id, item.id, {
      product_name: data.name || item.product_name,
      price: newPrice,
      previous_price: previousPrice,
      image_url: data.imageUrl ?? item.image_url,
      currency: data.currency ?? item.currency,
    })
    setUpdatingId(null)
    if (updateErr) {
      setMessage(updateErr.message || t('platform.wishlist.updateError'))
      return
    }
    setMessage(t('platform.wishlist.priceUpdated'))
    load()
  }

  const handleEditItem = (item) => {
    setEditingItemId(item.id)
    setEditForm({
      url: item.url || '',
      product_name: item.product_name || '',
      price: item.price != null ? String(item.price) : '',
      currency: item.currency || 'JPY',
      image_url: item.image_url || '',
    })
  }

  const handleSaveEditItem = async (item) => {
    const trimmedName = editForm.product_name.trim()
    const trimmedUrl = editForm.url.trim()
    if (!trimmedName) {
      setMessage(t('platform.wishlist.needName'))
      return
    }
    if (!trimmedUrl) {
      setMessage(t('platform.wishlist.needUrl'))
      return
    }
    const newPrice = editForm.price.trim() ? parsePriceInput(editForm.price) : null
    if (newPrice == null && editForm.price.trim()) {
      setMessage(t('platform.wishlist.invalidPrice'))
      return
    }
    setMessage('')
    const { error } = await updateWishlistLink(user.id, item.id, {
      url: trimmedUrl,
      product_name: trimmedName,
      currency: editForm.currency || item.currency || 'JPY',
      image_url: editForm.image_url.trim() || null,
      price: newPrice,
      previous_price: item.price,
    })
    setEditingItemId(null)
    setEditForm({ url: '', product_name: '', price: '', currency: 'JPY', image_url: '' })
    if (error) {
      setMessage(error.message || t('platform.wishlist.updateError'))
      return
    }
    setMessage(t('platform.wishlist.priceUpdated'))
    load()
  }

  const handleRemoveLink = async (id) => {
    const { error } = await removeWishlistLink(user.id, id)
    setMessage(error ? error.message : t('platform.wishlist.removed'))
    if (!error) load()
  }

  const getDesconto = (item) => {
    if (item.price == null || item.previous_price == null) return null
    const prev = Number(item.previous_price)
    const curr = Number(item.price)
    if (prev <= 0 || curr >= prev) return null
    return Math.round(((prev - curr) / prev) * 100)
  }

  const hasItems = linkItems.length > 0

  const openLightbox = (src, alt = t('platform.wishlist.imageAlt')) => {
    if (!src) return
    setLightbox({ open: true, src, alt })
  }

  return (
    <>
      <PageSeo
        routeKey="appLounge"
        title={t('meta.appWishlist.title')}
        description={t('meta.appWishlist.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.wishlist.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">
          {t('platform.wishlist.intro')}
        </p>

        {/* Adicionar por link */}
        <div className="mt-6 space-y-4">
          <form onSubmit={handleAddByUrl}>
            <label htmlFor="url" className="block text-sm font-medium text-earth-700">
              {t('platform.wishlist.addLabel')}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t('platform.wishlist.urlPlaceholder')}
                className="flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400"
              />
              <button
                type="submit"
                disabled={adding}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {adding ? t('platform.wishlist.searching') : t('platform.wishlist.searchAdd')}
              </button>
            </div>
          </form>
          <button
            type="button"
            onClick={() => (showManual ? setShowManual(false) : handleOpenManual())}
            className="text-sm text-earth-600 hover:text-earth-900 underline"
          >
            {showManual ? t('platform.wishlist.toggleManualHide') : t('platform.wishlist.toggleManualShow')}
          </button>
          {showManual && (
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
              <p className="mb-3 text-sm font-medium text-earth-800">{t('platform.wishlist.manualTitle')}</p>
              <p className="mb-3 text-xs text-earth-600">
                {t('platform.wishlist.manualHint')}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-earth-700">{t('platform.wishlist.manualLink')}</label>
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder={t('platform.wishlist.urlPlaceholder')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-earth-700">{t('platform.wishlist.manualName')}</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={t('platform.wishlist.manualNamePh')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-earth-700">{t('platform.wishlist.manualPrice')}</label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder={t('platform.wishlist.manualPricePh')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = manualUrl.trim()
                    if (!url) {
                      setMessage(t('platform.wishlist.needUrl'))
                      return
                    }
                    if (!manualName.trim()) {
                      setMessage(t('platform.wishlist.needName'))
                      return
                    }
                    doAddItem(url, manualName.trim(), manualPrice.trim())
                  }}
                  disabled={adding}
                  className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-700 disabled:opacity-60"
                >
                  {t('platform.wishlist.addToList')}
                </button>
              </div>
            </div>
          )}
        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>
        )}

        {loading && <p className="mt-6 text-earth-600">{t('platform.wishlist.loading')}</p>}

        {!loading && !hasItems && (
          <p className="mt-6 text-earth-600">{t('platform.wishlist.empty')}</p>
        )}

        {!loading && hasItems && (
          <div className="mt-8 space-y-6">
            {linkItems.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-earth-700">
                  {t('platform.wishlist.listHeading', { count: linkItems.length })}
                </h2>
                <div className="space-y-4">
                  {linkItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-xl border border-earth-200 bg-earth-50 p-4 sm:flex-row sm:items-center"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          onClick={() => openLightbox(item.image_url, item.product_name)}
                          className="h-20 w-20 rounded-lg object-cover cursor-zoom-in"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-earth-200 text-earth-500 text-xs">
                          {t('platform.wishlist.noImage')}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-earth-900 truncate">{item.product_name}</h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-earth-600 hover:underline truncate block"
                        >
                          {item.url}
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {editingItemId === item.id ? (
                            <div className="w-full rounded-lg border border-earth-200 bg-white p-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={editForm.product_name}
                                  onChange={(e) => setEditForm((f) => ({ ...f, product_name: e.target.value }))}
                                  placeholder={t('platform.wishlist.editNamePh')}
                                  className="rounded border border-earth-300 px-2 py-1 text-sm sm:col-span-2"
                                />
                                <input
                                  type="url"
                                  value={editForm.url}
                                  onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                                  placeholder={t('platform.wishlist.editUrlPh')}
                                  className="rounded border border-earth-300 px-2 py-1 text-sm sm:col-span-2"
                                />
                                <input
                                  type="text"
                                  value={editForm.price}
                                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                                  placeholder={t('platform.wishlist.editPricePh')}
                                  className="rounded border border-earth-300 px-2 py-1 text-sm"
                                />
                                <select
                                  value={editForm.currency}
                                  onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
                                  className="rounded border border-earth-300 px-2 py-1 text-sm"
                                >
                                  <option value="JPY">JPY</option>
                                  <option value="BRL">BRL</option>
                                </select>
                                <input
                                  type="url"
                                  value={editForm.image_url}
                                  onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))}
                                  placeholder={t('platform.wishlist.editImagePh')}
                                  className="rounded border border-earth-300 px-2 py-1 text-sm sm:col-span-2"
                                />
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditItem(item)}
                                  className="text-sm font-medium text-earth-700 hover:underline"
                                >
                                  {t('platform.wishlist.save')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemId(null)
                                    setEditForm({ url: '', product_name: '', price: '', currency: 'JPY', image_url: '' })
                                  }}
                                  className="text-sm text-earth-600 hover:underline"
                                >
                                  {t('platform.wishlist.cancel')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-earth-900">
                                {formatMoney(item.price, item.currency)}
                              </span>
                              {getDesconto(item) != null && (
                                <span className="rounded bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                                  {t('platform.wishlist.discount', { pct: getDesconto(item) })}
                                </span>
                              )}
                              <span className="text-xs text-earth-500">
                                {t('platform.wishlist.updated')} {formatDate(item.last_checked_at)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdatePrice(item)}
                          disabled={updatingId === item.id}
                          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                        >
                          {updatingId === item.id ? t('platform.wishlist.updating') : t('platform.wishlist.refreshPrice')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                        >
                          {t('platform.wishlist.editItem')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(item.id)}
                          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          {t('platform.wishlist.remove')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ open: false, src: '', alt: '' })}
      />
    </>
  )
}
