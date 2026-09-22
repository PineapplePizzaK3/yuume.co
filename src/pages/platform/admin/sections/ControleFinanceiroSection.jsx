import { useEffect, useMemo, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import {
  deleteFinancialExpense,
  deleteManualOrder,
  getFinancialSummary,
  getManualOrder,
  listFinancialExpenses,
  listManualOrders,
  saveFinancialExpense,
  saveManualOrder,
} from '../../../../services/financialControlService'

const ORDER_PAGE_SIZE = 20
const EXPENSE_PAGE_SIZE = 30
const CURRENCIES = ['JPY', 'USD', 'BRL']
const EXPENSE_KIND_OPTIONS = [
  { value: 'general', label: 'Geral' },
  { value: 'shipping', label: 'Frete pago' },
  { value: 'order_related', label: 'Despesa do pedido' },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function parseNum(value, fallback = 0) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function initialOrderItem() {
  return { product_name: '', quantity: '1', unit_sale_amount: '', unit_cost_amount: '' }
}

function initialOrderForm() {
  return {
    id: '',
    reference: '',
    sale_date: todayIso(),
    customer_name: '',
    currency: 'JPY',
    exchange_rate_to_jpy: '1',
    shipping_charged_amount: '0',
    discount_amount: '0',
    refund_amount: '0',
    notes: '',
    items: [initialOrderItem()],
  }
}

function initialExpenseForm() {
  return {
    id: '',
    expense_date: todayIso(),
    category: '',
    description: '',
    amount: '',
    currency: 'JPY',
    exchange_rate_to_jpy: '1',
    expense_kind: 'general',
    manual_order_id: '',
    notes: '',
  }
}

function money(value, currency = 'JPY') {
  const amount = Number(value || 0)
  return amount.toLocaleString('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ControleFinanceiroSection() {
  const { activeTab, setMessage, formatJPY } = useAdminContext()
  const [view, setView] = useState('resumo')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState({ kpis: {}, monthly: [], expenses_by_category: [] })

  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersRows, setOrdersRows] = useState([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersPage, setOrdersPage] = useState(0)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderForm, setOrderForm] = useState(() => initialOrderForm())

  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)
  const [expenseRows, setExpenseRows] = useState([])
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [expensePage, setExpensePage] = useState(0)
  const [expenseCategories, setExpenseCategories] = useState([])
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('')
  const [expenseForm, setExpenseForm] = useState(() => initialExpenseForm())

  const hasOrdersPrev = ordersPage > 0
  const hasOrdersNext = (ordersPage + 1) * ORDER_PAGE_SIZE < ordersTotal
  const hasExpensesPrev = expensePage > 0
  const hasExpensesNext = (expensePage + 1) * EXPENSE_PAGE_SIZE < expenseTotal

  const fmtJpy = (value) => {
    if (typeof formatJPY === 'function') return formatJPY(value)
    return money(value, 'JPY')
  }

  const orderPreview = useMemo(() => {
    const rate = Math.max(parseNum(orderForm.exchange_rate_to_jpy, 1), 0.000001)
    const itemsSale = orderForm.items.reduce((sum, item) => sum + parseNum(item.quantity, 0) * parseNum(item.unit_sale_amount, 0), 0)
    const itemsCost = orderForm.items.reduce((sum, item) => sum + parseNum(item.quantity, 0) * parseNum(item.unit_cost_amount, 0), 0)
    const shipping = parseNum(orderForm.shipping_charged_amount, 0)
    const discount = parseNum(orderForm.discount_amount, 0)
    const refund = parseNum(orderForm.refund_amount, 0)
    const grossRevenue = itemsSale + shipping
    const netRevenue = grossRevenue - discount - refund
    const grossProfit = netRevenue - itemsCost
    return {
      itemsSale,
      itemsCost,
      grossRevenue,
      netRevenue,
      grossProfit,
      rate,
      grossRevenueJpy: grossRevenue * rate,
      netRevenueJpy: netRevenue * rate,
      grossProfitJpy: grossProfit * rate,
    }
  }, [orderForm])

  async function loadSummary(period = {}) {
    setSummaryLoading(true)
    const { data, error } = await getFinancialSummary({
      from: period.from ?? fromDate,
      to: period.to ?? toDate,
    })
    if (error) setMessage(error.message || 'Erro ao carregar resumo financeiro')
    else setSummary(data || { kpis: {}, monthly: [], expenses_by_category: [] })
    setSummaryLoading(false)
  }

  async function loadOrders(page = ordersPage, period = {}) {
    setOrdersLoading(true)
    const { data, error } = await listManualOrders({
      from: period.from ?? fromDate,
      to: period.to ?? toDate,
      search: ordersSearch,
      limit: ORDER_PAGE_SIZE,
      offset: page * ORDER_PAGE_SIZE,
    })
    if (error) setMessage(error.message || 'Erro ao carregar pedidos finalizados')
    else {
      setOrdersRows(data?.rows || [])
      setOrdersTotal(Number(data?.total) || 0)
    }
    setOrdersLoading(false)
  }

  async function loadExpenses(page = expensePage, period = {}) {
    setExpensesLoading(true)
    const { data, error } = await listFinancialExpenses({
      from: period.from ?? fromDate,
      to: period.to ?? toDate,
      category: expenseCategoryFilter,
      limit: EXPENSE_PAGE_SIZE,
      offset: page * EXPENSE_PAGE_SIZE,
    })
    if (error) setMessage(error.message || 'Erro ao carregar despesas')
    else {
      setExpenseRows(data?.rows || [])
      setExpenseTotal(Number(data?.total) || 0)
      setExpenseCategories(Array.isArray(data?.categories) ? data.categories : [])
    }
    setExpensesLoading(false)
  }

  async function refreshAll(opts = {}) {
    const period = {
      from: opts.from ?? fromDate,
      to: opts.to ?? toDate,
    }
    const orderPage = Number.isFinite(opts.orderPage) ? opts.orderPage : ordersPage
    const nextExpensePage = Number.isFinite(opts.expensePage) ? opts.expensePage : expensePage
    await Promise.all([
      loadSummary(period),
      loadOrders(orderPage, period),
      loadExpenses(nextExpensePage, period),
    ])
  }

  useEffect(() => {
    if (activeTab !== 'controle_financeiro') return
    void refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'controle_financeiro') return
    void loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersPage])

  useEffect(() => {
    if (activeTab !== 'controle_financeiro') return
    void loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expensePage])

  if (activeTab !== 'controle_financeiro') return null

  const kpis = summary?.kpis || {}

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Controle financeiro (manual)</h2>
      <p className="mt-1 text-sm text-earth-600">
        Cadastro de pedidos finalizados, frete e despesas para apuracao gerencial em JPY.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-earth-600">De</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-full rounded border border-earth-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-earth-600">Ate</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-full rounded border border-earth-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="button"
            onClick={async () => {
              const nextOrderPage = 0
              const nextExpensePage = 0
              setOrdersPage(nextOrderPage)
              setExpensePage(nextExpensePage)
              await refreshAll({ orderPage: nextOrderPage, expensePage: nextExpensePage })
            }}
            className="rounded bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
          >
            Atualizar periodo
          </button>
          <button
            type="button"
            onClick={async () => {
              setFromDate('')
              setToDate('')
              const nextOrderPage = 0
              const nextExpensePage = 0
              setOrdersPage(nextOrderPage)
              setExpensePage(nextExpensePage)
              await refreshAll({ from: '', to: '', orderPage: nextOrderPage, expensePage: nextExpensePage })
            }}
            className="rounded border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Limpar periodo
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('resumo')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${view === 'resumo' ? 'bg-earth-900 text-white' : 'border border-earth-300 bg-white text-earth-700'}`}
        >
          Resumo
        </button>
        <button
          type="button"
          onClick={() => setView('pedidos')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${view === 'pedidos' ? 'bg-earth-900 text-white' : 'border border-earth-300 bg-white text-earth-700'}`}
        >
          Pedidos finalizados
        </button>
        <button
          type="button"
          onClick={() => setView('despesas')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${view === 'despesas' ? 'bg-earth-900 text-white' : 'border border-earth-300 bg-white text-earth-700'}`}
        >
          Despesas
        </button>
      </div>

      {view === 'resumo' && (
        <div className="mt-4 space-y-4">
          {summaryLoading ? (
            <p className="text-sm text-earth-600">Carregando resumo...</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-earth-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-earth-500">Receita bruta</p>
                  <p className="mt-1 text-lg font-semibold text-earth-900">{fmtJpy(kpis.gross_revenue_jpy || 0)}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-earth-500">Receita liquida</p>
                  <p className="mt-1 text-lg font-semibold text-earth-900">{fmtJpy(kpis.net_revenue_jpy || 0)}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-earth-500">Lucro bruto</p>
                  <p className="mt-1 text-lg font-semibold text-earth-900">{fmtJpy(kpis.gross_profit_jpy || 0)}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-earth-500">Lucro liquido</p>
                  <p className="mt-1 text-lg font-semibold text-earth-900">{fmtJpy(kpis.net_profit_after_general_jpy || 0)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-earth-200 bg-white p-3 text-sm">
                  <p className="text-earth-600">Pedidos</p>
                  <p className="font-semibold text-earth-900">{Number(kpis.orders_count || 0)}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3 text-sm">
                  <p className="text-earth-600">Unidades vendidas</p>
                  <p className="font-semibold text-earth-900">{Number(kpis.units_total || 0).toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3 text-sm">
                  <p className="text-earth-600">Ticket medio</p>
                  <p className="font-semibold text-earth-900">{fmtJpy(kpis.ticket_medio_jpy || 0)}</p>
                </div>
                <div className="rounded-lg border border-earth-200 bg-white p-3 text-sm">
                  <p className="text-earth-600">Margem liquida</p>
                  <p className="font-semibold text-earth-900">{Number(kpis.margem_liquida_percent || 0).toFixed(2)}%</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-earth-900">Evolucao mensal</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-earth-200 text-earth-600">
                          <th className="px-2 py-2 text-left">Mes</th>
                          <th className="px-2 py-2 text-right">Pedidos</th>
                          <th className="px-2 py-2 text-right">Receita liquida</th>
                          <th className="px-2 py-2 text-right">Lucro liquido final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary?.monthly || []).map((row) => (
                          <tr key={row.month} className="border-b border-earth-100">
                            <td className="px-2 py-2">{row.month}</td>
                            <td className="px-2 py-2 text-right">{row.orders_count}</td>
                            <td className="px-2 py-2 text-right">{fmtJpy(row.net_revenue_jpy || 0)}</td>
                            <td className="px-2 py-2 text-right">{fmtJpy(row.net_after_general_jpy || 0)}</td>
                          </tr>
                        ))}
                        {(summary?.monthly || []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-3 text-center text-earth-500">
                              Sem dados no periodo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-earth-900">Despesas por categoria</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-earth-200 text-earth-600">
                          <th className="px-2 py-2 text-left">Categoria</th>
                          <th className="px-2 py-2 text-right">Total JPY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary?.expenses_by_category || []).map((row) => (
                          <tr key={`${row.category}-${row.amount_jpy}`} className="border-b border-earth-100">
                            <td className="px-2 py-2">{row.category}</td>
                            <td className="px-2 py-2 text-right">{fmtJpy(row.amount_jpy || 0)}</td>
                          </tr>
                        ))}
                        {(summary?.expenses_by_category || []).length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-2 py-3 text-center text-earth-500">
                              Sem despesas cadastradas no periodo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'pedidos' && (
        <div className="mt-4 space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setOrderSubmitting(true)
              const payload = {
                ...orderForm,
                items: orderForm.items,
              }
              const { data, error } = await saveManualOrder(payload)
              setOrderSubmitting(false)
              if (error) {
                setMessage(error.message || 'Erro ao salvar pedido manual')
                return
              }
              setMessage(`Pedido salvo: ${data?.reference || 'ok'}`)
              setOrderForm(initialOrderForm())
              setOrdersPage(0)
              await refreshAll()
            }}
            className="rounded-lg border border-earth-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-earth-900">
                {orderForm.id ? 'Editar pedido finalizado' : 'Novo pedido finalizado'}
              </h3>
              {orderForm.id && (
                <button
                  type="button"
                  onClick={() => setOrderForm(initialOrderForm())}
                  className="rounded border border-earth-300 px-3 py-1 text-xs text-earth-700 hover:bg-earth-100"
                >
                  Novo
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <input
                required
                placeholder="Referencia *"
                value={orderForm.reference}
                onChange={(e) => setOrderForm((s) => ({ ...s, reference: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                required
                value={orderForm.sale_date}
                onChange={(e) => setOrderForm((s) => ({ ...s, sale_date: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Cliente (opcional)"
                value={orderForm.customer_name}
                onChange={(e) => setOrderForm((s) => ({ ...s, customer_name: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <select
                value={orderForm.currency}
                onChange={(e) => {
                  const next = e.target.value
                  setOrderForm((s) => ({
                    ...s,
                    currency: next,
                    exchange_rate_to_jpy: next === 'JPY' ? '1' : s.exchange_rate_to_jpy,
                  }))
                }}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <input
                type="number"
                step="0.000001"
                min="0.000001"
                required
                placeholder="Taxa para JPY"
                value={orderForm.exchange_rate_to_jpy}
                onChange={(e) => setOrderForm((s) => ({ ...s, exchange_rate_to_jpy: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Frete cobrado"
                value={orderForm.shipping_charged_amount}
                onChange={(e) => setOrderForm((s) => ({ ...s, shipping_charged_amount: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Desconto"
                value={orderForm.discount_amount}
                onChange={(e) => setOrderForm((s) => ({ ...s, discount_amount: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Reembolso"
                value={orderForm.refund_amount}
                onChange={(e) => setOrderForm((s) => ({ ...s, refund_amount: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              />
            </div>

            <textarea
              rows={2}
              placeholder="Observacoes"
              value={orderForm.notes}
              onChange={(e) => setOrderForm((s) => ({ ...s, notes: e.target.value }))}
              className="w-full rounded border border-earth-300 px-3 py-2 text-sm"
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-earth-800">Itens do pedido</p>
                <button
                  type="button"
                  onClick={() => setOrderForm((s) => ({ ...s, items: [...s.items, initialOrderItem()] }))}
                  className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-700 hover:bg-earth-100"
                >
                  + Item
                </button>
              </div>
              <div className="space-y-2">
                {orderForm.items.map((item, index) => (
                  <div key={`item-${index}`} className="grid gap-2 md:grid-cols-12">
                    <input
                      placeholder="Produto"
                      value={item.product_name}
                      onChange={(e) =>
                        setOrderForm((s) => ({
                          ...s,
                          items: s.items.map((row, i) => (i === index ? { ...row, product_name: e.target.value } : row)),
                        }))
                      }
                      className="md:col-span-5 rounded border border-earth-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) =>
                        setOrderForm((s) => ({
                          ...s,
                          items: s.items.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)),
                        }))
                      }
                      className="md:col-span-2 rounded border border-earth-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Venda un."
                      value={item.unit_sale_amount}
                      onChange={(e) =>
                        setOrderForm((s) => ({
                          ...s,
                          items: s.items.map((row, i) => (i === index ? { ...row, unit_sale_amount: e.target.value } : row)),
                        }))
                      }
                      className="md:col-span-2 rounded border border-earth-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Custo un."
                      value={item.unit_cost_amount}
                      onChange={(e) =>
                        setOrderForm((s) => ({
                          ...s,
                          items: s.items.map((row, i) => (i === index ? { ...row, unit_cost_amount: e.target.value } : row)),
                        }))
                      }
                      className="md:col-span-2 rounded border border-earth-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOrderForm((s) => ({
                          ...s,
                          items: s.items.length === 1 ? [initialOrderItem()] : s.items.filter((_, i) => i !== index),
                        }))
                      }
                      className="md:col-span-1 rounded border border-red-300 px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-earth-200 bg-earth-50 p-3 text-sm">
              <p><strong>Receita bruta:</strong> {money(orderPreview.grossRevenue, orderForm.currency)} ({fmtJpy(orderPreview.grossRevenueJpy)})</p>
              <p><strong>Receita liquida:</strong> {money(orderPreview.netRevenue, orderForm.currency)} ({fmtJpy(orderPreview.netRevenueJpy)})</p>
              <p><strong>Lucro bruto estimado:</strong> {money(orderPreview.grossProfit, orderForm.currency)} ({fmtJpy(orderPreview.grossProfitJpy)})</p>
            </div>

            <button
              type="submit"
              disabled={orderSubmitting}
              className="rounded bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
            >
              {orderSubmitting ? 'Salvando...' : 'Salvar pedido finalizado'}
            </button>
          </form>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                placeholder="Buscar por referencia, cliente ou observacao"
                className="min-w-[260px] flex-1 rounded border border-earth-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  setOrdersPage(0)
                    await loadOrders(0)
                }}
                className="rounded border border-earth-300 px-4 py-2 text-sm text-earth-700 hover:bg-earth-100"
              >
                Buscar
              </button>
            </div>

            {ordersLoading ? (
              <p className="text-sm text-earth-600">Carregando pedidos...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-earth-200 text-earth-600">
                      <th className="px-2 py-2 text-left">Data</th>
                      <th className="px-2 py-2 text-left">Referencia</th>
                      <th className="px-2 py-2 text-left">Cliente</th>
                      <th className="px-2 py-2 text-right">Receita liquida (JPY)</th>
                      <th className="px-2 py-2 text-right">Lucro liquido (JPY)</th>
                      <th className="px-2 py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersRows.map((row) => (
                      <tr key={row.id} className="border-b border-earth-100">
                        <td className="px-2 py-2">{row.sale_date}</td>
                        <td className="px-2 py-2 font-medium text-earth-900">{row.reference}</td>
                        <td className="px-2 py-2">{row.customer_name || '-'}</td>
                        <td className="px-2 py-2 text-right">{fmtJpy(row.net_revenue_jpy || 0)}</td>
                        <td className="px-2 py-2 text-right">{fmtJpy(row.net_profit_jpy || 0)}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const { data, error } = await getManualOrder(row.id)
                                if (error) {
                                  setMessage(error.message || 'Erro ao abrir pedido')
                                  return
                                }
                                setOrderForm({
                                  id: data?.id || '',
                                  reference: data?.reference || '',
                                  sale_date: data?.sale_date || todayIso(),
                                  customer_name: data?.customer_name || '',
                                  currency: data?.currency || 'JPY',
                                  exchange_rate_to_jpy: String(data?.exchange_rate_to_jpy ?? '1'),
                                  shipping_charged_amount: String(data?.shipping_charged_amount ?? '0'),
                                  discount_amount: String(data?.discount_amount ?? '0'),
                                  refund_amount: String(data?.refund_amount ?? '0'),
                                  notes: data?.notes || '',
                                  items: Array.isArray(data?.items) && data.items.length > 0
                                    ? data.items.map((item) => ({
                                      id: item.id,
                                      product_name: item.product_name || '',
                                      quantity: String(item.quantity ?? '1'),
                                      unit_sale_amount: String(item.unit_sale_amount ?? '0'),
                                      unit_cost_amount: String(item.unit_cost_amount ?? '0'),
                                    }))
                                    : [initialOrderItem()],
                                })
                                setView('pedidos')
                              }}
                              className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-700 hover:bg-earth-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Excluir pedido ${row.reference}?`)) return
                                const { error } = await deleteManualOrder(row.id)
                                if (error) {
                                  setMessage(error.message || 'Erro ao excluir pedido')
                                  return
                                }
                                setMessage('Pedido excluido com sucesso.')
                                await refreshAll()
                              }}
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {ordersRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-3 text-center text-earth-500">Nenhum pedido encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-earth-600">
              <span>Total: {ordersTotal}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!hasOrdersPrev || ordersLoading}
                  onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
                  className="rounded border border-earth-300 px-3 py-1 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!hasOrdersNext || ordersLoading}
                  onClick={() => setOrdersPage((p) => p + 1)}
                  className="rounded border border-earth-300 px-3 py-1 disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'despesas' && (
        <div className="mt-4 space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setExpenseSubmitting(true)
              const { error } = await saveFinancialExpense(expenseForm)
              setExpenseSubmitting(false)
              if (error) {
                setMessage(error.message || 'Erro ao salvar despesa')
                return
              }
              setMessage('Despesa salva com sucesso.')
              setExpenseForm(initialExpenseForm())
              setExpensePage(0)
              await refreshAll()
            }}
            className="rounded-lg border border-earth-200 bg-white p-4 grid gap-3 md:grid-cols-3"
          >
            <input
              type="date"
              required
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm((s) => ({ ...s, expense_date: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Categoria *"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Descricao *"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((s) => ({ ...s, description: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="Valor"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((s) => ({ ...s, amount: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <select
              value={expenseForm.currency}
              onChange={(e) =>
                setExpenseForm((s) => ({
                  ...s,
                  currency: e.target.value,
                  exchange_rate_to_jpy: e.target.value === 'JPY' ? '1' : s.exchange_rate_to_jpy,
                }))
              }
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
            <input
              type="number"
              required
              min="0.000001"
              step="0.000001"
              placeholder="Taxa para JPY"
              value={expenseForm.exchange_rate_to_jpy}
              onChange={(e) => setExpenseForm((s) => ({ ...s, exchange_rate_to_jpy: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <select
              value={expenseForm.expense_kind}
              onChange={(e) => setExpenseForm((s) => ({ ...s, expense_kind: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            >
              {EXPENSE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={expenseForm.manual_order_id}
              onChange={(e) => setExpenseForm((s) => ({ ...s, manual_order_id: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            >
              <option value="">Sem pedido vinculado</option>
              {ordersRows.map((order) => (
                <option key={order.id} value={order.id}>{order.reference}</option>
              ))}
            </select>
            <input
              placeholder="Observacoes"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm((s) => ({ ...s, notes: e.target.value }))}
              className="rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="rounded bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
              >
                {expenseSubmitting ? 'Salvando...' : 'Salvar despesa'}
              </button>
              {expenseForm.id && (
                <button
                  type="button"
                  onClick={() => setExpenseForm(initialExpenseForm())}
                  className="rounded border border-earth-300 px-4 py-2 text-sm text-earth-700 hover:bg-earth-100"
                >
                  Novo
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              >
                <option value="">Todas as categorias</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  setExpensePage(0)
                    await loadExpenses(0)
                }}
                className="rounded border border-earth-300 px-4 py-2 text-sm text-earth-700 hover:bg-earth-100"
              >
                Filtrar
              </button>
            </div>
            {expensesLoading ? (
              <p className="text-sm text-earth-600">Carregando despesas...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-earth-200 text-earth-600">
                      <th className="px-2 py-2 text-left">Data</th>
                      <th className="px-2 py-2 text-left">Categoria</th>
                      <th className="px-2 py-2 text-left">Descricao</th>
                      <th className="px-2 py-2 text-right">Original</th>
                      <th className="px-2 py-2 text-right">JPY</th>
                      <th className="px-2 py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRows.map((row) => (
                      <tr key={row.id} className="border-b border-earth-100">
                        <td className="px-2 py-2">{row.expense_date}</td>
                        <td className="px-2 py-2">{row.category}</td>
                        <td className="px-2 py-2">
                          {row.description}
                          {row.manual_order_reference ? (
                            <span className="ml-1 text-earth-500">({row.manual_order_reference})</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right">{money(row.amount || 0, row.currency || 'JPY')}</td>
                        <td className="px-2 py-2 text-right">{fmtJpy(row.amount_jpy || 0)}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpenseForm({
                                  id: row.id || '',
                                  expense_date: row.expense_date || todayIso(),
                                  category: row.category || '',
                                  description: row.description || '',
                                  amount: String(row.amount ?? ''),
                                  currency: row.currency || 'JPY',
                                  exchange_rate_to_jpy: String(row.exchange_rate_to_jpy ?? '1'),
                                  expense_kind: row.expense_kind || 'general',
                                  manual_order_id: row.manual_order_id || '',
                                  notes: row.notes || '',
                                })
                              }
                              className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-700 hover:bg-earth-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Excluir esta despesa?')) return
                                const { error } = await deleteFinancialExpense(row.id)
                                if (error) {
                                  setMessage(error.message || 'Erro ao excluir despesa')
                                  return
                                }
                                setMessage('Despesa excluida.')
                                await refreshAll()
                              }}
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenseRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-3 text-center text-earth-500">Nenhuma despesa encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-earth-600">
              <span>Total: {expenseTotal}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!hasExpensesPrev || expensesLoading}
                  onClick={() => setExpensePage((p) => Math.max(0, p - 1))}
                  className="rounded border border-earth-300 px-3 py-1 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!hasExpensesNext || expensesLoading}
                  onClick={() => setExpensePage((p) => p + 1)}
                  className="rounded border border-earth-300 px-3 py-1 disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
