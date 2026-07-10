import { useCallback, useEffect, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import BrazilPriceCalculatorPanel from './BrazilPriceCalculatorPanel'
import { brlToYen, formatBRL, formatJPY, formatPairFromBrl, formatPairFromYen, formatWeight } from '../../../../lib/fx'
import {
  deleteCalculatorProductAdmin,
  listCalculatorProductsAdmin,
} from '../../../../services/calculatorProductService'
import {
  DIRECT_METHOD_EMS,
  DIRECT_METHOD_EPACKET,
  DIRECT_METHOD_AIRMAIL,
  SHIPPING_MODE_DIRETO,
  SHIPPING_MODE_LOTE,
} from '../../../../lib/brazilPriceCalculator'

function shippingLabel(row) {
  if (row.shipping_mode === SHIPPING_MODE_LOTE) {
    return `Lote ${row.lote_kg ?? '?'} kg (EMS)`
  }
  if (row.direct_method === DIRECT_METHOD_EPACKET) return 'Direto · ePacket'
  if (row.direct_method === DIRECT_METHOD_AIRMAIL) return 'Direto · Airmail'
  if (row.direct_method === DIRECT_METHOD_EMS) return 'Direto · EMS'
  return 'Direto'
}

export default function CalculadoraBrasilSection() {
  const { activeTab } = useAdminContext()
  const [viewMode, setViewMode] = useState('loja')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [listError, setListError] = useState('')
  const isStoreView = viewMode !== 'cliente'

  const loadItems = useCallback(async () => {
    setLoading(true)
    setListError('')
    const { data, error } = await listCalculatorProductsAdmin()
    if (error) {
      setListError(error.message || 'Falha ao carregar produtos da calculadora.')
      setItems([])
    } else {
      setItems(data)
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
    setEditingProduct(row)
    setListError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaved = () => {
    setEditingProduct(null)
    void loadItems()
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
        onCancelEdit={() => setEditingProduct(null)}
        onRegistered={handleSaved}
      />

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
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => handleEdit(row)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-200'
                      : 'border-earth-200 bg-white hover:border-earth-300 hover:shadow-sm'
                  }`}
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
                  {selected ? (
                    <p className="mt-3 text-xs font-medium text-emerald-700">Selecionado</p>
                  ) : null}
                </button>
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
                  <th className="px-2 py-2">Lucro líq.</th>
                  <th className="px-2 py-2">Cadastro</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
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
                          onClick={() => void handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === row.id ? 'Removendo...' : 'Remover'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
