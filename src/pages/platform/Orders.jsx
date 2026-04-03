/**
 * Orders - Pedidos do usuário.
 * Fluxo: pedido → pagamento do pedido → recebimento (serviços extras) →
 * consolidamos e definimos frete → cliente paga frete → enviamos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { deleteMyOrder, getMyOrders, getOrderById, requestOrderExtraServices, ORDER_STATUS_LABELS } from '../../services/orderService'
import { createCheckoutSession } from '../../services/paymentService'
import { getWallet } from '../../services/walletService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import QuoteProductsList from '../../components/QuoteProductsList'
import OrderAttachments from '../../components/OrderAttachments'
import { downloadInvoicePdfByOrder, getInvoiceByOrder } from '../../services/invoiceService'
import { parseQuoteMessage } from '../../lib/quoteProducts'
import {
  SERVICE_FEE_JPY_PER_ITEM,
  REDIR_ASSISTIDO_FEE_PERCENT,
  PERSONAL_SHOPPING_FEE_PERCENT,
  computeRedirecionamentoPadraoFeeJpy,
} from '../../data/serviceFees'

const ORDERS_PAGE_SIZE = 12
const ORDER_FILTERS = {
  OPEN: 'open',
  COMPLETED: 'completed',
}
const GATEWAY_OPTIONS = [
  {
    id: 'parcelow',
    label: 'Parcelow',
    icon: '🇧🇷',
    details: 'Cartão até 21x, PIX, TED',
  },
  {
    id: 'stripe',
    label: 'Stripe',
    icon: '🌐',
    details: 'Cartão internacional',
  },
]

export default function Orders() {
  const { user, session } = useAuth()
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [selectedGateway, setSelectedGateway] = useState('parcelow')
  const [extraServicesOrderId, setExtraServicesOrderId] = useState(null)
  useEffect(() => {
    if (!payModal.open) {
      setSelectedGateway('parcelow')
    }
  }, [payModal.open])

  const [extraServices, setExtraServices] = useState({ photos: false, video: false })
  const [detailsModal, setDetailsModal] = useState({ open: false, order: null })
  const [deletingId, setDeletingId] = useState(null)
  const [ordersPage, setOrdersPage] = useState(0)
  const [ordersHasMore, setOrdersHasMore] = useState(false)
  const [ordersFilter, setOrdersFilter] = useState(ORDER_FILTERS.OPEN)
  const [targetOrderId, setTargetOrderId] = useState(null)
  const [hasOpenedTargetOrder, setHasOpenedTargetOrder] = useState(false)
  const [invoiceByOrderId, setInvoiceByOrderId] = useState({})
  const [invoiceLoadingByOrderId, setInvoiceLoadingByOrderId] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clearPaymentParams = () => {
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('success')
        url.searchParams.delete('canceled')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      } catch {
        // noop
      }
    }
    if (params.get('success') === 'true') {
      setFeedback('Pagamento realizado com sucesso!')
      clearPaymentParams()
    }
    if (params.get('canceled') === 'true') {
      setFeedback('Pagamento cancelado.')
      clearPaymentParams()
    }
    const orderIdFromQuery = params.get('orderId')
    if (orderIdFromQuery) {
      setTargetOrderId(orderIdFromQuery)
      setHasOpenedTargetOrder(false)
      // Consome o deep-link para evitar reabrir automaticamente ao voltar para a página.
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('orderId')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      } catch {
        // noop
      }
    }
  }, [])

  useEffect(() => {
    setOrdersPage(0)
  }, [ordersFilter])

  useEffect(() => {
    let isActive = true
    const openTargetOrder = async () => {
      if (!user?.id || !targetOrderId || hasOpenedTargetOrder) return

      const orderOnCurrentPage = orders.find((o) => o.id === targetOrderId)
      if (orderOnCurrentPage) {
        if (!isActive) return
        setDetailsModal({ open: true, order: orderOnCurrentPage })
        setHasOpenedTargetOrder(true)
        return
      }

      const { data, error } = await getOrderById(targetOrderId, user.id)
      if (!isActive) return
      if (error || !data) {
        setFeedback('Nao foi possivel localizar o pedido selecionado.')
        setHasOpenedTargetOrder(true)
        return
      }

      setDetailsModal({ open: true, order: data })
      setHasOpenedTargetOrder(true)
    }

    openTargetOrder()
    return () => {
      isActive = false
    }
  }, [user?.id, targetOrderId, hasOpenedTargetOrder, orders])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      const k = cacheKey(user.id, `orders_page_v1_p${ordersPage}`)
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setOrders(cached.orders ?? [])
        setWallet(cached.wallet ?? null)
        setOrdersHasMore(!!cached.hasMore)
        setLoading(false)
      }
      try {
        const [ordersRes, walletRes] = await Promise.all([
          getMyOrders(user.id, {
            limit: ORDERS_PAGE_SIZE,
            offset: ordersPage * ORDERS_PAGE_SIZE,
            ...(ordersFilter === ORDER_FILTERS.COMPLETED
              ? { status: 'completed' }
              : { excludeStatus: 'completed' }),
          }),
          getWallet(user.id),
        ])
        if (!isActive) return
        const list = ordersRes.data ?? []
        setOrders(list)
        setOrdersHasMore(list.length === ORDERS_PAGE_SIZE)
        setWallet(walletRes.data ?? null)
        if (ordersRes.error) setFeedback(ordersRes.error.message)
        writeCache(k, { orders: list, wallet: walletRes.data ?? null, hasMore: list.length === ORDERS_PAGE_SIZE })
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar pedidos')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, ordersPage, ordersFilter])

  useEffect(() => {
    if (!session?.access_token || !Array.isArray(orders) || orders.length === 0) return
    const candidates = orders.filter((o) => isOrderInvoiceEligible(o))
    if (candidates.length === 0) return
    for (const order of candidates) {
      void ensureOrderInvoiceLoaded(order.id)
    }
  }, [orders, session?.access_token])

  const getPayableAmount = (order) => {
    if (order.status !== 'awaiting_payment') return null
    if (order.quote_amount != null && Number(order.quote_amount) > 0) {
      return { amount: Number(order.quote_amount), currency: order.quote_currency || 'JPY', label: 'Orçamento' }
    }
    if (order.total_amount != null && Number(order.total_amount) > 0) {
      return { amount: Number(order.total_amount), currency: 'BRL', label: 'Total' }
    }
    if (order.shipping_cost != null && Number(order.shipping_cost) > 0) {
      return { amount: Number(order.shipping_cost), currency: order.shipping_currency || 'JPY', label: 'Frete' }
    }
    return null
  }

  const getChargeJpy = (order) => {
    const p = getPayableAmount(order)
    if (!p) return null
    const c = (p.currency || 'JPY').toUpperCase()
    const amountJpy = c === 'BRL' ? brlToJpy(p.amount) : p.amount
    const roundedJpy = Math.round(Number(amountJpy) || 0)
    return { amountJpy: roundedJpy, approxBrl: jpyToBrl(roundedJpy), label: p.label }
  }

  const toTriValues = (order, amount, currency = 'JPY') => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return null

    const totalBrl = Number(order?.total_amount)
    const totalUsd = Number(order?.total_amount_usd)
    const hasStoreRefs =
      order?.order_source === 'store' &&
      Number.isFinite(totalBrl) &&
      totalBrl > 0 &&
      Number.isFinite(totalUsd) &&
      totalUsd > 0

    const cur = String(currency || 'JPY').toUpperCase()
    if (cur === 'BRL') {
      const brl = n
      const jpy = Math.round(brlToJpy(brl))
      const usd = hasStoreRefs ? totalUsd * (brl / totalBrl) : NaN
      return { brl, jpy, usd }
    }
    if (cur === 'USD') {
      const usd = n
      if (!hasStoreRefs) return { brl: NaN, jpy: NaN, usd }
      const brl = totalBrl * (usd / totalUsd)
      const jpy = Math.round(brlToJpy(brl))
      return { brl, jpy, usd }
    }

    const jpy = Math.round(n)
    const brl = jpyToBrl(jpy)
    const usd = hasStoreRefs ? totalUsd * (brl / totalBrl) : NaN
    return { brl, jpy, usd }
  }

  const getChargeTriValues = (order) => {
    const payable = getPayableAmount(order)
    if (!payable) return null
    const effectivePayable =
      payable.label === 'Orçamento'
        ? (getDisplayedOrderTotal(order) ?? payable)
        : payable
    const tri = toTriValues(order, effectivePayable.amount, effectivePayable.currency || 'JPY')
    if (!tri) return null
    return {
      label: effectivePayable.label,
      brl: tri.brl,
      jpy: tri.jpy,
      usd: tri.usd,
    }
  }

  const shouldShowEditDelete = (order) => {
    // Após pagamento, removemos os botões (pedido entra em execução operacional).
    return !['paid', 'products_paid', 'shipped', 'completed'].includes(order.status)
  }

  const refreshOrders = async () => {
    if (!user?.id) return
    const [ordersRes, walletRes] = await Promise.all([
      getMyOrders(user.id, {
        limit: ORDERS_PAGE_SIZE,
        offset: ordersPage * ORDERS_PAGE_SIZE,
        ...(ordersFilter === ORDER_FILTERS.COMPLETED
          ? { status: 'completed' }
          : { excludeStatus: 'completed' }),
      }),
      getWallet(user.id),
    ])
    const list = ordersRes.data ?? []
    setOrders(list)
    setOrdersHasMore(list.length === ORDERS_PAGE_SIZE)
    setWallet(walletRes.data ?? null)
    const k = cacheKey(user.id, `orders_page_v1_p${ordersPage}`)
    writeCache(k, { orders: list, wallet: walletRes.data ?? null, hasMore: list.length === ORDERS_PAGE_SIZE })
  }

  const handlePayShipping = async (order, { useWallet = false, provider = null } = {}) => {
    const payable = getPayableAmount(order)
    if (!payable) return
    setPayingId(order.id)
    setFeedback('')
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback('Faça login novamente para pagar')
        setPayingId(null)
        return
      }
      const result = await createCheckoutSession(order.id, accessToken, { useWallet, provider })
      if (result?.paid) {
        setFeedback('Pagamento realizado com sucesso!')
        await refreshOrders()
        setPayModal({ open: false, order: null, useWallet: true })
        return
      }
      const url = result?.url
      if (url) window.location.href = url
      else setFeedback('Erro ao criar sessão de pagamento')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento')
    } finally {
      setPayingId(null)
    }
  }

  const getExtraServicesForOrder = (order) => {
    if (extraServicesOrderId === order.id) return extraServices
    return {
      photos: !!order.extra_services?.photos,
      video: !!order.extra_services?.video,
    }
  }

  const getProductThumb = (product) => {
    if (!product) return null
    const u = typeof product.image_url === 'string' ? product.image_url.trim() : ''
    if (u) return u
    const raw = product.image_urls
    if (Array.isArray(raw) && raw.length) {
      const first = raw[0]
      return typeof first === 'string' ? first : null
    }
    return null
  }

  const getRequestedItems = (order) => {
    if (!Array.isArray(order?.order_items)) return []
    return order.order_items.map((it, index) => {
      const qty = Math.max(1, parseInt(it?.quantity, 10) || 1)
      const unitPrice = Number(it?.price_at_purchase) || 0
      const pid = it?.product_id
      const name =
        it?.product?.name ||
        (pid ? `Produto (${String(pid).slice(0, 8)}…)` : `Item ${index + 1}`)
      return {
        id: it?.id || `${name}-${index}`,
        name,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
        thumb: getProductThumb(it?.product),
      }
    })
  }

  const formatByCurrency = (value, currency = 'JPY') => {
    const normalized = String(currency || 'JPY').toUpperCase()
    return normalized === 'BRL' ? formatBRL(value) : formatJPY(value)
  }

  const getQuoteGrandTotalFromMessage = (order) => {
    const parsed = parseQuoteMessage(order?.message)
    const products = parsed?.products
    if (!Array.isArray(products) || products.length === 0) return null

    const baseTotal = products.reduce((sum, p) => {
      const value = Number(p?.valor) || 0
      const qty = Math.max(1, parseInt(p?.quantidade, 10) || 1)
      return sum + value * qty
    }, 0)

    const totalItems = products.reduce(
      (sum, p) => sum + Math.max(1, parseInt(p?.quantidade, 10) || 1),
      0
    )
    const isAssistedBuy = order?.order_module === 'assisted_buy' || order?.order_module === 'redir-assistido'
    const servicePercent = isAssistedBuy ? REDIR_ASSISTIDO_FEE_PERCENT : PERSONAL_SHOPPING_FEE_PERCENT
    const serviceFeePercent = Math.round(baseTotal * (servicePercent / 100))
    const serviceFeeFixed = isAssistedBuy
      ? computeRedirecionamentoPadraoFeeJpy(totalItems)
      : SERVICE_FEE_JPY_PER_ITEM * totalItems

    const grandTotal = baseTotal + serviceFeePercent + serviceFeeFixed
    return Number.isFinite(grandTotal) && grandTotal > 0 ? grandTotal : null
  }

  const getDisplayedOrderTotal = (order) => {
    const quoteGrandTotal = getQuoteGrandTotalFromMessage(order)
    if (quoteGrandTotal != null) {
      return {
        amount: quoteGrandTotal,
        currency: order.quote_currency || 'JPY',
        label: 'Total (orçamento)',
      }
    }
    if (order?.quote_amount != null && Number(order.quote_amount) > 0) {
      return {
        amount: Number(order.quote_amount),
        currency: order.quote_currency || 'JPY',
        label: 'Total (orçamento)',
      }
    }
    if (order?.total_amount != null && Number(order.total_amount) > 0) {
      return {
        amount: Number(order.total_amount),
        currency: 'BRL',
        label: 'Total',
      }
    }
    return null
  }

  const getRequestedItemsCurrency = (order) => {
    if (order?.order_source === 'store') return 'BRL'
    if (order?.quote_currency) return order.quote_currency
    if (order?.shipping_currency) return order.shipping_currency
    return 'JPY'
  }

  const isOrderInvoiceEligible = (order) => {
    const st = String(order?.status || '').toLowerCase()
    return ['paid', 'products_paid', 'shipped', 'completed'].includes(st)
  }

  const ensureOrderInvoiceLoaded = async (orderId) => {
    if (!orderId || !session?.access_token) return
    if (invoiceByOrderId[orderId] || invoiceLoadingByOrderId[orderId]) return
    setInvoiceLoadingByOrderId((prev) => ({ ...prev, [orderId]: true }))
    const { data, error } = await getInvoiceByOrder(session.access_token, orderId)
    setInvoiceLoadingByOrderId((prev) => ({ ...prev, [orderId]: false }))
    if (!error && data?.id) {
      setInvoiceByOrderId((prev) => ({ ...prev, [orderId]: data }))
    }
  }

  const handleDownloadOrderInvoice = async (order) => {
    if (!order?.id || !session?.access_token) return
    try {
      const existing = invoiceByOrderId[order.id]
      const filename = `${existing?.invoice_number || `invoice-${String(order.id).slice(0, 8)}`}.pdf`
      await downloadInvoicePdfByOrder(session.access_token, order.id, filename)
    } catch (e) {
      setFeedback(e?.message || 'Não foi possível baixar a fatura deste pedido.')
    }
  }

  const handleRequestExtraServices = async (order) => {
    if (order.status !== 'item_received') return
    const toSend = getExtraServicesForOrder(order)
    if (!toSend.photos && !toSend.video) {
      setFeedback('Marque pelo menos uma opção (fotos ou vídeo).')
      return
    }
    setFeedback('')
    try {
      const { error } = await requestOrderExtraServices(order.id, toSend)
      if (error) {
        setFeedback(error.message || 'Erro ao solicitar serviços')
        return
      }
      setFeedback('Solicitação de serviços extras enviada!')
      const { data: ordersData } = await getMyOrders(user.id, {
        limit: ORDERS_PAGE_SIZE,
        offset: ordersPage * ORDERS_PAGE_SIZE,
      })
      const list = ordersData ?? []
      setOrders(list)
      setOrdersHasMore(list.length === ORDERS_PAGE_SIZE)
      setExtraServicesOrderId(null)
      setExtraServices({ photos: false, video: false })
    } catch (err) {
      setFeedback(err?.message || 'Erro ao solicitar')
    }
  }

  const closeDetailsModal = () => {
    setDetailsModal({ open: false, order: null })
    setTargetOrderId(null)
    setHasOpenedTargetOrder(false)
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('orderId')) {
        url.searchParams.delete('orderId')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      }
    } catch {
      // noop
    }
  }

  useEffect(() => {
    const order = detailsModal?.order
    if (!detailsModal.open || !order?.id || !isOrderInvoiceEligible(order)) return
    void ensureOrderInvoiceLoaded(order.id)
  }, [detailsModal.open, detailsModal.order?.id, detailsModal.order?.status, session?.access_token])

  return (
    <>
      <Helmet>
        <title>Pedidos | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Pedidos</h1>
        <p className="mt-2 text-earth-600">
          Acompanhe seus pedidos: criação → aguardando chegada → item recebido → armazenado → pronto para envio → aguardando pagamento do frete → enviado → finalizado. Os pagamentos foram centralizados em Central de Pagamentos.
        </p>
        <div className="mt-4 inline-flex rounded-lg border border-earth-200 bg-earth-50 p-1">
          <button
            type="button"
            onClick={() => setOrdersFilter(ORDER_FILTERS.OPEN)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              ordersFilter === ORDER_FILTERS.OPEN
                ? 'bg-earth-900 text-white'
                : 'text-earth-700 hover:bg-earth-100'
            }`}
          >
            Em andamento
          </button>
          <button
            type="button"
            onClick={() => setOrdersFilter(ORDER_FILTERS.COMPLETED)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              ordersFilter === ORDER_FILTERS.COMPLETED
                ? 'bg-earth-900 text-white'
                : 'text-earth-700 hover:bg-earth-100'
            }`}
          >
            Finalizados
          </button>
        </div>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('sucesso')
                ? 'bg-green-100 text-green-800'
                : feedback.includes('cancelado')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando pedidos...</p>}

        {!loading && orders.length === 0 && (
          <p className="mt-6 text-earth-600">
            {ordersFilter === ORDER_FILTERS.COMPLETED
              ? 'Você ainda não tem pedidos finalizados.'
              : 'Você ainda não tem pedidos em andamento.'}
          </p>
        )}

        {!loading && orders.length > 0 && (
          <div className="mt-6 space-y-4">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-earth-200 bg-earth-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-medium text-earth-900">
                      Pedido {o.id?.slice(0, 8)}…
                    </span>
                    <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    {o.order_source === 'store' && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Loja virtual
                          </span>
                          {o.ship_immediately ? (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                              Envio após o pagamento dos produtos
                            </span>
                          ) : (
                            <span className="rounded-md bg-earth-100 px-2 py-0.5 text-xs text-earth-800">
                              Frete pago depois (armazenagem)
                            </span>
                          )}
                        </div>
                        {(() => {
                          const items = getRequestedItems(o)
                          const displayedTotal = getDisplayedOrderTotal(o)
                          if (items.length === 0) {
                            return (
                              <p className="text-sm text-earth-600">
                                {displayedTotal
                                  ? `${displayedTotal.label}: ${formatByCurrency(displayedTotal.amount, displayedTotal.currency)}`
                                  : 'Itens do pedido indisponíveis no momento.'}
                              </p>
                            )
                          }
                          return (
                            <>
                              <ul className="space-y-2">
                                {items.map((item) => (
                                  <li key={item.id} className="flex gap-2 text-sm">
                                    {item.thumb ? (
                                      <img
                                        src={item.thumb}
                                        alt=""
                                        className="h-11 w-11 shrink-0 rounded-md border border-earth-200 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-earth-200 bg-earth-100 text-xs text-earth-400">
                                        —
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-earth-900">{item.name}</p>
                                      <p className="text-xs text-earth-600">
                                        {item.qty} × {formatByCurrency(item.unitPrice, 'BRL')}
                                      </p>
                                    </div>
                                    <p className="shrink-0 font-medium text-earth-800">
                                      {formatByCurrency(item.lineTotal, 'BRL')}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                {displayedTotal && (
                                  <p>
                                    <span className="text-earth-600">Total: </span>
                                    <span className="font-semibold text-earth-900">
                                      {formatByCurrency(displayedTotal.amount, displayedTotal.currency)}
                                    </span>
                                  </p>
                                )}
                                {o.discount_amount != null && Number(o.discount_amount) > 0 && (
                                  <p className="text-green-700">Desconto: −{formatBRL(o.discount_amount)}</p>
                                )}
                                {o.wallet_applied_amount != null && Number(o.wallet_applied_amount) > 0 && (
                                  <p className="text-earth-700">
                                    Carteira aplicada: {formatJPY(o.wallet_applied_amount)}
                                  </p>
                                )}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {o.service?.name && (
                      <p className="mt-1 text-sm text-earth-600">{o.service.name}</p>
                    )}
                    {o.message && (
                      <QuoteProductsList
                        message={o.message}
                        quoteCurrency={o.quote_currency || 'JPY'}
                        formatMoney={(v, c) => formatByCurrency(v, c)}
                        orderModule={o.order_module}
                      />
                    )}
                    {Array.isArray(o.attachment_urls) && o.attachment_urls.length > 0 && (
                      <OrderAttachments urls={o.attachment_urls} />
                    )}
                    {(() => {
                      const tri = getChargeTriValues(o)
                      return tri && (
                        <div className="mt-2">
                          <p className="mb-1 text-sm font-semibold text-earth-800">{tri.label}</p>
                          <TriCurrencyDisplay
                            brl={tri.brl}
                            jpy={tri.jpy}
                            usd={tri.usd}
                            variant="compact"
                          />
                        </div>
                      )
                    })()}
                    {isOrderInvoiceEligible(o) && (
                      <div className="mt-2">
                        {invoiceByOrderId[o.id] ? (
                          <p className="text-xs text-earth-600">
                            Fatura anexada ao pedido: <span className="font-medium text-earth-800">{invoiceByOrderId[o.id].invoice_number}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-earth-500">
                            {invoiceLoadingByOrderId[o.id]
                              ? 'Carregando fatura do pedido...'
                              : 'Fatura será anexada automaticamente ao pedido após confirmação do pagamento.'}
                          </p>
                        )}
                      </div>
                    )}
                    {o.status === 'item_received' && (
                      <div className="mt-3 rounded-lg border border-earth-200 bg-white p-3">
                        <p className="text-sm font-medium text-earth-800">Serviços extras</p>
                        <p className="mt-1 text-xs text-earth-600">
                          Solicite fotos e/ou vídeo do produto recebido.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={o.id === extraServicesOrderId ? extraServices.photos : (o.extra_services?.photos ?? false)}
                              onChange={(e) => {
                                if (o.id !== extraServicesOrderId) {
                                  setExtraServicesOrderId(o.id)
                                  setExtraServices({ photos: e.target.checked, video: o.extra_services?.video ?? false })
                                } else {
                                  setExtraServices((s) => ({ ...s, photos: e.target.checked }))
                                }
                              }}
                              className="rounded border-earth-300"
                            />
                            <span className="text-sm text-earth-700">Fotos</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={o.id === extraServicesOrderId ? extraServices.video : (o.extra_services?.video ?? false)}
                              onChange={(e) => {
                                if (o.id !== extraServicesOrderId) {
                                  setExtraServicesOrderId(o.id)
                                  setExtraServices({ photos: o.extra_services?.photos ?? false, video: e.target.checked })
                                } else {
                                  setExtraServices((s) => ({ ...s, video: e.target.checked }))
                                }
                              }}
                              className="rounded border-earth-300"
                            />
                            <span className="text-sm text-earth-700">Vídeo</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRequestExtraServices(o)}
                            disabled={!(getExtraServicesForOrder(o).photos || getExtraServicesForOrder(o).video)}
                            className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
                          >
                            Solicitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsModal({ open: true, order: o })}
                      className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50"
                    >
                      Mostrar detalhes
                    </button>
                    {shouldShowEditDelete(o) && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Remover este pedido?')) return
                          setDeletingId(o.id)
                          setFeedback('')
                          const { error } = await deleteMyOrder(user.id, o.id)
                          setDeletingId(null)
                          if (error) setFeedback(error.message || 'Erro ao remover pedido')
                          else {
                            setFeedback('Pedido removido.')
                            await refreshOrders()
                          }
                        }}
                        disabled={deletingId === o.id}
                        className="rounded-lg border border-red-300 bg-white px-4 py-2.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === o.id ? 'Removendo...' : 'Remover'}
                      </button>
                    )}
                    {getPayableAmount(o) && (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/app/cart?payOrderId=${encodeURIComponent(o.id)}`
                        }}
                        className="rounded-lg bg-earth-900 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        Ir para pagamento
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
              <p className="text-xs text-earth-600">Página {ordersPage + 1}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
                  disabled={loading || ordersPage <= 0}
                  className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersPage((p) => p + 1)}
                  disabled={loading || !ordersHasMore}
                  className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {detailsModal.open && detailsModal.order && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDetailsModal}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-earth-900">Detalhes do pedido</h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-earth-500">ID</p>
                <p className="text-sm text-earth-800 font-mono">{detailsModal.order.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Status</p>
                <p className="text-sm text-earth-800">
                  {ORDER_STATUS_LABELS[detailsModal.order.status] ?? detailsModal.order.status}
                </p>
              </div>
              {detailsModal.order.order_source === 'store' && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Origem</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Loja virtual
                    </span>
                    {detailsModal.order.ship_immediately ? (
                      <span className="text-sm text-earth-700">Envio após o pagamento dos produtos</span>
                    ) : (
                      <span className="text-sm text-earth-700">Frete cobrado em etapa separada (armazenagem)</span>
                    )}
                  </div>
                  {getDisplayedOrderTotal(detailsModal.order) && (
                    <div className="mt-2">
                      <p className="mb-1 text-sm text-earth-600">
                        {getDisplayedOrderTotal(detailsModal.order)?.label === 'Total (orçamento)'
                          ? 'Total do pedido (orçamento):'
                          : 'Total do pedido (produtos):'}
                      </p>
                      {(() => {
                        const displayedTotal = getDisplayedOrderTotal(detailsModal.order)
                        if (!displayedTotal) return null
                        const tri = toTriValues(detailsModal.order, displayedTotal.amount, displayedTotal.currency)
                        if (!tri) return null
                        return <TriCurrencyDisplay brl={tri.brl} jpy={tri.jpy} usd={tri.usd} variant="compact" />
                      })()}
                      {detailsModal.order.discount_amount != null &&
                        Number(detailsModal.order.discount_amount) > 0 && (
                          <p className="mt-1 text-sm text-green-700">
                            Desconto: −{formatBRL(detailsModal.order.discount_amount)}
                          </p>
                        )}
                    </div>
                  )}
                  {detailsModal.order.wallet_applied_amount != null &&
                    Number(detailsModal.order.wallet_applied_amount) > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-sm text-earth-700">Carteira aplicada:</p>
                        {(() => {
                          const tri = toTriValues(detailsModal.order, detailsModal.order.wallet_applied_amount, 'JPY')
                          if (!tri) return null
                          return <TriCurrencyDisplay brl={tri.brl} jpy={tri.jpy} usd={tri.usd} variant="compact" />
                        })()}
                      </div>
                    )}
                </div>
              )}
              {detailsModal.order.service?.name && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Serviço</p>
                  <p className="text-sm text-earth-800">{detailsModal.order.service.name}</p>
                </div>
              )}
              {detailsModal.order.early_prepayment_requested && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Pré-pagamento</p>
                  <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1.5 text-sm text-emerald-900">
                    Você solicitou antecipar o pré-pagamento para reduzir o risco de o item esgotar antes da compra
                    (ex.: flea market).
                  </p>
                  {detailsModal.order.early_prepayment_wallet_jpy != null &&
                    Number(detailsModal.order.early_prepayment_wallet_jpy) > 0 && (
                      <p className="mt-2 text-sm text-earth-800">
                        Valor que você pediu para adiantar pela carteira ao registrar o pedido:{' '}
                        <span className="font-semibold text-earth-900">
                          {formatJPY(Number(detailsModal.order.early_prepayment_wallet_jpy))}
                        </span>
                        .
                      </p>
                    )}
                </div>
              )}
              {isOrderInvoiceEligible(detailsModal.order) && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Fatura</p>
                  {invoiceByOrderId[detailsModal.order.id] ? (
                    <div className="mt-1 rounded-md border border-earth-200 bg-earth-50 px-3 py-2">
                      <p className="text-sm text-earth-800">
                        {invoiceByOrderId[detailsModal.order.id].invoice_number}
                        {invoiceByOrderId[detailsModal.order.id].created_at
                          ? ` • ${new Date(invoiceByOrderId[detailsModal.order.id].created_at).toLocaleString('pt-BR')}`
                          : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDownloadOrderInvoice(detailsModal.order)}
                        className="mt-2 rounded border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                      >
                        Baixar PDF da fatura
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-earth-600">
                      {invoiceLoadingByOrderId[detailsModal.order.id]
                        ? 'Carregando fatura...'
                        : 'A fatura é anexada automaticamente ao pedido após confirmação do pagamento.'}
                    </p>
                  )}
                </div>
              )}
              {detailsModal.order.message && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500 mb-1">Solicitação do pedido</p>
                  <QuoteProductsList
                    message={detailsModal.order.message}
                    quoteCurrency={detailsModal.order.quote_currency || 'JPY'}
                    formatMoney={(v, c) => formatByCurrency(v, c)}
                    orderModule={detailsModal.order.order_module}
                  />
                </div>
              )}
              {(() => {
                const requestedItems = getRequestedItems(detailsModal.order)
                if (requestedItems.length === 0) return null
                const totalRequested = requestedItems.reduce((sum, item) => sum + item.lineTotal, 0)
                const itemsCurrency = getRequestedItemsCurrency(detailsModal.order)
                return (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-earth-500 mb-2">Itens solicitados</p>
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
                      <ul className="space-y-2">
                        {requestedItems.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="flex min-w-0 gap-2">
                              {item.thumb ? (
                                <img
                                  src={item.thumb}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-md border border-earth-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-earth-200 bg-earth-100 text-xs text-earth-400">
                                  —
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-earth-900">{item.name}</p>
                                <p className="text-xs text-earth-600">Quantidade: {item.qty}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-earth-700">{formatByCurrency(item.lineTotal, itemsCurrency)}</p>
                              {item.qty > 1 && (
                                <p className="text-xs text-earth-500">{formatByCurrency(item.unitPrice, itemsCurrency)} cada</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 border-t border-earth-200 pt-2 text-sm font-semibold text-earth-900">
                        Total dos itens: {formatByCurrency(totalRequested, itemsCurrency)}
                      </p>
                    </div>
                  </div>
                )
              })()}
              {Array.isArray(detailsModal.order.attachment_urls) && detailsModal.order.attachment_urls.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500 mb-2">Imagens</p>
                  <OrderAttachments urls={detailsModal.order.attachment_urls} />
                </div>
              )}
              {getDisplayedOrderTotal(detailsModal.order)?.label === 'Total (orçamento)' && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Orçamento total</p>
                  {(() => {
                    const displayedTotal = getDisplayedOrderTotal(detailsModal.order)
                    if (!displayedTotal) return <p className="text-sm text-earth-700">—</p>
                    const tri = toTriValues(detailsModal.order, displayedTotal.amount, displayedTotal.currency)
                    if (!tri) return <p className="text-sm text-earth-700">—</p>
                    return <TriCurrencyDisplay brl={tri.brl} jpy={tri.jpy} usd={tri.usd} variant="compact" />
                  })()}
                </div>
              )}
              {detailsModal.order.shipping_cost != null && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Frete</p>
                  {(() => {
                    const tri = toTriValues(
                      detailsModal.order,
                      detailsModal.order.shipping_cost,
                      detailsModal.order.shipping_currency || 'JPY'
                    )
                    if (!tri) return <p className="text-sm text-earth-700">—</p>
                    return <TriCurrencyDisplay brl={tri.brl} jpy={tri.jpy} usd={tri.usd} variant="compact" />
                  })()}
                </div>
              )}
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-lg">
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <h3 className="font-semibold text-earth-900">Pagamento</h3>
              <p className="mt-1 text-sm text-earth-600">
                Escolha a forma de pagamento e conclua com segurança.
              </p>

              {feedback && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${feedback.includes('Erro') || feedback.includes('erro') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {feedback}
                </p>
              )}

              {(() => {
                const p = getChargeJpy(payModal.order)
                const balance = wallet?.balance ?? 0
                const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
                const totalJpy = p?.amountJpy ?? 0
                const useWallet = !!payModal.useWallet && canUseWallet
                const walletApplied = useWallet ? Math.min(balance, totalJpy) : 0
                let remainingJpy = Math.max(0, totalJpy - walletApplied)
                if (remainingJpy > 0 && remainingJpy < 1) remainingJpy = 0

                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 space-y-2">
                      {p && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-earth-600">{p.label}</span>
                            <span className="font-medium text-earth-900">{formatJPY(totalJpy)}</span>
                          </div>
                          {useWallet && walletApplied > 0 && (
                            <div className="flex justify-between text-sm text-green-700">
                              <span>Carteira aplicada</span>
                              <span>-{formatJPY(walletApplied)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-earth-200 font-medium">
                            <span className="text-earth-800">Total a pagar</span>
                            <span className="text-earth-900">{formatJPY(remainingJpy)}</span>
                          </div>
                          <p className="text-xs text-earth-500 mt-1">Aprox. em BRL: {formatBRL(useWallet && remainingJpy > 0 ? jpyToBrl(remainingJpy) : (p?.approxBrl ?? 0))}</p>
                        </>
                      )}
                    </div>

                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${canUseWallet ? 'border-earth-200 bg-white cursor-pointer' : 'border-earth-100 bg-earth-50 opacity-70'}`}>
                      <input
                        type="checkbox"
                        checked={!!payModal.useWallet}
                        disabled={!canUseWallet}
                        onChange={(e) => setPayModal((m) => ({ ...m, useWallet: e.target.checked }))}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-earth-900">Usar saldo da carteira</p>
                        <p className="text-sm text-earth-600">
                          Saldo disponível: {formatJPY(balance)}
                        </p>
                      </div>
                    </label>
                    <div className="rounded-lg border border-earth-200 bg-white p-4">
                      <p className="font-medium text-earth-900">Forma de pagamento</p>
                      <select
                        value={selectedGateway}
                        onChange={(e) => setSelectedGateway(e.target.value)}
                        className="mt-2 w-full rounded border border-earth-300 bg-white px-3 py-2 text-sm text-earth-900"
                      >
                        {GATEWAY_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.icon} {option.label}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const option = GATEWAY_OPTIONS.find((entry) => entry.id === selectedGateway) || GATEWAY_OPTIONS[0]
                        return (
                          <div className="mt-3 rounded-md border border-earth-100 bg-earth-50 px-3 py-2">
                            <p className="text-sm font-medium text-earth-900">
                              <span className="mr-1">{option.icon}</span>
                              {option.label}
                            </p>
                            <p className="text-xs text-earth-600">{option.details}</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="shrink-0 border-t border-earth-200 bg-earth-50 p-4">
              {(() => {
                const p = getChargeJpy(payModal.order)
                const balance = wallet?.balance ?? 0
                const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
                const totalJpy = p?.amountJpy ?? 0
                const useWallet = !!payModal.useWallet && canUseWallet
                let remainingJpy = Math.max(0, totalJpy - (useWallet ? Math.min(balance, totalJpy) : 0))
                if (remainingJpy > 0 && remainingJpy < 1) remainingJpy = 0
                const isFullyCovered = remainingJpy <= 0 && useWallet

                return (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-earth-500">
                      Parcelow: checkout Brasil. Stripe: cartão internacional.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handlePayShipping(payModal.order, {
                            useWallet: isFullyCovered ? true : useWallet,
                            provider: selectedGateway,
                          })
                        }
                        disabled={payingId === payModal.order.id}
                        className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {payingId === payModal.order.id ? 'Processando...' : 'Pagar com método selecionado'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
                        className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
