/**
 * Meus Produtos - Inventário do usuário (itens recebidos).
 * Lista itens e permite selecionar para solicitar consolidação e envio.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getMyInventory, createShipment } from '../../services/inventoryService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

function daysSince(dateValue) {
  if (!dateValue) return null
  const ts = new Date(dateValue).getTime()
  if (!Number.isFinite(ts)) return null
  const diff = Date.now() - ts
  if (diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function MeusProdutos() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getCategory = (it) => {
    const order = it?.orders
    const orderSource = order?.order_source
    const orderModule = order?.order_module

    if (orderSource === 'store') return 'Loja Virtual'
    if (orderSource === 'service' && orderModule === 'assisted_buy') return 'Redirecionamento assistido'
    if (orderSource === 'service' && orderModule === 'self_buy') return 'Redirecionamento (eu compro)'
    if (orderSource === 'service') return 'Personal Shopping'
    return 'Outros'
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      const k = cacheKey(user.id, 'inventory_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setItems(Array.isArray(cached) ? cached : [])
        setLoading(false)
      }
      try {
        const { data, error } = await getMyInventory(user.id)
        if (!isActive) return
        setItems(data ?? [])
        writeCache(k, data ?? [])
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar itens')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map((i) => i.id)))
  }

  const selectedItems = items.filter((i) => selectedIds.has(i.id))

  const handleRequestShipment = async () => {
    if (selectedIds.size === 0) {
      setFeedback('Selecione pelo menos um item para solicitar o envio.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data, error } = await createShipment(user.id, [...selectedIds])
      if (error) {
        setFeedback(error.message || 'Erro ao solicitar envio')
        return
      }
      setFeedback('Solicitação de envio criada! Em breve definiremos o frete e você poderá pagar.')
      setSelectedIds(new Set())
      const { data: list } = await getMyInventory(user.id)
      setItems(list ?? [])
    } catch (e) {
      setFeedback(e?.message || 'Erro ao solicitar envio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Meus Produtos | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Meus produtos</h1>
        <p className="mt-2 text-earth-600">
          Itens recebidos e armazenados. Selecione os produtos que deseja enviar e solicite a consolidação e o envio. Após definirmos o frete, você poderá pagar na página Pedidos ou Carteira.
        </p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('criada') || feedback.includes('sucesso')
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && items.length === 0 && (
          <p className="mt-6 text-earth-600">
            Você ainda não tem itens no inventário. Quando seus pacotes forem recebidos e confirmados, eles aparecerão aqui.
          </p>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === items.length}
                      onChange={selectAll}
                      className="rounded border-earth-300"
                    />
                    <span className="text-sm font-medium text-earth-700">Selecionar todos</span>
                  </label>
                  <p className="text-sm text-earth-600">
                    Selecionados: <span className="font-medium text-earth-800">{selectedIds.size}</span>
                  </p>
                </div>

                {(() => {
                  const orderedCategories = [
                    'Loja Virtual',
                    'Redirecionamento assistido',
                    'Redirecionamento (eu compro)',
                    'Personal Shopping',
                    'Outros',
                  ]
                  const grouped = orderedCategories.reduce((acc, c) => {
                    acc[c] = []
                    return acc
                  }, {})

                  for (const it of items) {
                    const c = getCategory(it)
                    if (!grouped[c]) grouped[c] = []
                    grouped[c].push(it)
                  }

                  return orderedCategories
                    .filter((c) => grouped[c]?.length > 0)
                    .map((c) => (
                      <div key={c} className="mt-6">
                        <h3 className="text-base font-semibold text-earth-900">{c}</h3>
                        <p className="mt-1 text-sm text-earth-600">
                          Total: <span className="font-medium text-earth-800">{grouped[c].length}</span>
                        </p>
                        <ul className="mt-4 space-y-3">
                          {grouped[c].map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-start gap-4 rounded-xl border border-earth-200 bg-white p-4"
                            >
                              <label className="flex cursor-pointer items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(item.id)}
                                  onChange={() => toggleSelect(item.id)}
                                  className="mt-1 rounded border-earth-300"
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-earth-900">{item.name}</p>
                                  {item.products_description && (
                                    <p className="mt-1 text-sm text-earth-700">{item.products_description}</p>
                                  )}
                                  {item.notes && (
                                    <p className="mt-1 text-sm text-earth-600">{item.notes}</p>
                                  )}
                                  {(item.items_count != null || item.received_at) && (
                                    <p className="mt-1 text-xs text-earth-500">
                                      {item.items_count != null ? `Itens: ${item.items_count}` : ''}
                                      {item.items_count != null && item.received_at ? ' • ' : ''}
                                      {item.received_at
                                        ? `Armazenado há ${daysSince(item.received_at) ?? 0} dia(s)`
                                        : ''}
                                    </p>
                                  )}
                                  {item.weight_kg != null && (
                                    <p className="mt-1 text-xs text-earth-500">Peso: {item.weight_kg} kg</p>
                                  )}
                                  <span className="mt-1 inline-block rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-600">
                                    {item.status === 'stored' ? 'Armazenado' : 'Pronto para envio'}
                                  </span>
                                </div>
                              </label>
                              {(item.photo_url || item.video_url) && (
                                <div className="flex gap-2">
                                  {item.photo_url && (
                                    <a
                                      href={item.photo_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-earth-600 underline hover:text-earth-900"
                                    >
                                      Foto
                                    </a>
                                  )}
                                  {item.video_url && (
                                    <a
                                      href={item.video_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-earth-600 underline hover:text-earth-900"
                                    >
                                      Vídeo
                                    </a>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                })()}
              </section>

              <aside className="lg:col-span-1">
                <div className="sticky top-24 rounded-xl border border-earth-200 bg-earth-50 p-4">
                  <h2 className="text-base font-semibold text-earth-900">Carrinho de envio</h2>
                  <p className="mt-1 text-sm text-earth-600">
                    Selecione itens do inventário e solicite o envio.
                  </p>

                  {selectedItems.length === 0 ? (
                    <p className="mt-4 text-sm text-earth-600">
                      Nenhum item selecionado.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {selectedItems.map((it) => (
                        <li key={it.id} className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 border border-earth-200">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-earth-900">{it.name}</p>
                            {it.weight_kg != null && (
                              <p className="mt-0.5 text-xs text-earth-500">{it.weight_kg} kg</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleSelect(it.id)}
                            className="shrink-0 rounded border border-earth-300 px-2 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleRequestShipment}
                      disabled={selectedItems.length === 0 || submitting}
                      className="rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-50"
                    >
                      {submitting ? 'Enviando...' : `Solicitar envio (${selectedItems.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      disabled={selectedItems.length === 0 || submitting}
                      className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                    >
                      Limpar seleção
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  )
}
