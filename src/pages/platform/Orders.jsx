/**
 * Orders - Pedidos do usuário.
 * Fluxo: pedido → pagamento do pedido → recebimento (serviços extras) →
 * consolidamos e definimos frete → cliente paga frete → enviamos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { deleteMyOrder, getMyOrders, requestOrderExtraServices, ORDER_STATUS_LABELS } from '../../services/orderService'
import { createCheckoutSession } from '../../services/paymentService'
import PixManualModal from '../../components/PixManualModal'
import { getWallet } from '../../services/walletService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'
import QuoteProductsList from '../../components/QuoteProductsList'
import OrderAttachments from '../../components/OrderAttachments'

const ORDERS_PAGE_SIZE = 12

export default function Orders() {
  const { user, session } = useAuth()
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [pixModal, setPixModal] = useState({ open: false, order: null })
  const [extraServicesOrderId, setExtraServicesOrderId] = useState(null)
  const [extraServices, setExtraServices] = useState({ photos: false, video: false })
  const [detailsModal, setDetailsModal] = useState({ open: false, order: null })
  const [deletingId, setDeletingId] = useState(null)
  const [ordersPage, setOrdersPage] = useState(0)
  const [ordersHasMore, setOrdersHasMore] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setFeedback('Pagamento realizado com sucesso!')
      window.history.replaceState({}, '', '/app/orders')
    }
    if (params.get('canceled') === 'true') {
      setFeedback('Pagamento cancelado.')
      window.history.replaceState({}, '', '/app/orders')
    }
  }, [])

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
  }, [user?.id, ordersPage])

  const getPayableAmount = (order) => {
    if (order.status !== 'awaiting_payment') return null
    if (order.quote_amount != null && Number(order.quote_amount) > 0) {
      return { amount: Number(order.quote_amount), currency: order.quote_currency || 'BRL', label: 'Orçamento' }
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

  const handlePayShipping = async (order, { useWallet = false } = {}) => {
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
      const result = await createCheckoutSession(order.id, accessToken, { useWallet })
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
          <p className="mt-6 text-earth-600">Você ainda não tem pedidos.</p>
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
                    {o.service?.name && (
                      <p className="mt-1 text-sm text-earth-600">{o.service.name}</p>
                    )}
                    {o.message && (
                      <QuoteProductsList
                        message={o.message}
                        quoteCurrency={o.quote_currency || 'JPY'}
                        formatMoney={(v) => formatJPY(v)}
                      />
                    )}
                    {Array.isArray(o.attachment_urls) && o.attachment_urls.length > 0 && (
                      <OrderAttachments urls={o.attachment_urls} />
                    )}
                    {(() => {
                      const c = getChargeJpy(o)
                      return c && (
                        <div className="mt-2">
                          <p className="text-lg font-semibold text-earth-900">
                            {c.label}: {formatJPY(c.amountJpy)}
                          </p>
                          <p className="text-xs text-earth-600">
                            Aproximado em BRL: {formatBRL(c.approxBrl)}
                          </p>
                        </div>
                      )
                    })()}
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
          onClick={() => setDetailsModal({ open: false, order: null })}
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
              {detailsModal.order.service?.name && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Serviço</p>
                  <p className="text-sm text-earth-800">{detailsModal.order.service.name}</p>
                </div>
              )}
              {detailsModal.order.message && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500 mb-1">Orçamento / Mensagem</p>
                  <QuoteProductsList
                    message={detailsModal.order.message}
                    quoteCurrency={detailsModal.order.quote_currency || 'JPY'}
                    formatMoney={(v) => formatJPY(v)}
                  />
                </div>
              )}
              {Array.isArray(detailsModal.order.attachment_urls) && detailsModal.order.attachment_urls.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500 mb-2">Imagens</p>
                  <OrderAttachments urls={detailsModal.order.attachment_urls} />
                </div>
              )}
              {detailsModal.order.quote_amount != null && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Orçamento total</p>
                  <p className="text-sm font-medium text-earth-800">
                    {formatJPY(detailsModal.order.quote_amount)}
                  </p>
                </div>
              )}
              {detailsModal.order.shipping_cost != null && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">Frete</p>
                  <p className="text-sm text-earth-800">
                    {formatJPY(detailsModal.order.shipping_cost)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDetailsModal({ open: false, order: null })}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <PixManualModal
        open={pixModal.open}
        onClose={() => setPixModal({ open: false, order: null })}
        onBack={() => {
          if (pixModal.order) {
            setPixModal({ open: false, order: null })
            setPayModal({ open: true, order: pixModal.order, useWallet: true })
          } else {
            setPixModal({ open: false, order: null })
          }
        }}
        order={pixModal.order}
        amountBrl={pixModal.order ? (() => {
          const p = getPayableAmount(pixModal.order)
          if (!p) return null
          return (p.currency || '').toUpperCase() === 'BRL' ? p.amount : jpyToBrl(p.amount)
        })() : null}
        userId={user?.id}
      />

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-lg">
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <h3 className="font-semibold text-earth-900">Pagamento</h3>
              <p className="mt-1 text-sm text-earth-600">
                Escolha como deseja pagar este pedido.
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
                const remainingJpy = totalJpy - walletApplied

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
                            <span className="text-earth-900">{formatJPY(Math.max(0, remainingJpy))}</span>
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
                const remainingJpy = totalJpy - (useWallet ? Math.min(balance, totalJpy) : 0)
                const isFullyCovered = remainingJpy <= 0 && useWallet

                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayShipping(payModal.order, { useWallet })}
                        disabled={payingId === payModal.order.id || isFullyCovered}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        Cartão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayModal((m) => ({ ...m, open: false }))
                          setPixModal({ open: true, order: payModal.order })
                        }}
                        disabled={payingId === payModal.order.id || isFullyCovered}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        PIX
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayShipping(payModal.order, { useWallet: isFullyCovered ? true : useWallet })}
                        disabled={payingId === payModal.order.id}
                        className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {payingId === payModal.order.id ? 'Processando...' : 'Finalizar compra'}
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
