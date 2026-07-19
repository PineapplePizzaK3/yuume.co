import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import { formatBRL, formatJPY, formatPairFromYen, formatWeight } from '../../../../lib/fx'
import { getSystemSettings } from '../../../../services/settingsService'
import { listCalculatorProductsAdmin } from '../../../../services/calculatorProductService'
import {
  computeBatchSummary,
  getLoteRateRow,
  LOTE_EMS_RATE_TABLE,
  resolveBrlPerJpyFromSettings,
  resolveLoteKgForWeightGrams,
} from '../../../../lib/brazilPriceCalculator'
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

function formatLoteManualOptionLabel(row) {
  const costPerGram = Number(row?.costPerGramYen || 0).toFixed(2)
  return `${row.loteKg} kg - ${formatJPY(row.totalEmsYen)} total (${costPerGram} JPY/g)`
}

function buildItemLabel(product) {
  if (!product) return 'Produto indisponível'
  const name = String(product.name || '').trim() || 'Sem nome'
  const weight = Number(product.weight_grams) || 0
  return `${name} · ${Math.round(weight)} g`
}

function getItemDeclaredYen(source = {}) {
  const base = Math.max(0, Number(source.base_cost_yen) || 0)
  const declared = Math.max(0, Number(source.declared_value_yen) || 0)
  return declared > 0 ? declared : base
}

function buildSelectedItems(itemRows, productsMap) {
  return itemRows
    .map((row, index) => {
      const productId = String(row.calculator_product_id || '').trim()
      const qty = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (!productId || qty <= 0) return null
      const product = productsMap.get(productId)
      if (!product) return null
      const unitWeight = Math.max(0, Number(product.weight_grams) || 0)
      if (unitWeight <= 0) return null
      const unitBase = Math.max(0, Number(product.base_cost_yen) || 0)
      const unitDeclared = getItemDeclaredYen(product)
      const unitFinalBrl = Math.max(0, Number(product.final_price_brl) || 0)
      const unitMarginPercent = Math.max(0, Number(product.margin_percent) || 0)
      const unitPackagingBrl = Math.max(0, Number(product.packaging_brl) || 0)
      const unitLocalShippingBrl = Math.max(0, Number(product.local_shipping_brl) || 0)
      return {
        product,
        row_id: String(index),
        calculator_product_id: productId,
        quantity: qty,
        unit_weight_grams: unitWeight,
        line_weight_grams: unitWeight * qty,
        weight_grams: unitWeight,
        base_cost_yen: unitBase,
        declared_value_yen: unitDeclared,
        margin_percent: unitMarginPercent,
        packaging_brl: unitPackagingBrl,
        local_shipping_brl: unitLocalShippingBrl,
        final_price_brl: unitFinalBrl,
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

function formatSnapshotItemLine(item) {
  const snapshot = item?.snapshot || {}
  const qty = Math.max(0, Number(item?.quantity) || 0)
  const name = String(snapshot?.name || '').trim() || 'Item'
  const unitBase = Math.max(0, Number(snapshot?.base_cost_yen) || 0)
  const unitDeclared = getItemDeclaredYen(snapshot)
  const unitFinal = Math.max(0, Number(snapshot?.final_price_brl) || 0)
  return `${name} x${qty} · Base ${formatJPY(unitBase * qty)} · Declarado ${formatJPY(unitDeclared * qty)} · Final ${formatBRL(unitFinal * qty)}`
}

function BatchItemsEditor({
  itemRows,
  products,
  productsMap,
  loadingProducts,
  brlPerJpy,
  pricingByRowId,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}) {
  return (
    <div className="rounded border border-earth-200 bg-earth-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-earth-900">Itens do lote</p>
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

      <div className="space-y-2">
        {itemRows.map((row, index) => {
          const selectedProduct = productsMap.get(String(row.calculator_product_id || ''))
          const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
          const unitBase = Math.max(0, Number(selectedProduct?.base_cost_yen) || 0)
          const unitDeclared = getItemDeclaredYen(selectedProduct || {})
          const unitFinalBrl = Math.max(0, Number(selectedProduct?.final_price_brl) || 0)
          const rowPricing = pricingByRowId?.[String(index)] || null
          const lineBase = unitBase * quantity
          const lineDeclared = unitDeclared * quantity
          const lineFinalBrl = rowPricing
            ? Number(rowPricing.lineFinalPriceBrl) || 0
            : unitFinalBrl * quantity
          const unitFinalInBatchBrl = quantity > 0 ? lineFinalBrl / quantity : 0
          const lineWeight = Math.max(0, Number(selectedProduct?.weight_grams) || 0) * quantity
          return (
            <div key={`row-${index}`} className="rounded border border-earth-200 bg-white p-2.5">
              <div className="grid gap-2 md:grid-cols-[1fr,110px,auto]">
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

              {selectedProduct ? (
                <div className="mt-2 grid gap-1 text-xs text-earth-700 md:grid-cols-2 xl:grid-cols-5">
                  <p>
                    <span className="text-earth-500">Peso:</span>{' '}
                    {formatGramsAsWeightLabel(lineWeight)}
                  </p>
                  <p>
                    <span className="text-earth-500">Base (linha):</span>{' '}
                    {formatPairFromYen(lineBase, brlPerJpy)}
                  </p>
                  <p>
                    <span className="text-earth-500">Declarado (linha):</span>{' '}
                    {formatPairFromYen(lineDeclared, brlPerJpy)}
                  </p>
                  <p>
                    <span className="text-earth-500">Preço final (linha):</span>{' '}
                    {formatBRL(lineFinalBrl)}
                    {rowPricing ? (
                      <span className="ml-1 text-[11px] text-earth-500">
                        (recalculado pelo lote atual)
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <span className="text-earth-500">Preço final unitário no lote:</span>{' '}
                    {formatBRL(unitFinalInBatchBrl)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-earth-500">
                  Selecione um produto para exibir valores unitários e de linha.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAddRow}
          className="rounded border border-earth-300 bg-white px-2 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100"
        >
          + Adicionar produto
        </button>
      </div>
    </div>
  )
}

function BatchTotalsPanel({
  summary,
  brlPerJpy,
  customsFactor,
  loteMode,
  loteKgManual,
  onCustomsFactorChange,
  onLoteModeChange,
  onLoteKgManualChange,
}) {
  const shippingRows = Array.isArray(summary.shippingTable) ? summary.shippingTable : []
  const rowsUpTo10Kg = shippingRows.filter((row) => row.loteKg <= 10)
  const rowsFrom10To20Kg = shippingRows.filter((row) => row.loteKg > 10 && row.loteKg <= 20)
  const rowsAbove20Kg = shippingRows.filter((row) => row.loteKg > 20)

  return (
    <div className="mt-4 rounded border border-earth-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-earth-700">
          Fator aduaneiro
          <input
            type="number"
            min="0"
            step="0.01"
            value={customsFactor}
            onChange={(e) => onCustomsFactorChange(e.target.value)}
            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
          />
        </label>
        <label className="text-xs text-earth-700">
          Faixa lote EMS
          <select
            value={loteMode}
            onChange={(e) => onLoteModeChange(e.target.value)}
            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
          >
            <option value="auto">Automático pelo peso</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="text-xs text-earth-700">
          Lote manual (kg)
          <select
            value={loteKgManual}
            onChange={(e) => onLoteKgManualChange(e.target.value)}
            disabled={loteMode !== 'manual'}
            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900 disabled:opacity-50"
          >
            {rowsUpTo10Kg.length > 0 ? (
              <optgroup label="Faixas base (ate 10kg)">
                {rowsUpTo10Kg.map((row) => (
                  <option key={row.loteKg} value={row.loteKg}>
                    {formatLoteManualOptionLabel(row)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {rowsFrom10To20Kg.length > 0 ? (
              <optgroup label="Faixas detalhadas (10kg a 20kg)">
                {rowsFrom10To20Kg.map((row) => (
                  <option key={row.loteKg} value={row.loteKg}>
                    {formatLoteManualOptionLabel(row)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {rowsAbove20Kg.length > 0 ? (
              <optgroup label="Faixas altas (acima de 20kg)">
                {rowsAbove20Kg.map((row) => (
                  <option key={row.loteKg} value={row.loteKg}>
                    {formatLoteManualOptionLabel(row)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-emerald-200 bg-emerald-50 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Custo final do lote</p>
          <p className="mt-1 text-sm font-bold text-emerald-900">{formatPairFromYen(summary.landedCost.yen, brlPerJpy)}</p>
        </div>
        <div className="rounded border border-sky-200 bg-sky-50 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-sky-700">Peso total</p>
          <p className="mt-1 text-sm font-bold text-sky-900">{formatGramsAsWeightLabel(summary.weights.totalWeightGrams)}</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">Impostos alfandegários</p>
          <p className="mt-1 text-sm font-bold text-amber-900">{formatPairFromYen(summary.customs.taxedYen, brlPerJpy)}</p>
        </div>
        <div className="rounded border border-violet-200 bg-violet-50 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-violet-700">Frete internacional</p>
          <p className="mt-1 text-sm font-bold text-violet-900">{formatPairFromYen(summary.shipping.yen, brlPerJpy)}</p>
          <p className="mt-1 text-[11px] text-violet-700">
            {summary.shipping.mode === 'manual'
              ? `Faixa manual ${summary.shipping.loteKg} kg`
              : `Faixa automática até ${summary.shipping.autoBandMaxGrams || summary.weights.totalWeightGrams} g`}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-earth-800 md:grid-cols-2 xl:grid-cols-3">
        <p><span className="text-earth-600">Peso produtos:</span> <strong>{formatGramsAsWeightLabel(summary.weights.productsWeightGrams)}</strong></p>
        <p><span className="text-earth-600">Peso proteções:</span> <strong>{formatGramsAsWeightLabel(summary.weights.protectionWeightGrams)}</strong></p>
        <p>
          <span className="text-earth-600">Faixa EMS usada:</span>{' '}
          <strong>
            {summary.shipping.mode === 'manual'
              ? `${summary.shipping.loteKg} kg (manual)`
              : `até ${summary.shipping.autoBandMaxGrams || summary.weights.totalWeightGrams} g`}
          </strong>
        </p>
        <p><span className="text-earth-600">Valor base dos produtos:</span> <strong>{formatPairFromYen(summary.sums.baseCostYen, brlPerJpy)}</strong></p>
        <p><span className="text-earth-600">Valor declarado do lote:</span> <strong>{formatPairFromYen(summary.sums.declaredValueYen, brlPerJpy)}</strong></p>
        <p><span className="text-earth-600">Base aduaneira (declarado + frete):</span> <strong>{formatPairFromYen(summary.customs.taxableYen, brlPerJpy)}</strong></p>
        <p><span className="text-earth-600">Soma preços finais dos itens:</span> <strong>{formatBRL(summary.sums.finalPriceBrl)}</strong></p>
      </div>
    </div>
  )
}

export default function LotesSection() {
  const { activeTab } = useAdminContext()
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [systemSettings, setSystemSettings] = useState(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
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
  const [editCustomsFactor, setEditCustomsFactor] = useState('2')
  const [editLoteMode, setEditLoteMode] = useState('auto')
  const [editLoteKgManual, setEditLoteKgManual] = useState('1')
  const [editItemRows, setEditItemRows] = useState([{ calculator_product_id: '', quantity: '1' }])

  const productsMap = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(String(p.id), p)
    return map
  }, [products])
  const brlPerJpy = useMemo(() => resolveBrlPerJpyFromSettings(systemSettings || {}), [systemSettings])

  const createProtectionWeight = Math.max(0, Math.floor(Number(protectionWeightGrams) || 0))

  const editSelectedItems = useMemo(
    () => buildSelectedItems(editItemRows, productsMap),
    [editItemRows, productsMap],
  )
  const editProtectionWeight = Math.max(0, Math.floor(Number(editProtectionWeightGrams) || 0))
  const editBatchSummary = useMemo(() => {
    const loteKg = editLoteMode === 'manual' ? Number(editLoteKgManual) || 1 : null
    return computeBatchSummary({
      items: editSelectedItems,
      protectionWeightGrams: editProtectionWeight,
      loteKg,
      loteMode: editLoteMode,
      customsFactor: Number(editCustomsFactor) || 2,
      brlPerJpy,
    })
  }, [editSelectedItems, editProtectionWeight, editLoteMode, editLoteKgManual, editCustomsFactor, brlPerJpy])
  const loteRateTable = useMemo(
    () => LOTE_EMS_RATE_TABLE.map((row) => getLoteRateRow(row.loteKg)).filter(Boolean),
    [],
  )
  const editBatchSummaryWithTable = useMemo(
    () => ({ ...editBatchSummary, shippingTable: loteRateTable }),
    [editBatchSummary, loteRateTable],
  )

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

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    const { data, error } = await getSystemSettings()
    if (error) {
      setFeedback(error.message || 'Falha ao carregar cotações da calculadora.')
      setSystemSettings(null)
    } else {
      setSystemSettings(data || {})
    }
    setLoadingSettings(false)
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
    void Promise.all([loadProducts(), loadBatches(), loadSettings()])
  }, [activeTab, loadProducts, loadBatches, loadSettings])

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
    const firstSnapshot = Array.isArray(batch.items) && batch.items.length > 0
      ? (batch.items[0]?.snapshot || {})
      : {}
    setEditCustomsFactor(String(firstSnapshot.customs_factor ?? 2))
    setEditLoteMode('auto')
    setEditLoteKgManual(String(resolveLoteKgForWeightGrams(batch.total_weight_grams)))
    setFeedback('')
  }

  const closeEditor = () => {
    setEditingBatchId('')
    setEditName('')
    setEditNotes('')
    setEditProtectionWeightGrams('0')
    setEditCustomsFactor('2')
    setEditLoteMode('auto')
    setEditLoteKgManual('1')
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
                base_cost_yen: item.product.base_cost_yen,
                declared_value_yen: item.product.declared_value_yen,
                customs_factor: item.product.customs_factor,
                margin_percent: item.product.margin_percent,
                brl_per_jpy: item.product.brl_per_jpy,
                final_price_brl: item.product.final_price_brl,
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
        Crie um lote vazio, adicione produtos e acompanhe valores do lote com frete EMS e alfândega na mesma tela.
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

        <div className="mt-4 rounded border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
          Peso inicial do lote: <strong>{formatGramsAsWeightLabel(createProtectionWeight)}</strong>
        </div>

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
                  const isEditing = editingBatchId === batch.id
                  return (
                    <Fragment key={batch.id}>
                      <tr className="border-b border-earth-100 hover:bg-earth-50/80">
                        <td className="px-2 py-2 font-medium text-earth-900">{batch.name}</td>
                        <td className="px-2 py-2 text-earth-700">
                          {itemList.length === 0 ? (
                            <span>—</span>
                          ) : (
                            <div className="space-y-1">
                              {itemList.map((it, idx) => (
                                <p key={`${batch.id}-item-${idx}`} className="text-xs text-earth-700">
                                  {formatSnapshotItemLine(it)}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
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
                                  productsMap={productsMap}
                                  loadingProducts={loadingProducts}
                                  brlPerJpy={brlPerJpy}
                                  pricingByRowId={editBatchSummary.itemPricingByRowId}
                                  onAddRow={handleAddEditRow}
                                  onRemoveRow={handleRemoveEditRow}
                                  onUpdateRow={handleUpdateEditRow}
                                />
                              </div>

                              <BatchTotalsPanel
                                summary={editBatchSummaryWithTable}
                                brlPerJpy={brlPerJpy}
                                customsFactor={editCustomsFactor}
                                loteMode={editLoteMode}
                                loteKgManual={editLoteKgManual}
                                onCustomsFactorChange={setEditCustomsFactor}
                                onLoteModeChange={setEditLoteMode}
                                onLoteKgManualChange={setEditLoteKgManual}
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
                                {loadingSettings ? (
                                  <p className="text-xs text-earth-500">Atualizando cotação BRL/JPY...</p>
                                ) : null}
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
