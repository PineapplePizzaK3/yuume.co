import { useEffect, useMemo, useState } from 'react'
import { adminListLiveRipProducts } from '../../../../services/liveRipService'
import {
  adminAddCollectorPull,
  adminCancelCollectorPsaGrading,
  adminCompleteCollectorPsaGrading,
  adminDeleteCollectorPull,
  adminListCollectorAllocations,
  adminListCollectorBatches,
  adminListCollectorGradingQueue,
  adminListCollectorPulls,
  adminListCollectorSessions,
  adminListOpeningTopCardOverrides,
  adminPublishCollectorSession,
  adminSetCollectorBatchStatus,
  adminUpsertOpeningTopCardOverride,
  adminUpsertCollectorBatch,
  adminUpsertCollectorSession,
} from '../../../../services/adminCollectorService'
import { COLLECTION_TOP_CARDS } from '../../../../data/collectionTopCards'

const BATCH_STATUSES = ['OPEN', 'FULL', 'LOCKED', 'SCHEDULED', 'OPENING', 'COMPLETED', 'FULFILLING', 'CANCELLED']
const SESSION_STATUSES = ['SCHEDULED', 'RECORDING', 'PUBLISHED', 'CANCELLED']

const EMPTY_BATCH_FORM = {
  id: '',
  code: '',
  product_id: '',
  game: '',
  physical_box_code: '',
  total_positions: '1',
  price_per_position_jpy: '0',
  status: 'OPEN',
  opens_at: '',
  notes: '',
}

const EMPTY_SESSION_FORM = {
  id: '',
  status: 'SCHEDULED',
  video_url: '',
  recorded_at: '',
}

const EMPTY_PULL_FORM = {
  allocation_id: '',
  card_name: '',
  rarity: '',
  image_url: '',
  market_value_jpy: '',
  is_highlight: false,
}

function isoDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function toIsoOrNull(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function normalizeCollectionKey(productId) {
  return String(productId || '').trim().replace(/-no-shrink$/i, '')
}

export default function AberturasSection({ activeTab }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [allocations, setAllocations] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [pulls, setPulls] = useState([])
  const [gradingQueue, setGradingQueue] = useState([])
  const [gradingDrafts, setGradingDrafts] = useState({})
  const [gradingLoading, setGradingLoading] = useState(false)
  const [topCardOverrides, setTopCardOverrides] = useState([])
  const [topCardDrafts, setTopCardDrafts] = useState({})
  const [topCardsLoading, setTopCardsLoading] = useState(false)
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH_FORM)
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION_FORM)
  const [pullForm, setPullForm] = useState(EMPTY_PULL_FORM)

  const selectedBatch = useMemo(
    () => batches.find((row) => row.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  )
  const selectedCollectionKey = useMemo(
    () => normalizeCollectionKey(selectedBatch?.product_id || ''),
    [selectedBatch]
  )
  const selectedTopCardsEntry = useMemo(
    () => (selectedCollectionKey ? COLLECTION_TOP_CARDS[selectedCollectionKey] || null : null),
    [selectedCollectionKey]
  )
  const topCardsRows = useMemo(() => {
    const baseCards = Array.isArray(selectedTopCardsEntry?.cards) ? selectedTopCardsEntry.cards : []
    const overrideById = new Map()
    ;(topCardOverrides || []).forEach((item) => {
      const id = String(item?.snkrdunk_id || '').trim()
      if (!id) return
      overrideById.set(id, item)
    })
    return baseCards.map((card) => {
      const id = String(card?.snkrdunkId || '').trim()
      const override = overrideById.get(id) || null
      const overridePrice = Number(override?.price_jpy_override)
      return {
        ...card,
        hidden: Boolean(override?.hidden),
        pinned: Boolean(override?.pinned),
        overridePrice: Number.isFinite(overridePrice) ? overridePrice : '',
      }
    })
  }, [selectedTopCardsEntry, topCardOverrides])

  useEffect(() => {
    if (activeTab !== 'aberturas_admin') return
    let active = true
    setLoading(true)
    setError('')
    setMessage('')
    void Promise.all([adminListCollectorBatches(), adminListLiveRipProducts({ activeOnly: true, limit: 1000 })])
      .then(([batchesRes, productsRes]) => {
        if (!active) return
        if (batchesRes.error) {
          setError(batchesRes.error.message || 'Nao foi possivel carregar aberturas.')
          setBatches([])
        } else {
          const rows = Array.isArray(batchesRes.data) ? batchesRes.data : []
          setBatches(rows)
          if (!selectedBatchId && rows[0]?.id) {
            setSelectedBatchId(rows[0].id)
          }
        }
        if (!productsRes.error) {
          setProducts(Array.isArray(productsRes.data) ? productsRes.data : [])
        }
        void refreshGradingQueue()
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, selectedBatchId])

  useEffect(() => {
    if (activeTab !== 'aberturas_admin' || !selectedBatchId) return
    let active = true
    void Promise.all([
      adminListCollectorAllocations(selectedBatchId),
      adminListCollectorSessions(selectedBatchId),
    ]).then(([allocRes, sessRes]) => {
      if (!active) return
      setAllocations(Array.isArray(allocRes?.data?.rows) ? allocRes.data.rows : [])
      const rows = Array.isArray(sessRes?.data) ? sessRes.data : []
      setSessions(rows)
      if (!selectedSessionId && rows[0]?.id) setSelectedSessionId(rows[0].id)
    })
    return () => {
      active = false
    }
  }, [activeTab, selectedBatchId, selectedSessionId])

  useEffect(() => {
    if (activeTab !== 'aberturas_admin' || !selectedSessionId) {
      setPulls([])
      return
    }
    let active = true
    void adminListCollectorPulls(selectedSessionId).then((res) => {
      if (!active) return
      setPulls(Array.isArray(res?.data) ? res.data : [])
    })
    return () => {
      active = false
    }
  }, [activeTab, selectedSessionId])

  useEffect(() => {
    if (activeTab !== 'aberturas_admin' || !selectedCollectionKey) {
      setTopCardOverrides([])
      setTopCardDrafts({})
      return
    }
    let active = true
    setTopCardsLoading(true)
    void adminListOpeningTopCardOverrides(selectedCollectionKey)
      .then((res) => {
        if (!active) return
        setTopCardOverrides(Array.isArray(res?.data) ? res.data : [])
      })
      .finally(() => {
        if (active) setTopCardsLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, selectedCollectionKey])

  if (activeTab !== 'aberturas_admin') return null

  const refreshBatches = async () => {
    const res = await adminListCollectorBatches()
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel atualizar aberturas.')
      return
    }
    const rows = Array.isArray(res.data) ? res.data : []
    setBatches(rows)
    if (!rows.some((row) => row.id === selectedBatchId)) {
      setSelectedBatchId(rows[0]?.id || '')
    }
  }

  const refreshGradingQueue = async () => {
    setGradingLoading(true)
    const res = await adminListCollectorGradingQueue()
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel carregar fila de grading.')
      setGradingLoading(false)
      return
    }
    setGradingQueue(Array.isArray(res.data) ? res.data : [])
    setGradingLoading(false)
  }

  const handleSaveBatch = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    const payload = {
      id: batchForm.id || undefined,
      code: batchForm.code,
      product_id: batchForm.product_id,
      game: batchForm.game || null,
      physical_box_code: batchForm.physical_box_code || null,
      total_positions: Number(batchForm.total_positions || 1),
      price_per_position_jpy: Number(batchForm.price_per_position_jpy || 0),
      status: batchForm.status,
      opens_at: toIsoOrNull(batchForm.opens_at),
      notes: batchForm.notes || null,
    }
    const res = await adminUpsertCollectorBatch(payload)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel salvar abertura.')
      return
    }
    setMessage('Abertura salva com sucesso.')
    setBatchForm(EMPTY_BATCH_FORM)
    await refreshBatches()
  }

  const handleSetBatchStatus = async (status) => {
    if (!selectedBatchId) return
    setError('')
    const res = await adminSetCollectorBatchStatus(selectedBatchId, status)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel atualizar status da abertura.')
      return
    }
    setMessage('Status atualizado.')
    await refreshBatches()
  }

  const handleSaveSession = async (event) => {
    event.preventDefault()
    if (!selectedBatchId) return
    setError('')
    const payload = {
      id: sessionForm.id || undefined,
      batch_id: selectedBatchId,
      status: sessionForm.status,
      video_url: sessionForm.video_url || null,
      recorded_at: toIsoOrNull(sessionForm.recorded_at),
    }
    const res = await adminUpsertCollectorSession(payload)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel salvar sessao.')
      return
    }
    setMessage('Sessao salva com sucesso.')
    setSessionForm(EMPTY_SESSION_FORM)
    const sessRes = await adminListCollectorSessions(selectedBatchId)
    const rows = Array.isArray(sessRes?.data) ? sessRes.data : []
    setSessions(rows)
    if (rows[0]?.id) setSelectedSessionId(rows[0].id)
  }

  const handlePublishSession = async () => {
    if (!selectedSessionId) return
    setError('')
    const res = await adminPublishCollectorSession(selectedSessionId)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel publicar sessao.')
      return
    }
    setMessage('Sessao publicada e card assets gerados.')
    const sessRes = await adminListCollectorSessions(selectedBatchId)
    setSessions(Array.isArray(sessRes?.data) ? sessRes.data : [])
    await refreshBatches()
  }

  const handleAddPull = async (event) => {
    event.preventDefault()
    if (!selectedSessionId || !pullForm.card_name.trim()) return
    setError('')
    const res = await adminAddCollectorPull({
      session_id: selectedSessionId,
      allocation_id: pullForm.allocation_id || null,
      card_name: pullForm.card_name,
      rarity: pullForm.rarity || null,
      image_url: pullForm.image_url || null,
      market_value_jpy: pullForm.market_value_jpy || null,
      is_highlight: pullForm.is_highlight,
    })
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel adicionar pull.')
      return
    }
    setMessage('Pull adicionado.')
    setPullForm(EMPTY_PULL_FORM)
    const pullsRes = await adminListCollectorPulls(selectedSessionId)
    setPulls(Array.isArray(pullsRes?.data) ? pullsRes.data : [])
  }

  const handleDeletePull = async (pullId) => {
    if (!pullId) return
    setError('')
    const res = await adminDeleteCollectorPull(pullId)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel remover pull.')
      return
    }
    setMessage('Pull removido.')
    const pullsRes = await adminListCollectorPulls(selectedSessionId)
    setPulls(Array.isArray(pullsRes?.data) ? pullsRes.data : [])
  }

  const handleCompletePsa = async (assetId) => {
    if (!assetId) return
    const draft = gradingDrafts[assetId] || {}
    setError('')
    const res = await adminCompleteCollectorPsaGrading(assetId, {
      psa_grade: String(draft.psa_grade || '').trim() || null,
      psa_cert_number: String(draft.psa_cert_number || '').trim() || null,
      action_note: String(draft.action_note || '').trim() || null,
    })
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel concluir grading.')
      return
    }
    setMessage('Grading PSA concluido.')
    setGradingDrafts((prev) => {
      const next = { ...prev }
      delete next[assetId]
      return next
    })
    await refreshGradingQueue()
  }

  const handleCancelPsa = async (assetId) => {
    if (!assetId) return
    const reason = String(gradingDrafts[assetId]?.cancel_reason || '').trim()
    setError('')
    const res = await adminCancelCollectorPsaGrading(assetId, reason)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel cancelar grading.')
      return
    }
    setMessage('Solicitacao de grading cancelada.')
    await refreshGradingQueue()
  }

  const handleSaveTopCardOverride = async (card) => {
    if (!selectedCollectionKey || !card?.snkrdunkId) return
    const draft = topCardDrafts[card.snkrdunkId] || {}
    const payload = {
      collection_key: selectedCollectionKey,
      snkrdunk_id: card.snkrdunkId,
      hidden: draft.hidden ?? card.hidden ?? false,
      pinned: draft.pinned ?? card.pinned ?? false,
      price_jpy_override:
        draft.overridePrice === ''
          ? null
          : Number.isFinite(Number(draft.overridePrice))
            ? Number(draft.overridePrice)
            : null,
    }
    const res = await adminUpsertOpeningTopCardOverride(payload)
    if (res.error) {
      setError(res.error.message || 'Nao foi possivel salvar ajuste da carta.')
      return
    }
    setMessage('Ajuste de carta salvo.')
    const refresh = await adminListOpeningTopCardOverrides(selectedCollectionKey)
    setTopCardOverrides(Array.isArray(refresh?.data) ? refresh.data : [])
    setTopCardDrafts((prev) => {
      const next = { ...prev }
      delete next[card.snkrdunkId]
      return next
    })
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Aberturas</h2>
      {loading ? <p className="mt-2 text-sm text-earth-600">Carregando...</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-800">{error}</p> : null}
      {message ? <p className="mt-3 rounded-lg bg-green-100 px-4 py-2 text-sm text-green-800">{message}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-earth-200 bg-white p-4">
          <h3 className="font-medium text-earth-900">Nova abertura</h3>
          <form onSubmit={handleSaveBatch} className="mt-3 grid gap-3">
            <input
              value={batchForm.code}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="Codigo (ex: ABR-001)"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
              required
            />
            <select
              value={batchForm.product_id}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, product_id: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name || product.id}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={batchForm.total_positions}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, total_positions: e.target.value }))}
                type="number"
                min={1}
                placeholder="Posicoes"
                className="rounded border border-earth-300 px-3 py-2 text-sm"
                required
              />
              <input
                value={batchForm.price_per_position_jpy}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, price_per_position_jpy: e.target.value }))}
                type="number"
                min={0}
                placeholder="Preco JPY"
                className="rounded border border-earth-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <select
              value={batchForm.status}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, status: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            >
              {BATCH_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <input
              value={batchForm.opens_at}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, opens_at: e.target.value }))}
              type="datetime-local"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <input
              value={batchForm.physical_box_code}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, physical_box_code: e.target.value }))}
              placeholder="Codigo da box fisica"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <textarea
              value={batchForm.notes}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Observacoes"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
              rows={3}
            />
            <button type="submit" className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
              Salvar abertura
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-earth-200 bg-white p-4">
          <h3 className="font-medium text-earth-900">Aberturas cadastradas</h3>
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => setSelectedBatchId(batch.id)}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedBatchId === batch.id ? 'border-earth-900 bg-earth-100' : 'border-earth-200 bg-white'}`}
              >
                <p className="font-medium text-earth-900">{batch.code}</p>
                <p className="text-xs text-earth-600">
                  {batch.product_name || batch.product_id} • {batch.reserved_positions}/{batch.total_positions} • {batch.status}
                </p>
              </button>
            ))}
          </div>
          {selectedBatch ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {BATCH_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleSetBatchStatus(status)}
                  className="rounded border border-earth-300 bg-white px-2 py-1 text-xs hover:bg-earth-100"
                >
                  {status}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {selectedBatchId ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="font-medium text-earth-900">Allocations da abertura</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {allocations.map((allocation) => (
                <li key={allocation.id} className="rounded border border-earth-200 px-3 py-2">
                  <p className="font-medium text-earth-900">{allocation.customer_name || allocation.customer_email || allocation.user_id}</p>
                  <p className="text-xs text-earth-600">
                    Qtd {allocation.quantity} • {allocation.status} • {allocation.payment_status || 'pending'}
                    {allocation.price_jpy != null ? ` • ¥${Number(allocation.price_jpy).toLocaleString('ja-JP')}` : ''}
                    {' '}• {allocation.id}
                  </p>
                </li>
              ))}
              {allocations.length === 0 ? <li className="text-sm text-earth-600">Sem allocations.</li> : null}
            </ul>
          </div>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="font-medium text-earth-900">Sessao de abertura</h3>
            <form onSubmit={handleSaveSession} className="mt-3 grid gap-3">
              <select
                value={sessionForm.status}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              >
                {SESSION_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input
                value={sessionForm.video_url}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, video_url: e.target.value }))}
                placeholder="URL do video"
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                value={sessionForm.recorded_at}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, recorded_at: e.target.value }))}
                type="datetime-local"
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
                Salvar sessao
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedSessionId === session.id ? 'border-earth-900 bg-earth-100' : 'border-earth-200 bg-white'}`}
                >
                  <p className="font-medium text-earth-900">{session.status}</p>
                  <p className="text-xs text-earth-600">{session.video_url || session.id}</p>
                </button>
              ))}
            </div>
            {selectedSessionId ? (
              <button
                type="button"
                onClick={handlePublishSession}
                className="mt-3 rounded border border-collector-600 bg-collector-100 px-3 py-2 text-sm font-medium text-collector-700 hover:bg-collector-200"
              >
                Publicar sessao
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedSessionId ? (
        <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
          <h3 className="font-medium text-earth-900">Pulls da sessao</h3>
          <form onSubmit={handleAddPull} className="mt-3 grid gap-3 lg:grid-cols-6">
            <select
              value={pullForm.allocation_id}
              onChange={(e) => setPullForm((prev) => ({ ...prev, allocation_id: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm lg:col-span-2"
            >
              <option value="">Allocation</option>
              {allocations.map((allocation) => (
                <option key={allocation.id} value={allocation.id}>{allocation.customer_name || allocation.id}</option>
              ))}
            </select>
            <input
              value={pullForm.card_name}
              onChange={(e) => setPullForm((prev) => ({ ...prev, card_name: e.target.value }))}
              placeholder="Nome da carta"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={pullForm.rarity}
              onChange={(e) => setPullForm((prev) => ({ ...prev, rarity: e.target.value }))}
              placeholder="Raridade"
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <input
              value={pullForm.market_value_jpy}
              onChange={(e) => setPullForm((prev) => ({ ...prev, market_value_jpy: e.target.value }))}
              placeholder="Valor JPY"
              type="number"
              min={0}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
              Adicionar pull
            </button>
            <input
              value={pullForm.image_url}
              onChange={(e) => setPullForm((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="Imagem URL"
              className="rounded border border-earth-300 px-3 py-2 text-sm lg:col-span-4"
            />
            <label className="inline-flex items-center gap-2 text-sm text-earth-700 lg:col-span-2">
              <input
                type="checkbox"
                checked={pullForm.is_highlight}
                onChange={(e) => setPullForm((prev) => ({ ...prev, is_highlight: e.target.checked }))}
              />
              Destacar pull
            </label>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {pulls.map((pull) => (
              <li key={pull.id} className="flex items-center justify-between rounded border border-earth-200 px-3 py-2">
                <div>
                  <p className="font-medium text-earth-900">{pull.card_name}</p>
                  <p className="text-xs text-earth-600">{pull.rarity || '—'} • {pull.market_value_jpy || '—'} JPY</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePull(pull.id)}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Remover
                </button>
              </li>
            ))}
            {pulls.length === 0 ? <li className="text-sm text-earth-600">Sem pulls nesta sessao.</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-earth-900">Fila de grading PSA</h3>
          <button
            type="button"
            onClick={refreshGradingQueue}
            className="rounded border border-earth-300 bg-earth-100 px-2 py-1 text-xs hover:bg-earth-200"
          >
            Atualizar
          </button>
        </div>
        {gradingLoading ? <p className="mt-3 text-sm text-earth-600">Carregando fila...</p> : null}
        {!gradingLoading && gradingQueue.length === 0 ? (
          <p className="mt-3 text-sm text-earth-600">Sem cards aguardando grading.</p>
        ) : null}
        <div className="mt-3 space-y-3">
          {gradingQueue.map((item) => {
            const draft = gradingDrafts[item.id] || {}
            return (
              <div key={item.id} className="rounded border border-earth-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-earth-900">{item.card_name || item.pull_id}</p>
                  <p className="text-xs text-earth-600">
                    {item.owner_name || item.owner_email || item.owner_id} • {item.batch_code || item.batch_id || '—'}
                  </p>
                </div>
                <p className="mt-1 text-xs text-earth-600">
                  {item.rarity || '—'} • market ¥{Number(item.market_value_jpy || 0).toLocaleString('ja-JP')} •
                  solicitado {item.grading_requested_at ? new Date(item.grading_requested_at).toLocaleString('pt-BR') : '—'}
                </p>
                <div className="mt-2 grid gap-2 lg:grid-cols-5">
                  <input
                    value={draft.psa_grade ?? ''}
                    onChange={(e) =>
                      setGradingDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...draft, psa_grade: e.target.value },
                      }))
                    }
                    placeholder="PSA grade"
                    className="rounded border border-earth-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={draft.psa_cert_number ?? ''}
                    onChange={(e) =>
                      setGradingDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...draft, psa_cert_number: e.target.value },
                      }))
                    }
                    placeholder="PSA cert #"
                    className="rounded border border-earth-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={draft.action_note ?? ''}
                    onChange={(e) =>
                      setGradingDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...draft, action_note: e.target.value },
                      }))
                    }
                    placeholder="Nota de conclusao"
                    className="rounded border border-earth-300 px-2 py-1 text-xs lg:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleCompletePsa(item.id)}
                    className="rounded border border-collector-600 bg-collector-100 px-2 py-1 text-xs font-medium text-collector-800 hover:bg-collector-200"
                  >
                    Concluir PSA
                  </button>
                  <input
                    value={draft.cancel_reason ?? ''}
                    onChange={(e) =>
                      setGradingDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...draft, cancel_reason: e.target.value },
                      }))
                    }
                    placeholder="Motivo do cancelamento"
                    className="rounded border border-earth-300 px-2 py-1 text-xs lg:col-span-4"
                  />
                  <button
                    type="button"
                    onClick={() => handleCancelPsa(item.id)}
                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Cancelar pedido
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedBatchId ? (
        <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-earth-900">Principais cartas</h3>
              <p className="text-xs text-earth-600">
                Collection key: {selectedCollectionKey || '—'}
                {selectedTopCardsEntry?.setCode ? ` • Set code: ${selectedTopCardsEntry.setCode}` : ''}
              </p>
            </div>
            <p className="text-xs text-earth-500">
              {selectedTopCardsEntry?.updatedAt
                ? `Atualizado em ${new Date(selectedTopCardsEntry.updatedAt).toLocaleString('pt-BR')}`
                : 'Sem snapshot de cartas ainda.'}
            </p>
          </div>
          {topCardsLoading ? <p className="mt-3 text-sm text-earth-600">Carregando cartas...</p> : null}
          {!topCardsLoading && topCardsRows.length === 0 ? (
            <p className="mt-3 text-sm text-earth-600">Sem cartas no snapshot gerado para esta colecao.</p>
          ) : null}
          <div className="mt-3 space-y-3">
            {topCardsRows.map((card) => {
              const draft = topCardDrafts[card.snkrdunkId] || {}
              const hidden = draft.hidden ?? card.hidden ?? false
              const pinned = draft.pinned ?? card.pinned ?? false
              const overridePrice = draft.overridePrice ?? card.overridePrice
              return (
                <div key={card.snkrdunkId} className="rounded border border-earth-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-earth-900">{card.name}</p>
                    <p className="text-xs text-earth-600">
                      {card.rarity || '—'} {card.cardNumber ? `• ${card.cardNumber}` : ''} • ¥
                      {Number(card.priceJpy || 0).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-4">
                    <label className="inline-flex items-center gap-2 text-xs text-earth-700">
                      <input
                        type="checkbox"
                        checked={hidden}
                        onChange={(e) =>
                          setTopCardDrafts((prev) => ({
                            ...prev,
                            [card.snkrdunkId]: { ...draft, hidden: e.target.checked },
                          }))
                        }
                      />
                      Ocultar
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-earth-700">
                      <input
                        type="checkbox"
                        checked={pinned}
                        onChange={(e) =>
                          setTopCardDrafts((prev) => ({
                            ...prev,
                            [card.snkrdunkId]: { ...draft, pinned: e.target.checked },
                          }))
                        }
                      />
                      Fixar no topo
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={overridePrice}
                      onChange={(e) =>
                        setTopCardDrafts((prev) => ({
                          ...prev,
                          [card.snkrdunkId]: { ...draft, overridePrice: e.target.value },
                        }))
                      }
                      placeholder="Override JPY"
                      className="rounded border border-earth-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTopCardOverride(card)}
                      className="rounded border border-earth-300 bg-earth-100 px-2 py-1 text-xs hover:bg-earth-200"
                    >
                      Salvar ajuste
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
