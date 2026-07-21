import { useCallback, useEffect, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import BrazilPriceCalculatorPanel from './BrazilPriceCalculatorPanel'
import { brlToYen, formatBRL, formatJPY, formatPairFromBrl, formatPairFromYen, formatWeight } from '../../../../lib/fx'
import {
  createCalculatorProductTemplateAdmin,
  deleteCalculatorProductAdmin,
  deleteCalculatorProductTemplateAdmin,
  duplicateCalculatorProductAdmin,
  listCalculatorProductTemplatesAdmin,
  listCalculatorProductsAdmin,
} from '../../../../services/calculatorProductService'
import {
  DIRECT_METHOD_EMS,
  DIRECT_METHOD_EPACKET,
  DIRECT_METHOD_AIRMAIL,
  SHIPPING_MODE_DIRETO,
  SHIPPING_MODE_LOTE,
} from '../../../../lib/brazilPriceCalculator'
import { openComparativeSearchTabs } from '../../../../lib/comparativeSearch'

function shippingLabel(row) {
  if (row.shipping_mode === SHIPPING_MODE_LOTE) {
    return `Lote ${row.lote_kg ?? '?'} kg (EMS)`
  }
  if (row.direct_method === DIRECT_METHOD_EPACKET) return 'Direto · ePacket'
  if (row.direct_method === DIRECT_METHOD_AIRMAIL) return 'Direto · Airmail'
  if (row.direct_method === DIRECT_METHOD_EMS) return 'Direto · EMS'
  return 'Direto'
}

function toComparativeDiffPercent(finalPriceBrl, comparativePriceBrl) {
  const finalVal = Number(finalPriceBrl) || 0
  const comparativeVal = Number(comparativePriceBrl) || 0
  if (comparativeVal <= 0) return null
  return ((finalVal - comparativeVal) / comparativeVal) * 100
}

function formatComparativeDiff(diffPercent) {
  if (!Number.isFinite(diffPercent)) return '—'
  const sign = diffPercent > 0 ? '+' : ''
  return `${sign}${diffPercent.toFixed(2)}%`
}

export default function CalculadoraBrasilSection() {
  const { activeTab } = useAdminContext()
  const [viewMode, setViewMode] = useState('loja')
  const [items, setItems] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [duplicatingId, setDuplicatingId] = useState('')
  const [savingTemplateId, setSavingTemplateId] = useState('')
  const [deletingTemplateId, setDeletingTemplateId] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [baseProduct, setBaseProduct] = useState(null)
  const [listError, setListError] = useState('')
  const isStoreView = viewMode !== 'cliente'

  const loadItems = useCallback(async () => {
    setLoading(true)
    setListError('')
    const [productsResult, templatesResult] = await Promise.all([
      listCalculatorProductsAdmin(),
      listCalculatorProductTemplatesAdmin(),
    ])
    if (productsResult.error || templatesResult.error) {
      setListError(
        productsResult.error?.message
        || templatesResult.error?.message
        || 'Falha ao carregar produtos e templates da calculadora.'
      )
    }
    if (productsResult.error) {
      setItems([])
    } else {
      setItems(productsResult.data)
    }
    if (templatesResult.error) {
      setTemplates([])
    } else {
      setTemplates(templatesResult.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab !== 'calculadora_brasil') return
    void loadItems()
  }, [activeTab, loadItems])

  const handleDelete = async (id) => {
    if (!id) return
    if (!window.confirm('Remover este produto da lista da calculadora?')) return
    setDeletingId(id)
    const { error } = await deleteCalculatorProductAdmin(id)
    if (error) {
      setListError(error.message || 'Falha ao remover produto.')
    } else {
      setItems((prev) => prev.filter((row) => row.id !== id))
      if (editingProduct?.id === id) setEditingProduct(null)
    }
    setDeletingId('')
  }

  const handleEdit = (row) => {
    setBaseProduct(null)
    setEditingProduct(row)
    setListError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaved = () => {
    setEditingProduct(null)
    setBaseProduct(null)
    void loadItems()
  }

  const handleDuplicate = async (row) => {
    if (!row?.id) return
    setDuplicatingId(row.id)
    setListError('')
    const { error } = await duplicateCalculatorProductAdmin(row)
    if (error) {
      setListError(error.message || 'Falha ao duplicar produto.')
    } else {
      await loadItems()
    }
    setDuplicatingId('')
  }

  const handleCreateTemplate = async (row) => {
    if (!row?.id) return
    const name = window.prompt('Nome do template:', row.name || '')
    if (name == null) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setListError('Informe um nome para o template.')
      return
    }

    setSavingTemplateId(row.id)
    setListError('')
    const snap = row.calculation_snapshot && typeof row.calculation_snapshot === 'object'
      ? row.calculation_snapshot
      : {}
    const snapInputs = snap.inputs && typeof snap.inputs === 'object' ? snap.inputs : {}
    const templateData = {
      notes: row.notes || null,
      base_cost_yen: row.base_cost_yen,
      declared_value_yen: row.declared_value_yen,
      weight_grams: row.weight_grams,
      shipping_mode: row.shipping_mode,
      direct_method: row.direct_method,
      lote_kg: row.lote_kg,
      customs_factor: row.customs_factor,
      margin_percent: row.margin_percent,
      comparative_price_brl: row.comparative_price_brl,
      packaging_brl: row.packaging_brl,
      local_shipping_brl: row.local_shipping_brl,
      // Snapshot só com entradas reutilizáveis; câmbio/preço final são recalculados na aplicação.
      calculation_snapshot: {
        inputs: {
          quantity: snapInputs.quantity ?? 1,
          applyIof: Boolean(snapInputs.applyIof),
          iofPercent: snapInputs.iofPercent,
          paymentFeePercents: snapInputs.paymentFeePercents || {},
          paymentFixedUsdByMethod: snapInputs.paymentFixedUsdByMethod || {},
          unitBaseCostYen: snapInputs.unitBaseCostYen,
          unitDeclaredValueInput: snapInputs.unitDeclaredValueInput,
          unitDeclaredValueYen: snapInputs.unitDeclaredValueYen,
          unitWeightGrams: snapInputs.unitWeightGrams,
          shippingMode: snapInputs.shippingMode,
          directMethod: snapInputs.directMethod,
          loteKg: snapInputs.loteKg,
          customsFactor: snapInputs.customsFactor,
          marginPercent: snapInputs.marginPercent,
          packagingBrl: snapInputs.packagingBrl,
          localShippingBrl: snapInputs.localShippingBrl,
        },
      },
    }
    const { error } = await createCalculatorProductTemplateAdmin(trimmedName, templateData)
    if (error) {
      setListError(error.message || 'Falha ao criar template.')
    } else {
      await loadItems()
    }
    setSavingTemplateId('')
  }

  const handleUseTemplate = (template) => {
    const data = template?.template_data
    if (!data || typeof data !== 'object') {
      setListError('Este template não possui dados válidos.')
      return
    }
    setEditingProduct(null)
    setBaseProduct({
      ...data,
      name: '',
      __templateName: template.name,
      __templateKey: `${template.id}-${Date.now()}`,
    })
    setListError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteTemplate = async (id) => {
    if (!id) return
    if (!window.confirm('Remover este template da calculadora?')) return
    setDeletingTemplateId(id)
    setListError('')
    const { error } = await deleteCalculatorProductTemplateAdmin(id)
    if (error) {
      setListError(error.message || 'Falha ao remover template.')
    } else {
      setTemplates((prev) => prev.filter((template) => template.id !== id))
    }
    setDeletingTemplateId('')
  }

  const handleCompare = (title) => {
    const opened = openComparativeSearchTabs(title)
    if (!opened) {
      setListError('Informe um título de produto para pesquisar.')
      return
    }
    setListError('')
  }

  if (activeTab !== 'calculadora_brasil') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Calculadora Brasil</h2>
          <p className="mt-1 text-sm text-earth-600">
            {isStoreView
              ? 'Visão loja: formulário completo com margem, custos internos e lucro.'
              : 'Visão cliente: apenas produto, envio e valores finais.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-earth-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('loja')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              isStoreView
                ? 'bg-earth-900 text-white'
                : 'text-earth-700 hover:bg-earth-50'
            }`}
          >
            Visão loja
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cliente')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              !isStoreView
                ? 'bg-earth-900 text-white'
                : 'text-earth-700 hover:bg-earth-50'
            }`}
          >
            Visão cliente
          </button>
        </div>
      </div>

      <BrazilPriceCalculatorPanel
        viewMode={viewMode}
        editingProduct={editingProduct}
        baseProduct={baseProduct}
        onCancelEdit={() => {
          setEditingProduct(null)
          setBaseProduct(null)
        }}
        onRegistered={handleSaved}
      />

      {isStoreView ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-3">
            <h3 className="font-medium text-earth-900">Templates da calculadora</h3>
            <p className="text-xs text-earth-600">
              Use um template para preencher um novo produto com os mesmos custos, envio, margem e taxas.
            </p>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-earth-600">
              Nenhum template criado. Use “Criar template” em um produto cadastrado.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const data = template.template_data || {}
                return (
                  <div key={template.id} className="rounded-lg border border-amber-200 bg-white p-3">
                    <p className="font-medium text-earth-900">{template.name}</p>
                    <p className="mt-1 text-xs text-earth-600">
                      Margem {Number(data.margin_percent || 0)}% · {shippingLabel(data)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(template)}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-950"
                      >
                        Usar como base
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTemplate(template.id)}
                        disabled={deletingTemplateId === template.id}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingTemplateId === template.id ? 'Removendo...' : 'Remover'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className={`mt-8 ${isStoreView ? 'rounded-lg border border-earth-200 bg-white p-4' : ''}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`font-medium text-earth-900 ${isStoreView ? '' : 'text-base'}`}>
              {isStoreView ? 'Produtos cadastrados pela calculadora' : 'Escolha um produto'}
            </h3>
            <p className="text-xs text-earth-600">
              {isStoreView
                ? `${items.length} registro(s)`
                : 'Clique em um item para montar a proposta acima'}
            </p>
          </div>
          {isStoreView ? (
            <button
              type="button"
              onClick={() => void loadItems()}
              disabled={loading}
              className="rounded border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-50 disabled:opacity-50"
            >
              {loading ? 'Atualizando...' : 'Atualizar lista'}
            </button>
          ) : null}
        </div>

        {isStoreView && listError ? (
          <p className="mb-3 text-sm text-red-700">{listError}</p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="text-sm text-earth-600">Carregando...</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="text-sm text-earth-600">
            {isStoreView
              ? 'Nenhum produto cadastrado ainda. Use o formulário acima e clique em "Cadastrar produto".'
              : 'Nenhum produto disponível.'}
          </p>
        ) : null}

        {items.length > 0 && !isStoreView ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => {
              const selected = editingProduct?.id === row.id
              const comparativePrice = Number(row.comparative_price_brl) || 0
              const comparativeDiff = toComparativeDiffPercent(row.final_price_brl, row.comparative_price_brl)
              const comparativeDiffClass = comparativeDiff == null
                ? 'text-earth-500'
                : comparativeDiff > 0
                  ? 'text-red-700'
                  : comparativeDiff < 0
                    ? 'text-emerald-700'
                    : 'text-earth-700'
              return (
                <div
                  key={row.id}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-200'
                      : 'border-earth-200 bg-white hover:border-earth-300 hover:shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleEdit(row)}
                    className="w-full text-left"
                  >
                    <p className="font-semibold text-earth-900">{row.name}</p>
                    <p className="mt-1 text-xs text-earth-500">
                      {formatWeight((row.weight_grams || 0) / 1000)} · {shippingLabel(row)}
                    </p>
                    <p className="mt-3 text-lg font-bold text-emerald-800">
                      {formatBRL(row.final_price_brl)}
                    </p>
                    <p className="mt-0.5 text-xs text-earth-500">
                      {formatJPY(brlToYen(row.final_price_brl, row.brl_per_jpy))}
                    </p>
                    {comparativePrice > 0 ? (
                      <p className={`mt-1 text-xs font-medium ${comparativeDiffClass}`}>
                        Comparativo BR: {formatBRL(comparativePrice)} · Dif.: {formatComparativeDiff(comparativeDiff)}
                      </p>
                    ) : null}
                    {selected ? (
                      <p className="mt-3 text-xs font-medium text-emerald-700">Selecionado</p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompare(row.name)}
                    className="mt-3 text-xs font-semibold text-sky-700 hover:text-sky-900"
                    title="Abrir OLX, Mercado Livre e Google com o título do produto"
                  >
                    Comparar preços
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {items.length > 0 && isStoreView ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-earth-200 text-xs uppercase tracking-wide text-earth-500">
                  <th className="px-2 py-2">Produto</th>
                  <th className="px-2 py-2">Peso</th>
                  <th className="px-2 py-2">Envio</th>
                  <th className="px-2 py-2">Custo base</th>
                  <th className="px-2 py-2">Custo no BR</th>
                  <th className="px-2 py-2">Margem</th>
                  <th className="px-2 py-2">Preço final</th>
                  <th className="px-2 py-2">Preço comparativo</th>
                  <th className="px-2 py-2">Dif. (%)</th>
                  <th className="px-2 py-2">Lucro líq.</th>
                  <th className="px-2 py-2">Cadastro</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const comparativePrice = Number(row.comparative_price_brl) || 0
                  const comparativeDiff = toComparativeDiffPercent(row.final_price_brl, row.comparative_price_brl)
                  const comparativeDiffClass = comparativeDiff == null
                    ? 'text-earth-500'
                    : comparativeDiff > 0
                      ? 'text-red-700'
                      : comparativeDiff < 0
                        ? 'text-emerald-700'
                        : 'text-earth-700'
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-earth-100 hover:bg-earth-50/80 ${editingProduct?.id === row.id ? 'bg-amber-50/80' : ''}`}
                  >
                    <td className="px-2 py-2 font-medium text-earth-900">{row.name}</td>
                    <td className="px-2 py-2 text-earth-700">{formatWeight((row.weight_grams || 0) / 1000)}</td>
                    <td className="px-2 py-2 text-earth-700">{shippingLabel(row)}</td>
                    <td className="px-2 py-2 text-earth-700 whitespace-nowrap">
                      {formatPairFromYen(row.base_cost_yen, row.brl_per_jpy)}
                    </td>
                    <td className="px-2 py-2 text-earth-700 whitespace-nowrap">
                      {formatPairFromBrl(row.landed_cost_brl, row.brl_per_jpy)}
                    </td>
                    <td className="px-2 py-2 text-earth-700">{Number(row.margin_percent)}%</td>
                    <td className="px-2 py-2 font-semibold text-emerald-800 whitespace-nowrap">
                      {formatPairFromBrl(row.final_price_brl, row.brl_per_jpy)}
                    </td>
                    <td className="px-2 py-2 text-earth-700 whitespace-nowrap">
                      {comparativePrice > 0 ? formatBRL(comparativePrice) : '—'}
                    </td>
                    <td className={`px-2 py-2 font-medium whitespace-nowrap ${comparativeDiffClass}`}>
                      {comparativePrice > 0 ? formatComparativeDiff(comparativeDiff) : '—'}
                    </td>
                    <td className="px-2 py-2 font-medium text-sky-800 whitespace-nowrap">
                      {formatPairFromBrl(
                        Number(row.final_price_brl) - Number(row.landed_cost_brl),
                        row.brl_per_jpy,
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-earth-500">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="text-xs font-medium text-earth-700 hover:text-earth-900"
                        >
                          {editingProduct?.id === row.id ? 'Editando' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompare(row.name)}
                          className="text-xs font-medium text-sky-700 hover:text-sky-900"
                          title="Abrir OLX, Mercado Livre e Google com o título do produto"
                        >
                          Comparar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDuplicate(row)}
                          disabled={duplicatingId === row.id}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                        >
                          {duplicatingId === row.id ? 'Duplicando...' : 'Duplicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCreateTemplate(row)}
                          disabled={savingTemplateId === row.id}
                          className="text-xs font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
                        >
                          {savingTemplateId === row.id ? 'Salvando...' : 'Criar template'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === row.id ? 'Removendo...' : 'Remover'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
