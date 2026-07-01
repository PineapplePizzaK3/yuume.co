import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import { formatWeight } from '../../../../lib/fx'
import { listCalculatorProductsAdmin } from '../../../../services/calculatorProductService'
import {
  createCalculatorBatchAdmin,
  deleteCalculatorBatchAdmin,
  listCalculatorBatchesAdmin,
  updateCalculatorBatchAdmin,
} from '../../../../services/calculatorBatchService'

function formatGramsAsWeightLabel(grams) {
  const g = Math.max(0, Number(grams) || 0)
  return `${Math.round(g)} g (${formatWeight(g / 1000)})`
}

function buildItemLabel(product) {
  if (!product) return 'Produto indisponível'
  const name = String(product.name || '').trim() || 'Sem nome'
  const weight = Number(product.weight_grams) || 0
  return `${name} · ${Math.round(weight)} g`
}

function buildSelectedItems(itemRows, productsMap) {
  return itemRows
    .map((row) => {
      const productId = String(row.calculator_product_id || '').trim()
      const qty = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (!productId || qty <= 0) return null
      const product = productsMap.get(productId)
      if (!product) return null
      const unitWeight = Math.max(0, Number(product.weight_grams) || 0)
      if (unitWeight <= 0) return null
      return {
        product,
        calculator_product_id: productId,
        quantity: qty,
        unit_weight_grams: unitWeight,
        line_weight_grams: unitWeight * qty,
      }
    })
    .filter(Boolean)
}

function batchItemsToRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ calculator_product_id: '', quantity: '1' }]
  }
  return items.map((it) => ({
    calculator_product_id: String(it.calculator_product_id || ''),
    quantity: String(it.quantity || 1),
  }))
}

function BatchItemsEditor({
  itemRows,
  products,
  loadingProducts,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}) {
  return (
    <div className="rounded border border-earth-200 bg-earth-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-earth-900">Produtos do lote</p>
        <button
          type="button"
          onClick={onAddRow}
          className="rounded border border-earth-300 bg-white px-2 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100"
        >
          + Adicionar produto
        </button>
      </div>

      {loadingProducts && products.length === 0 ? (
        <p className="text-xs text-earth-600">Carregando produtos...</p>
      ) : null}

      {itemRows.map((row, index) => (
        <div key={`row-${index}`} className="mb-2 grid gap-2 md:grid-cols-[1fr,120px,auto]">
          <select
            value={row.calculator_product_id}
            onChange={(e) => onUpdateRow(index, { calculator_product_id: e.target.value })}
            className="rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
          >
            <option value="">Selecione um produto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {buildItemLabel(p)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            step="1"
            value={row.quantity}
            onChange={(e) => onUpdateRow(index, { quantity: e.target.value })}
            className="rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
            placeholder="Qtd"
          />
          <button
            type="button"
            onClick={() => onRemoveRow(index)}
            disabled={itemRows.length <= 1}
            className="rounded border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Remover
          </button>
        </div>
      ))}
    </div>
  )
}

function WeightSummary({ productsWeightGrams, protectionWeight }) {
  const totalWeightGrams = productsWeightGrams + protectionWeight
  return (
    <div className="mt-4 grid gap-2 rounded border border-earth-200 bg-white p-3 text-sm text-earth-800 md:grid-cols-3">
      <p>
        <span className="text-earth-600">Peso dos produtos:</span>{' '}
        <strong>{formatGramsAsWeightLabel(productsWeightGrams)}</strong>
      </p>
      <p>
        <span className="text-earth-600">Peso de proteções:</span>{' '}
        <strong>{formatGramsAsWeightLabel(protectionWeight)}</strong>
      </p>
      <p>
        <span className="text-earth-600">Peso final do lote:</span>{' '}
        <strong>{formatGramsAsWeightLabel(totalWeightGrams)}</strong>
      </p>
    </div>
  )
}

export default function LotesSection() {
  const { activeTab } = useAdminContext()
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [batchName, setBatchName] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [protectionWeightGrams, setProtectionWeightGrams] = useState('0')
  const [editingBatchId, setEditingBatchId] = useState('')
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editProtectionWeightGrams, setEditProtectionWeightGrams] = useState('0')
  const [editItemRows, setEditItemRows] = useState([{ calculator_product_id: '', quantity: '1' }])

  const productsMap = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(String(p.id), p)
    return map
  }, [products])

  const createProtectionWeight = Math.max(0, Math.floor(Number(protectionWeightGrams) || 0))

  const editSelectedItems = useMemo(
    () => buildSelectedItems(editItemRows, productsMap),
    [editItemRows, productsMap],
  )
  const editProductsWeightGrams = useMemo(
    () => editSelectedItems.reduce((acc, item) => acc + item.line_weight_grams, 0),
    [editSelectedItems],
  )
  const editProtectionWeight = Math.max(0, Math.floor(Number(editProtectionWeightGrams) || 0))

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    const { data, error } = await listCalculatorProductsAdmin()
    if (error) {
      setFeedback(error.message || 'Falha ao carregar produtos da calculadora.')
      setProducts([])
    } else {
      setProducts(data)
    }
    setLoadingProducts(false)
  }, [])

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true)
    const { data, error } = await listCalculatorBatchesAdmin()
    if (error) {
      setFeedback(error.message || 'Falha ao carregar lotes.')
      setBatches([])
    } else {
      setBatches(data)
    }
    setLoadingBatches(false)
  }, [])

  useEffect(() => {
    if (activeTab !== 'lotes') return
    void Promise.all([loadProducts(), loadBatches()])
  }, [activeTab, loadProducts, loadBatches])

  if (activeTab !== 'lotes') return null

  const canCreate = String(batchName).trim().length > 0 && !saving
  const canUpdate =
    Boolean(editingBatchId) &&
    String(editName).trim().length > 0 &&
    updatingId !== editingBatchId

  const openEditor = (batch) => {
    if (!batch?.id) return
    setEditingBatchId(batch.id)
    setEditName(batch.name || '')
    setEditNotes(batch.notes || '')
    setEditProtectionWeightGrams(String(batch.protection_weight_grams ?? 0))
    setEditItemRows(batchItemsToRows(batch.items))
    setFeedback('')
  }

  const closeEditor = () => {
    setEditingBatchId('')
    setEditName('')
    setEditNotes('')
    setEditProtectionWeightGrams('0')
    setEditItemRows([{ calculator_product_id: '', quantity: '1' }])
  }

  const handleCreateBatch = async () => {
    if (!canCreate) return
    setSaving(true)
    setFeedback('')
    const payload = {
      name: String(batchName).trim(),
      notes: String(batchNotes || '').trim() || null,
      protection_weight_grams: createProtectionWeight,
      items: [],
    }
    const { data, error } = await createCalculatorBatchAdmin(payload)
    if (error) {
      setFeedback(error.message || 'Falha ao criar lote.')
    } else {
      setFeedback('Lote criado. Adicione produtos em "Gerenciar".')
      setBatchName('')
      setBatchNotes('')
      setProtectionWeightGrams('0')
      await loadBatches()
      if (data?.id) {
        openEditor(data)
      }
    }
    setSaving(false)
  }

  const handleAddEditRow = () => {
    setEditItemRows((prev) => [...prev, { calculator_product_id: '', quantity: '1' }])
  }

  const handleRemoveEditRow = (index) => {
    setEditItemRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateEditRow = (index, patch) => {
    setEditItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleSaveBatch = async () => {
    if (!canUpdate) return
    setUpdatingId(editingBatchId)
    setFeedback('')
    const payload = {
      name: String(editName).trim(),
      notes: String(editNotes || '').trim() || null,
      protection_weight_grams: editProtectionWeight,
      items: editSelectedItems.map((item) => ({
        calculator_product_id: item.calculator_product_id,
        quantity: item.quantity,
      })),
    }
    const { data, error } = await updateCalculatorBatchAdmin(editingBatchId, payload)
    if (error) {
      setFeedback(error.message || 'Falha ao atualizar lote.')
    } else {
      setFeedback('Lote atualizado.')
      if (data?.id) {
        setBatches((prev) =>
          prev.map((b) => {
            if (b.id !== data.id) return b
            return { ...b, ...data, items: editSelectedItems.map((item) => ({
              calculator_product_id: item.calculator_product_id,
              quantity: item.quantity,
              unit_weight_grams: item.unit_weight_grams,
              line_weight_grams: item.line_weight_grams,
              snapshot: {
                name: item.product.name,
                weight_grams: item.product.weight_grams,
              },
            })) }
          }),
        )
      }
      await loadBatches()
    }
    setUpdatingId('')
  }

  const handleDeleteBatch = async (batchId) => {
    if (!batchId) return
    if (!window.confirm('Remover este lote?')) return
    setDeletingId(batchId)
    const { error } = await deleteCalculatorBatchAdmin(batchId)
    if (error) {
      setFeedback(error.message || 'Falha ao remover lote.')
    } else {
      setBatches((prev) => prev.filter((b) => b.id !== batchId))
      if (editingBatchId === batchId) closeEditor()
    }
    setDeletingId('')
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Lotes</h2>
      <p className="mt-1 text-sm text-earth-600">
        Crie um lote vazio e adicione produtos da calculadora Brasil aos poucos. Os pesos são recalculados ao salvar.
      </p>

      <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
        <h3 className="font-medium text-earth-900">Criar novo lote</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-earth-700">
            Nome do lote *
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Ex.: Lote Julho #1"
              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
            />
          </label>
          <label className="text-xs text-earth-700">
            Peso de proteções (g)
            <input
              type="number"
              min="0"
              step="1"
              value={protectionWeightGrams}
              onChange={(e) => setProtectionWeightGrams(e.target.value)}
              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-earth-700">
          Observações
          <input
            type="text"
            value={batchNotes}
            onChange={(e) => setBatchNotes(e.target.value)}
            placeholder="Opcional"
            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
          />
        </label>

        <WeightSummary productsWeightGrams={0} protectionWeight={createProtectionWeight} />

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCreateBatch()}
            disabled={!canCreate}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-800 disabled:opacity-50"
          >
            {saving ? 'Criando lote...' : 'Criar lote vazio'}
          </button>
          {feedback && !editingBatchId ? <p className="text-sm text-earth-700">{feedback}</p> : null}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-earth-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-earth-900">Lotes criados</h3>
          <button
            type="button"
            onClick={() => void loadBatches()}
            disabled={loadingBatches}
            className="rounded border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-50 disabled:opacity-50"
          >
            {loadingBatches ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </div>

        {!loadingBatches && batches.length === 0 ? (
          <p className="text-sm text-earth-600">Nenhum lote criado ainda.</p>
        ) : null}

        {batches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-earth-200 text-xs uppercase tracking-wide text-earth-500">
                  <th className="px-2 py-2">Lote</th>
                  <th className="px-2 py-2">Itens</th>
                  <th className="px-2 py-2">Peso produtos</th>
                  <th className="px-2 py-2">Proteções</th>
                  <th className="px-2 py-2">Peso final</th>
                  <th className="px-2 py-2">Cadastro</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const itemList = Array.isArray(batch.items) ? batch.items : []
                  const itemSummary = itemList
                    .map((it) => {
                      const name = String(it?.snapshot?.name || '').trim() || 'Item'
                      const qty = Number(it?.quantity) || 0
                      return `${name} x${qty}`
                    })
                    .join(', ')
                  const isEditing = editingBatchId === batch.id
                  return (
                    <Fragment key={batch.id}>
                      <tr className="border-b border-earth-100 hover:bg-earth-50/80">
                        <td className="px-2 py-2 font-medium text-earth-900">{batch.name}</td>
                        <td className="px-2 py-2 text-earth-700">{itemSummary || '—'}</td>
                        <td className="px-2 py-2 text-earth-700">{formatGramsAsWeightLabel(batch.products_weight_grams)}</td>
                        <td className="px-2 py-2 text-earth-700">{formatGramsAsWeightLabel(batch.protection_weight_grams)}</td>
                        <td className="px-2 py-2 font-semibold text-earth-900">{formatGramsAsWeightLabel(batch.total_weight_grams)}</td>
                        <td className="px-2 py-2 text-xs text-earth-500">
                          {batch.created_at ? new Date(batch.created_at).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => (isEditing ? closeEditor() : openEditor(batch))}
                              className="text-xs font-medium text-earth-700 hover:text-earth-900"
                            >
                              {isEditing ? 'Fechar' : 'Gerenciar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteBatch(batch.id)}
                              disabled={deletingId === batch.id}
                              className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {deletingId === batch.id ? 'Removendo...' : 'Remover'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing ? (
                        <tr className="border-b border-earth-100 bg-earth-50/50">
                          <td colSpan={7} className="px-2 py-4">
                            <div className="rounded-lg border border-earth-200 bg-white p-4">
                              <h4 className="font-medium text-earth-900">Gerenciar lote: {batch.name}</h4>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <label className="text-xs text-earth-700">
                                  Nome do lote *
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                                  />
                                </label>
                                <label className="text-xs text-earth-700">
                                  Peso de proteções (g)
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={editProtectionWeightGrams}
                                    onChange={(e) => setEditProtectionWeightGrams(e.target.value)}
                                    className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                                  />
                                </label>
                              </div>
                              <label className="mt-3 block text-xs text-earth-700">
                                Observações
                                <input
                                  type="text"
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                                />
                              </label>

                              <div className="mt-4">
                                <BatchItemsEditor
                                  itemRows={editItemRows}
                                  products={products}
                                  loadingProducts={loadingProducts}
                                  onAddRow={handleAddEditRow}
                                  onRemoveRow={handleRemoveEditRow}
                                  onUpdateRow={handleUpdateEditRow}
                                />
                              </div>

                              <WeightSummary
                                productsWeightGrams={editProductsWeightGrams}
                                protectionWeight={editProtectionWeight}
                              />

                              <div className="mt-4 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveBatch()}
                                  disabled={!canUpdate}
                                  className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-800 disabled:opacity-50"
                                >
                                  {updatingId === editingBatchId ? 'Salvando...' : 'Salvar lote'}
                                </button>
                                {feedback && editingBatchId ? (
                                  <p className="text-sm text-earth-700">{feedback}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
