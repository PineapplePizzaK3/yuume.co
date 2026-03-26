/**
 * Lista de Desejos - Itens adicionados por link.
 * Usuário cola a URL do produto; o sistema extrai nome e preço.
 * Preços são atualizáveis para detectar promoções.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  getWishlistLinks,
  addWishlistLink,
  updateWishlistLink,
  removeWishlistLink,
  scrapeProductUrl,
} from '../../services/wishlistLinkService'
import { useAuth } from '../../hooks/useAuth'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

function formatMoney(v, currency = 'JPY') {
  if (v == null) return '—'
  const curr = currency === 'BRL' ? 'BRL' : 'JPY'
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  const { user } = useAuth()
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
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [editPriceValue, setEditPriceValue] = useState('')

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
      if (error) setMessage(error.message || 'Erro ao carregar lista')
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar lista')
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
  }, [user?.id])

  const doAddItem = async (url, product_name, price, currency = 'JPY', image_url = null) => {
    if (!user?.id) {
      setMessage('Faça login para adicionar itens.')
      return
    }
    setAdding(true)
    setMessage('')
    const { error } = await addWishlistLink(user.id, {
      url,
      product_name: product_name || 'Produto',
      price: parsePriceInput(price),
      currency: currency || 'JPY',
      image_url: image_url || null,
    })
    setAdding(false)
    if (error) {
      setMessage(error.message || 'Erro ao adicionar')
      return
    }
    setUrlInput('')
    setManualUrl('')
    setManualName('')
    setManualPrice('')
    setShowManual(false)
    setMessage('Item adicionado!')
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
      setMessage(error.message || 'Erro ao obter dados do produto')
      setShowManual(true)
      setManualUrl(url)
      setAdding(false)
      return
    }
    await doAddItem(
      url,
      data.name || 'Produto',
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
      setMessage(error.message || 'Erro ao atualizar. Use "Editar preço" para atualizar manualmente.')
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
      setMessage(updateErr.message || 'Erro ao atualizar')
      return
    }
    setMessage('Preço atualizado!')
    load()
  }

  const handleEditPrice = (item) => {
    setEditingPriceId(item.id)
    setEditPriceValue(item.price != null ? String(item.price) : '')
  }

  const handleSaveEditPrice = async (item) => {
    const newPrice = editPriceValue.trim() ? parsePriceInput(editPriceValue) : null
    if (newPrice == null && editPriceValue.trim()) {
      setMessage('Preço inválido')
      return
    }
    setMessage('')
    const { error } = await updateWishlistLink(user.id, item.id, {
      product_name: item.product_name,
      price: newPrice,
      previous_price: item.price,
      image_url: item.image_url,
    })
    setEditingPriceId(null)
    setEditPriceValue('')
    if (error) {
      setMessage(error.message || 'Erro ao atualizar')
      return
    }
    setMessage('Preço atualizado!')
    load()
  }

  const handleRemoveLink = async (id) => {
    const { error } = await removeWishlistLink(user.id, id)
    setMessage(error ? error.message : 'Removido')
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

  return (
    <>
      <Helmet>
        <title>Lista de Desejos | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Lista de Desejos</h1>
        <p className="mt-2 text-earth-600">
          Adicione itens pelo link e acompanhe os preços. Apenas links de produtos externos — para comprar itens da loja, use a Central de Pagamentos.
        </p>

        {/* Adicionar por link */}
        <div className="mt-6 space-y-4">
          <form onSubmit={handleAddByUrl}>
            <label htmlFor="url" className="block text-sm font-medium text-earth-700">
              Adicionar item (cole o link do produto)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400"
              />
              <button
                type="submit"
                disabled={adding}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {adding ? 'Buscando...' : 'Buscar e adicionar'}
              </button>
            </div>
          </form>
          <button
            type="button"
            onClick={() => (showManual ? setShowManual(false) : handleOpenManual())}
            className="text-sm text-earth-600 hover:text-earth-900 underline"
          >
            {showManual ? 'Ocultar' : 'Ou adicionar manualmente (link, nome e preço)'}
          </button>
          {showManual && (
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
              <p className="mb-3 text-sm font-medium text-earth-800">Adicionar manualmente:</p>
              <p className="mb-3 text-xs text-earth-600">
                Os itens entram na sua lista abaixo. Você pode ter quantos itens quiser e atualizar o preço quando quiser.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-earth-700">Link do produto *</label>
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-earth-700">Nome do produto *</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ex: Tênis Nike Air Max"
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-earth-700">Preço (opcional)</label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Ex: 15000"
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = manualUrl.trim()
                    if (!url) {
                      setMessage('Informe o link do produto.')
                      return
                    }
                    if (!manualName.trim()) {
                      setMessage('Informe o nome do produto.')
                      return
                    }
                    doAddItem(url, manualName.trim(), manualPrice.trim())
                  }}
                  disabled={adding}
                  className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-700 disabled:opacity-60"
                >
                  Adicionar à lista
                </button>
              </div>
            </div>
          )}
        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && !hasItems && (
          <p className="mt-6 text-earth-600">Sua lista de desejos está vazia. Cole um link acima para começar.</p>
        )}

        {!loading && hasItems && (
          <div className="mt-8 space-y-6">
            {linkItems.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-earth-700">
                  Sua lista ({linkItems.length} {linkItems.length === 1 ? 'item' : 'itens'})
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
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-earth-200 text-earth-500 text-xs">
                          Sem imagem
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
                          {editingPriceId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                placeholder="Ex: 15000"
                                className="w-24 rounded border border-earth-300 px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditPrice(item)}
                                className="text-sm font-medium text-earth-700 hover:underline"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingPriceId(null); setEditPriceValue('') }}
                                className="text-sm text-earth-600 hover:underline"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-earth-900">
                                {formatMoney(item.price, item.currency)}
                              </span>
                              {getDesconto(item) != null && (
                                <span className="rounded bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                                  {getDesconto(item)}% de desconto
                                </span>
                              )}
                              <span className="text-xs text-earth-500">
                                Atualizado: {formatDate(item.last_checked_at)}
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
                          {updatingId === item.id ? 'Atualizando...' : 'Atualizar preço'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPrice(item)}
                          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                        >
                          Editar preço
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(item.id)}
                          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Remover
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
    </>
  )
}
