import { useCallback, useEffect, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import BrazilPriceCalculatorPanel from './BrazilPriceCalculatorPanel'
import { formatBRL, formatJPY, formatWeight } from '../../../../lib/fx'
import {
  deleteCalculatorProductAdmin,
  listCalculatorProductsAdmin,
} from '../../../../services/calculatorProductService'
import {
  DIRECT_METHOD_EMS,
  DIRECT_METHOD_EPACKET,
  SHIPPING_MODE_DIRETO,
  SHIPPING_MODE_LOTE,
} from '../../../../lib/brazilPriceCalculator'

function shippingLabel(row) {
  if (row.shipping_mode === SHIPPING_MODE_LOTE) {
    return `Lote ${row.lote_kg ?? '?'} kg (EMS)`
  }
  if (row.direct_method === DIRECT_METHOD_EPACKET) return 'Direto · ePacket'
  if (row.direct_method === DIRECT_METHOD_EMS) return 'Direto · EMS'
  return 'Direto'
}

export default function CalculadoraBrasilSection() {
  const { activeTab } = useAdminContext()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [listError, setListError] = useState('')

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
      <h2 className="text-lg font-semibold text-earth-900">Calculadora Brasil</h2>
      <p className="mt-1 text-sm text-earth-600">
        Calcule o preço final no Brasil e cadastre produtos para consulta posterior nesta aba.
      </p>

      <BrazilPriceCalculatorPanel
        editingProduct={editingProduct}
        onCancelEdit={() => setEditingProduct(null)}
        onRegistered={handleSaved}
      />

      <div className="mt-8 rounded-lg border border-earth-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-earth-900">Produtos cadastrados pela calculadora</h3>
            <p className="text-xs text-earth-600">{items.length} registro(s)</p>
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className="rounded border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-50 disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </div>

        {listError ? (
          <p className="mb-3 text-sm text-red-700">{listError}</p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="text-sm text-earth-600">Carregando...</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="text-sm text-earth-600">
            Nenhum produto cadastrado ainda. Use o formulário acima e clique em &quot;Cadastrar produto&quot;.
          </p>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-earth-200 text-xs uppercase tracking-wide text-earth-500">
                  <th className="px-2 py-2">Produto</th>
                  <th className="px-2 py-2">Custo ¥</th>
                  <th className="px-2 py-2">Peso</th>
                  <th className="px-2 py-2">Envio</th>
                  <th className="px-2 py-2">Custo BR</th>
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
                    <td className="px-2 py-2 text-earth-700">{formatJPY(row.base_cost_yen)}</td>
                    <td className="px-2 py-2 text-earth-700">{formatWeight((row.weight_grams || 0) / 1000)}</td>
                    <td className="px-2 py-2 text-earth-700">{shippingLabel(row)}</td>
                    <td className="px-2 py-2 text-earth-700">{formatBRL(row.landed_cost_brl)}</td>
                    <td className="px-2 py-2 text-earth-700">{Number(row.margin_percent)}%</td>
                    <td className="px-2 py-2 font-semibold text-emerald-800">{formatBRL(row.final_price_brl)}</td>
                    <td className="px-2 py-2 font-medium text-sky-800">
                      {formatBRL(
                        Number(row.final_price_brl) - Number(row.landed_cost_brl),
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
