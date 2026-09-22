import { useEffect, useMemo, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import {
  adminAddLiveRipPull,
  adminAdjustLiveRipStock,
  adminFinalizeLiveRipToInventory,
  adminListLiveRipEvents,
  adminListLiveRipProducts,
  adminListLiveRipReservations,
  adminSearchLiveRipCards,
  adminSetLiveRipReservationStatus,
  adminUpsertLiveRipCard,
  adminUpsertLiveRipEvent,
  adminUpsertLiveRipProduct,
} from '../../../../services/liveRipService'
import { getSystemSettings, saveSystemSettingsAdmin } from '../../../../services/settingsService'
import {
  ON_DEMAND_PRICE_MULTIPLIER_DEFAULT,
  resolveOnDemandPriceMultiplier,
} from '../../../../lib/onDemandPricing'

const STATUS_OPTIONS = ['reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged', 'cancelled']

function toLocalDateTime(value) {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR')
}

function initialEventForm() {
  return {
    id: '',
    slug: '',
    title: '',
    starts_at: '',
    status: 'scheduled',
    stream_url: '',
    cover_image_url: '',
    notes: '',
  }
}

function initialProductForm() {
  return {
    id: '',
    category_id: '',
    category_label_pt: '',
    category_label_en: '',
    name: '',
    name_en: '',
    type: '',
    language: 'Japanese',
    image_url: '',
    source: 'SNKRDUNK',
    collection_title: '',
    shrinkwrap_option: '',
    snkrdunk_apparel_id: '',
    popularity_rank: '',
    price_jpy: '',
    price_label: '',
    available_rips: '',
    is_active: true,
  }
}

export default function LiveRipsSection() {
  const { activeTab, setMessage } = useAdminContext()
  const [events, setEvents] = useState([])
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [activePanel, setActivePanel] = useState('operations')
  const [submittingId, setSubmittingId] = useState('')
  const [selectedReservationId, setSelectedReservationId] = useState('')
  const [eventForm, setEventForm] = useState(initialEventForm())
  const [productForm, setProductForm] = useState(initialProductForm())
  const [stockDelta, setStockDelta] = useState('1')
  const [stockReason, setStockReason] = useState('')
  const [finalizeNotes, setFinalizeNotes] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)
  const [cardQuery, setCardQuery] = useState('')
  const [cardCollectionFilter, setCardCollectionFilter] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)
  const [cardForm, setCardForm] = useState({
    id: '',
    collection_key: 'pokemon-sv',
    product_id: '',
    name: '',
    name_en: '',
    rarity: '',
    set_code: '',
    card_number: '',
    image_url: '',
    market_value_jpy: '',
    is_active: true,
  })
  const [onDemandMultiplierDraft, setOnDemandMultiplierDraft] = useState(String(ON_DEMAND_PRICE_MULTIPLIER_DEFAULT))
  const [onDemandMultiplierSaving, setOnDemandMultiplierSaving] = useState(false)

  const currentOpening = useMemo(
    () => rows.find((row) => row.status === 'opening') || rows.find((row) => row.status === 'waiting_live') || null,
    [rows]
  )

  const selectedProductId = productForm.id
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  )

  async function loadReservations() {
    const { data, error } = await adminListLiveRipReservations(300, 0)
    if (error) {
      setMessage(error.message || 'Erro ao carregar reservas do Live Rip')
      return
    }
    setRows(Array.isArray(data?.rows) ? data.rows : [])
  }

  async function loadEvents() {
    const { data, error } = await adminListLiveRipEvents(200, 0)
    if (error) {
      setMessage(error.message || 'Erro ao carregar lives')
      return
    }
    setEvents(Array.isArray(data) ? data : [])
  }

  async function loadProducts() {
    const { data, error } = await adminListLiveRipProducts({ limit: 1000, offset: 0, activeOnly: false })
    if (error) {
      setMessage(error.message || 'Erro ao carregar produtos')
      return
    }
    setProducts(Array.isArray(data) ? data : [])
  }

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadReservations(), loadEvents(), loadProducts()])
    setLoading(false)
  }

  useEffect(() => {
    if (activeTab !== 'live_rips_admin') return
    loadAll()
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'live_rips_admin') return
    let active = true
    ;(async () => {
      const { data, error } = await getSystemSettings()
      if (!active) return
      if (error) {
        setOnDemandMultiplierDraft(String(ON_DEMAND_PRICE_MULTIPLIER_DEFAULT))
        return
      }
      setOnDemandMultiplierDraft(String(resolveOnDemandPriceMultiplier(data)))
    })()
    return () => {
      active = false
    }
  }, [activeTab])

  async function handleSaveOnDemandMultiplier() {
    const next = resolveOnDemandPriceMultiplier(onDemandMultiplierDraft)
    setOnDemandMultiplierSaving(true)
    const { error } = await saveSystemSettingsAdmin({
      on_demand_price_multiplier: { amount: next },
    })
    setOnDemandMultiplierSaving(false)
    if (error) {
      setMessage(error.message || 'Falha ao salvar multiplicador On-Demand')
      return
    }
    setOnDemandMultiplierDraft(String(next))
    setMessage(`Multiplicador On-Demand salvo: ${next}×`)
  }

  async function handleStatusChange(row, nextStatus) {
    setSubmittingId(row.id)
    const { error } = await adminSetLiveRipReservationStatus(
      row.id,
      nextStatus,
      row.rip_code || `RIP-${String(row.id).slice(0, 8).toUpperCase()}`
    )
    setSubmittingId('')
    if (error) {
      setMessage(error.message || 'Falha ao atualizar status da reserva')
      return
    }
    await loadReservations()
    setMessage('Status da reserva atualizado')
  }

  async function searchCards(nextQuery = cardQuery, nextCollection = cardCollectionFilter) {
    setCardSearching(true)
    const { data, error } = await adminSearchLiveRipCards({
      query: nextQuery,
      collectionKey: nextCollection,
      limit: 40,
    })
    setCardSearching(false)
    if (error) {
      setMessage(error.message || 'Erro ao buscar cartas do catálogo')
      return
    }
    setCardResults(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    if (activeTab !== 'live_rips_admin') return
    if (activePanel !== 'operations' && activePanel !== 'cards') return
    const timer = window.setTimeout(() => {
      void searchCards(cardQuery, cardCollectionFilter)
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activePanel, cardQuery, cardCollectionFilter])

  async function handleRegisterPull(e) {
    e.preventDefault()
    if (!selectedReservationId) {
      setMessage('Selecione uma reserva antes de registrar um pull.')
      return
    }
    if (!selectedCard?.id) {
      setMessage('Selecione uma carta do catálogo.')
      return
    }
    const selected = rows.find((row) => row.id === selectedReservationId)
    if (!selected) {
      setMessage('Reserva selecionada não encontrada.')
      return
    }
    const payload = {
      reservation_id: selected.id,
      event_id: selected.event_id,
      card_pool_id: selectedCard.id,
    }
    const { error } = await adminAddLiveRipPull(payload)
    if (error) {
      setMessage(error.message || 'Falha ao registrar pull')
      return
    }
    setSelectedCard(null)
    setMessage('Pull registrado com sucesso.')
  }

  async function handleSaveCard(e) {
    e.preventDefault()
    const payload = {
      ...cardForm,
      market_value_jpy: cardForm.market_value_jpy ? Number(cardForm.market_value_jpy) : null,
      is_active: !!cardForm.is_active,
    }
    if (!payload.id) delete payload.id
    if (!payload.product_id) payload.product_id = null
    const { error } = await adminUpsertLiveRipCard(payload)
    if (error) {
      setMessage(error.message || 'Falha ao salvar carta')
      return
    }
    setCardForm({
      id: '',
      collection_key: cardForm.collection_key || 'pokemon-sv',
      product_id: '',
      name: '',
      name_en: '',
      rarity: '',
      set_code: '',
      card_number: '',
      image_url: '',
      market_value_jpy: '',
      is_active: true,
    })
    await searchCards()
    setMessage('Carta salva no catálogo.')
  }

  async function handleSaveEvent(e) {
    e.preventDefault()
    const payload = { ...eventForm }
    if (!payload.id) delete payload.id
    const { error } = await adminUpsertLiveRipEvent(payload)
    if (error) {
      setMessage(error.message || 'Falha ao salvar live')
      return
    }
    setEventForm(initialEventForm())
    await loadEvents()
    setMessage('Live salva com sucesso.')
  }

  async function handleSaveProduct(e) {
    e.preventDefault()
    const payload = {
      ...productForm,
      popularity_rank: productForm.popularity_rank ? Number(productForm.popularity_rank) : null,
      price_jpy: productForm.price_jpy ? Number(productForm.price_jpy) : 0,
      available_rips: productForm.available_rips ? Number(productForm.available_rips) : 0,
      is_active: !!productForm.is_active,
    }
    const { error } = await adminUpsertLiveRipProduct(payload)
    if (error) {
      setMessage(error.message || 'Falha ao salvar produto')
      return
    }
    await loadProducts()
    setMessage('Produto salvo com sucesso.')
  }

  async function handleAdjustStock() {
    if (!selectedProduct) {
      setMessage('Selecione um produto para ajustar estoque.')
      return
    }
    const delta = Number(stockDelta)
    if (!Number.isFinite(delta) || delta === 0) {
      setMessage('Informe um delta válido de estoque.')
      return
    }
    const { error } = await adminAdjustLiveRipStock(selectedProduct.id, delta, stockReason)
    if (error) {
      setMessage(error.message || 'Falha ao ajustar estoque')
      return
    }
    await loadProducts()
    setStockDelta('1')
    setStockReason('')
    setMessage('Estoque ajustado com sucesso.')
  }

  async function handleFinalizeToInventory() {
    if (!selectedReservationId) {
      setMessage('Selecione uma reserva para finalizar no inventário.')
      return
    }
    const { error } = await adminFinalizeLiveRipToInventory(selectedReservationId, finalizeNotes)
    if (error) {
      setMessage(error.message || 'Falha ao finalizar para inventário')
      return
    }
    setFinalizeNotes('')
    await loadReservations()
    setMessage('Reserva finalizada e enviada ao inventário.')
  }

  if (activeTab !== 'live_rips_admin') return null

  return (
    <section className="mt-4 rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Live Rips</h2>
          <p className="text-sm text-earth-600">Operação completa: lives, catálogo, fila, pulls e pós-live.</p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { id: 'operations', label: 'Operação ao vivo' },
          { id: 'events', label: 'Lives' },
          { id: 'products', label: 'Produtos e estoque' },
          { id: 'cards', label: 'Catálogo de cartas' },
          { id: 'on_demand', label: 'On-Demand' },
        ].map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => setActivePanel(panel.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              activePanel === panel.id
                ? 'border-earth-900 bg-earth-900 text-earth-50'
                : 'border-earth-300 bg-white text-earth-700'
            }`}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {activePanel === 'on_demand' ? (
        <div className="mt-4 max-w-xl rounded-xl border border-earth-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-base font-semibold text-earth-900">Preço On-Demand</h3>
          <p className="mt-1 text-sm text-earth-600">
            Todos os itens da aba On-Demand na Loja usam: preço original × multiplicador. Padrão: 1.15.
          </p>
          <label className="mt-4 block text-sm font-medium text-earth-800" htmlFor="on-demand-multiplier">
            Multiplicador
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="on-demand-multiplier"
              type="number"
              min="0.01"
              step="0.01"
              value={onDemandMultiplierDraft}
              onChange={(e) => setOnDemandMultiplierDraft(e.target.value)}
              className="w-36 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
            <span className="text-sm text-earth-600">×</span>
            <button
              type="button"
              onClick={handleSaveOnDemandMultiplier}
              disabled={onDemandMultiplierSaving}
              className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
            >
              {onDemandMultiplierSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <p className="mt-3 text-xs text-earth-500">
            Exemplo: ¥10.000 × {resolveOnDemandPriceMultiplier(onDemandMultiplierDraft)} = ¥
            {Math.round(10000 * resolveOnDemandPriceMultiplier(onDemandMultiplierDraft)).toLocaleString('pt-BR')}
          </p>
        </div>
      ) : null}

      {activePanel === 'operations' ? (
        <>
          {currentOpening ? (
            <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-800">
              <strong>Agora abrindo:</strong> {currentOpening.rip_code || '-'} - {currentOpening.customer_name || '-'}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-earth-200 text-earth-600">
                  <th className="px-3 py-2 font-semibold">Fila</th>
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold">Produto</th>
                  <th className="px-3 py-2 font-semibold">Pagamento</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-earth-600" colSpan={6}>Carregando reservas...</td>
                  </tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-earth-600" colSpan={6}>Nenhuma reserva encontrada para a live ativa.</td>
                  </tr>
                ) : null}
                {!loading ? rows.map((row) => (
                  <tr key={row.id} className="border-b border-earth-100 align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-earth-900">{row.queue_position || '-'}</div>
                      <div className="text-xs text-earth-500">{row.rip_code || '-'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-earth-900">{row.customer_name || '-'}</div>
                      <div className="text-xs text-earth-500">{toLocalDateTime(row.created_at)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-earth-900">{row.product_name_en || row.product_name || row.product_id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-earth-900">{row.payment_status}</div>
                      <div className="text-xs text-earth-500">{row.payment_provider || '-'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.status}
                        onChange={(e) => handleStatusChange(row, e.target.value)}
                        disabled={submittingId === row.id}
                        className="rounded border border-earth-300 bg-white px-2 py-1 text-xs text-earth-800"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-earth-600">
                      {submittingId === row.id ? 'Salvando...' : 'Atualização instantânea'}
                    </td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <form onSubmit={handleRegisterPull} className="rounded-lg border border-earth-200 bg-earth-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Registrar Pull</h3>
              <div className="mt-3 grid gap-3">
                <select
                  value={selectedReservationId}
                  onChange={(e) => setSelectedReservationId(e.target.value)}
                  className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                >
                  <option value="">Selecione a reserva</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {(row.rip_code || row.id.slice(0, 8))} - {row.customer_name || '-'}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="search"
                    value={cardQuery}
                    onChange={(e) => setCardQuery(e.target.value)}
                    placeholder="Buscar carta (nome, raridade, set...)"
                    className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                  />
                  <input
                    type="text"
                    value={cardCollectionFilter}
                    onChange={(e) => setCardCollectionFilter(e.target.value)}
                    placeholder="Coleção"
                    className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                  />
                </div>
                {selectedCard ? (
                  <div className="flex items-center gap-3 rounded border border-earth-300 bg-white p-2">
                    {selectedCard.image_url ? (
                      <img
                        src={selectedCard.image_url}
                        alt={selectedCard.name_en || selectedCard.name}
                        className="h-16 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-12 items-center justify-center rounded bg-earth-100 text-[10px] text-earth-500">
                        N/A
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-earth-900">
                        {selectedCard.name_en || selectedCard.name}
                      </p>
                      <p className="text-xs text-earth-600">
                        {selectedCard.rarity || '-'} · {selectedCard.collection_key}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCard(null)}
                      className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-700"
                    >
                      Limpar
                    </button>
                  </div>
                ) : null}
                <div className="max-h-56 overflow-y-auto rounded border border-earth-200 bg-white">
                  {cardSearching ? (
                    <p className="p-3 text-xs text-earth-500">Buscando...</p>
                  ) : cardResults.length ? (
                    cardResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedCard(card)}
                        className={`flex w-full items-center gap-3 border-b border-earth-100 px-3 py-2 text-left hover:bg-earth-50 ${
                          selectedCard?.id === card.id ? 'bg-earth-100' : ''
                        }`}
                      >
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.name_en || card.name}
                            className="h-12 w-9 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-9 items-center justify-center rounded bg-earth-100 text-[10px] text-earth-500">
                            N/A
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-earth-900">
                            {card.name_en || card.name}
                          </p>
                          <p className="text-xs text-earth-600">
                            {card.rarity || '-'} · {card.set_code || '-'} #{card.card_number || '-'}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-earth-500">Nenhuma carta encontrada. Cadastre no painel Catálogo de cartas.</p>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={!selectedCard?.id || !selectedReservationId}
                className="mt-3 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-50"
              >
                Salvar pull
              </button>
            </form>

            <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Pós-live</h3>
              <p className="mt-2 text-xs text-earth-600">
                Move a Rip já registrada (`cards_logged`) para inventário do cliente.
              </p>
              <textarea
                value={finalizeNotes}
                onChange={(e) => setFinalizeNotes(e.target.value)}
                rows={3}
                placeholder="Observações para inventário (opcional)"
                className="mt-3 w-full rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <button
                type="button"
                onClick={handleFinalizeToInventory}
                className="mt-3 rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-100"
              >
                Finalizar no inventário
              </button>
            </div>
          </div>
        </>
      ) : null}

      {activePanel === 'cards' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form onSubmit={handleSaveCard} className="rounded-lg border border-earth-200 bg-earth-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">
              {cardForm.id ? 'Editar carta' : 'Nova carta'}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={cardForm.collection_key}
                onChange={(e) => setCardForm((prev) => ({ ...prev, collection_key: e.target.value }))}
                placeholder="collection_key"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                value={cardForm.product_id}
                onChange={(e) => setCardForm((prev) => ({ ...prev, product_id: e.target.value }))}
                placeholder="product_id (opcional)"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cardForm.name}
                onChange={(e) => setCardForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome (JP/original)"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                value={cardForm.name_en}
                onChange={(e) => setCardForm((prev) => ({ ...prev, name_en: e.target.value }))}
                placeholder="Nome EN"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cardForm.rarity}
                onChange={(e) => setCardForm((prev) => ({ ...prev, rarity: e.target.value }))}
                placeholder="Raridade"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={cardForm.market_value_jpy}
                onChange={(e) => setCardForm((prev) => ({ ...prev, market_value_jpy: e.target.value }))}
                placeholder="Valor JPY"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cardForm.set_code}
                onChange={(e) => setCardForm((prev) => ({ ...prev, set_code: e.target.value }))}
                placeholder="Set code"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cardForm.card_number}
                onChange={(e) => setCardForm((prev) => ({ ...prev, card_number: e.target.value }))}
                placeholder="Card number"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="url"
                value={cardForm.image_url}
                onChange={(e) => setCardForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="URL da imagem"
                className="sm:col-span-2 rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-earth-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={!!cardForm.is_active}
                  onChange={(e) => setCardForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Ativa no catálogo
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
              >
                Salvar carta
              </button>
              {cardForm.id ? (
                <button
                  type="button"
                  onClick={() =>
                    setCardForm({
                      id: '',
                      collection_key: 'pokemon-sv',
                      product_id: '',
                      name: '',
                      name_en: '',
                      rarity: '',
                      set_code: '',
                      card_number: '',
                      image_url: '',
                      market_value_jpy: '',
                      is_active: true,
                    })
                  }
                  className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm text-earth-800"
                >
                  Nova
                </button>
              ) : null}
            </div>
          </form>

          <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Cartas cadastradas</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="search"
                value={cardQuery}
                onChange={(e) => setCardQuery(e.target.value)}
                placeholder="Filtrar..."
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cardCollectionFilter}
                onChange={(e) => setCardCollectionFilter(e.target.value)}
                placeholder="Coleção"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
              {cardResults.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() =>
                    setCardForm({
                      id: card.id,
                      collection_key: card.collection_key || '',
                      product_id: card.product_id || '',
                      name: card.name || '',
                      name_en: card.name_en || '',
                      rarity: card.rarity || '',
                      set_code: card.set_code || '',
                      card_number: card.card_number || '',
                      image_url: card.image_url || '',
                      market_value_jpy: card.market_value_jpy != null ? String(card.market_value_jpy) : '',
                      is_active: card.is_active !== false,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded border border-earth-200 bg-white p-2 text-left hover:bg-earth-100"
                >
                  {card.image_url ? (
                    <img src={card.image_url} alt="" className="h-14 w-10 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-10 items-center justify-center rounded bg-earth-100 text-[10px]">N/A</div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-earth-900">{card.name_en || card.name}</p>
                    <p className="text-xs text-earth-600">
                      {card.collection_key} · {card.rarity || '-'} · ¥
                      {Number(card.market_value_jpy || 0).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </button>
              ))}
              {!cardResults.length ? (
                <p className="text-sm text-earth-600">Nenhuma carta. Aplique a migration 142 para o seed demo.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activePanel === 'events' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form onSubmit={handleSaveEvent} className="rounded-lg border border-earth-200 bg-earth-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Criar/editar live</h3>
            <div className="mt-3 grid gap-3">
              <input
                type="text"
                value={eventForm.id}
                onChange={(e) => setEventForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="ID (deixe vazio para criar)"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <input
                type="text"
                value={eventForm.slug}
                onChange={(e) => setEventForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="slug"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                required
              />
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Título da live"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                required
              />
              <input
                type="datetime-local"
                value={eventForm.starts_at}
                onChange={(e) => setEventForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <select
                value={eventForm.status}
                onChange={(e) => setEventForm((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              >
                <option value="draft">draft</option>
                <option value="scheduled">scheduled</option>
                <option value="live">live</option>
                <option value="completed">completed</option>
              </select>
              <input
                type="url"
                value={eventForm.stream_url}
                onChange={(e) => setEventForm((prev) => ({ ...prev, stream_url: e.target.value }))}
                placeholder="URL da transmissão"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <input
                type="url"
                value={eventForm.cover_image_url}
                onChange={(e) => setEventForm((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                placeholder="URL da capa"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <textarea
                value={eventForm.notes}
                onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas"
                rows={3}
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
            </div>
            <button type="submit" className="mt-3 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800">
              Salvar live
            </button>
          </form>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Lives cadastradas</h3>
            <div className="mt-3 space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setEventForm({
                    id: event.id,
                    slug: event.slug || '',
                    title: event.title || '',
                    starts_at: event.starts_at ? String(event.starts_at).slice(0, 16) : '',
                    status: event.status || 'scheduled',
                    stream_url: event.stream_url || '',
                    cover_image_url: event.cover_image_url || '',
                    notes: event.notes || '',
                  })}
                  className="block w-full rounded border border-earth-200 bg-earth-50 px-3 py-2 text-left text-sm text-earth-800 hover:bg-earth-100"
                >
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-xs text-earth-600">{event.status} • {toLocalDateTime(event.starts_at)}</div>
                  <div className="text-xs text-earth-500">{event.reservations_count || 0} reservas</div>
                </button>
              ))}
              {!events.length ? <p className="text-sm text-earth-600">Nenhuma live cadastrada.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {activePanel === 'products' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form onSubmit={handleSaveProduct} className="rounded-lg border border-earth-200 bg-earth-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Criar/editar produto</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={productForm.id}
                onChange={(e) => setProductForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="ID do produto"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800 md:col-span-2"
                required
              />
              <input
                type="text"
                value={productForm.category_id}
                onChange={(e) => setProductForm((prev) => ({ ...prev, category_id: e.target.value }))}
                placeholder="category_id"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                required
              />
              <input
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome JP"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                required
              />
              <input
                type="text"
                value={productForm.name_en}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name_en: e.target.value }))}
                placeholder="Nome EN"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <input
                type="number"
                value={productForm.price_jpy}
                onChange={(e) => setProductForm((prev) => ({ ...prev, price_jpy: e.target.value }))}
                placeholder="price_jpy"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <input
                type="number"
                value={productForm.available_rips}
                onChange={(e) => setProductForm((prev) => ({ ...prev, available_rips: e.target.value }))}
                placeholder="available_rips"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <input
                type="number"
                value={productForm.popularity_rank}
                onChange={(e) => setProductForm((prev) => ({ ...prev, popularity_rank: e.target.value }))}
                placeholder="popularity_rank"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              />
              <select
                value={productForm.shrinkwrap_option}
                onChange={(e) => setProductForm((prev) => ({ ...prev, shrinkwrap_option: e.target.value }))}
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
              >
                <option value="">shrinkwrap_option</option>
                <option value="with">with</option>
                <option value="without">without</option>
              </select>
              <input
                type="url"
                value={productForm.image_url}
                onChange={(e) => setProductForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="URL imagem"
                className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800 md:col-span-2"
              />
              <label className="inline-flex items-center gap-2 text-sm text-earth-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={!!productForm.is_active}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Produto ativo
              </label>
            </div>
            <button type="submit" className="mt-3 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800">
              Salvar produto
            </button>
          </form>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Catálogo interno</h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setProductForm({
                    id: product.id || '',
                    category_id: product.category_id || '',
                    category_label_pt: product.category_label_pt || '',
                    category_label_en: product.category_label_en || '',
                    name: product.name || '',
                    name_en: product.name_en || '',
                    type: product.type || '',
                    language: product.language || 'Japanese',
                    image_url: product.image_url || '',
                    source: product.source || 'SNKRDUNK',
                    collection_title: product.collection_title || '',
                    shrinkwrap_option: product.shrinkwrap_option || '',
                    snkrdunk_apparel_id: product.snkrdunk_apparel_id || '',
                    popularity_rank: product.popularity_rank ?? '',
                    price_jpy: product.price_jpy ?? '',
                    price_label: product.price_label || '',
                    available_rips: product.available_rips ?? '',
                    is_active: !!product.is_active,
                  })}
                  className="block w-full rounded border border-earth-200 bg-earth-50 px-3 py-2 text-left text-sm text-earth-800 hover:bg-earth-100"
                >
                  <div className="font-semibold">{product.name_en || product.name || product.id}</div>
                  <div className="text-xs text-earth-600">{product.id} • estoque {product.available_rips || 0}</div>
                </button>
              ))}
              {!products.length ? <p className="text-sm text-earth-600">Nenhum produto cadastrado.</p> : null}
            </div>

            <div className="mt-4 rounded border border-earth-200 bg-earth-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-700">Ajuste rápido de estoque</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr,140px]">
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="Motivo"
                  className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                />
                <input
                  type="number"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  className="rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
                />
              </div>
              <button
                type="button"
                onClick={handleAdjustStock}
                className="mt-2 rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-100"
              >
                Aplicar delta no produto selecionado
              </button>
              {selectedProduct ? (
                <p className="mt-2 text-xs text-earth-600">
                  Produto alvo: <strong>{selectedProduct.name_en || selectedProduct.name || selectedProduct.id}</strong>
                </p>
              ) : (
                <p className="mt-2 text-xs text-earth-600">Selecione um produto na lista para ajustar estoque.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
