/**
 * Central de Pagamentos - checkout da loja + pagamentos pendentes.
 * Todos os pagamentos da conta são centralizados aqui para melhorar a UX.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCart, updateCartItem, removeFromCart, createStoreOrder, getLatestPendingStoreOrder } from '../../services/cartService'
import { validateCoupon } from '../../services/couponService'
import { createCheckoutSession } from '../../services/paymentService'
import { getMyOrders, ORDER_STATUS_LABELS } from '../../services/orderService'
import PixManualModal from '../../components/PixManualModal'
import { getWallet } from '../../services/walletService'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

function formatPriceBrlAsJpy(brl) {
  const jpy = Math.round(brlToJpy(brl))
  const approxBrl = jpyToBrl(jpy)
  return { jpy, approxBrl }
}

function Cart() {
  const { user, session } = useAuth()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [qtyDrafts, setQtyDrafts] = useState({})
  const [pendingOrders, setPendingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [pixModal, setPixModal] = useState({ open: false, order: null })
  const [feedback, setFeedback] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'
  const payOrderId = searchParams.get('payOrderId')

  const loadCart = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await getCart(user.id)
    setItems(data ?? [])
    if (error) setFeedback(error.message)
    setLoading(false)
  }

  const getPayableAmount = (order) => {
    if (order?.status !== 'awaiting_payment') return null
    if (order?.quote_amount != null && Number(order.quote_amount) > 0) {
      return { amount: Number(order.quote_amount), currency: order.quote_currency || 'BRL', label: 'Orçamento' }
    }
    if (order?.total_amount != null && Number(order.total_amount) > 0) {
      return { amount: Number(order.total_amount), currency: 'BRL', label: 'Total' }
    }
    if (order?.shipping_cost != null && Number(order.shipping_cost) > 0) {
      return { amount: Number(order.shipping_cost), currency: order.shipping_currency || 'JPY', label: 'Frete' }
    }
    return null
  }

  const loadPendingOrders = async () => {
    if (!user?.id) return
    setPendingLoading(true)
    const { data, error } = await getMyOrders(user.id, { limit: 40, offset: 0 })
    if (error) {
      setFeedback(error.message || 'Erro ao carregar pagamentos pendentes.')
      setPendingOrders([])
      setPendingLoading(false)
      return []
    }
    const list = (data ?? []).filter((order) => !!getPayableAmount(order))
    setPendingOrders(list)
    setPendingLoading(false)
    return list
  }

  useEffect(() => {
    loadCart()
  }, [user?.id])

  useEffect(() => {
    setQtyDrafts((prev) => {
      const next = {}
      for (const item of items) {
        if (Object.prototype.hasOwnProperty.call(prev, item.product_id)) {
          next[item.product_id] = prev[item.product_id]
        }
      }
      return next
    })
  }, [items])

  useEffect(() => {
    loadPendingOrders()
  }, [user?.id])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      const { data } = await getWallet(user.id)
      if (!isActive) return
      setWallet(data ?? null)
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id])

  useEffect(() => {
    if (success) setFeedback('Pagamento realizado com sucesso!')
    if (canceled) setFeedback('Pagamento cancelado.')
  }, [success, canceled])

  useEffect(() => {
    if (!payOrderId || pendingLoading || payModal.open) return
    const target = pendingOrders.find((o) => o.id === payOrderId)
    if (!target) return
    setPayModal({ open: true, order: target, useWallet: true })
    setFeedback('')
  }, [payOrderId, pendingLoading, pendingOrders, payModal.open])

  useEffect(() => {
    const modalOpen = payModal.open || pixModal.open
    if (!modalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [payModal.open, pixModal.open])

  const totalBrl = items.reduce((sum, i) => sum + (Number(i.products?.price ?? 0) * (i.quantity || 1)), 0)
  const discountBrl = couponApplied?.discount_brl ?? 0
  const totalAfterDiscountBrl = Math.max(0, totalBrl - discountBrl)
  const totalJpy = Math.round(brlToJpy(totalAfterDiscountBrl))

  const handleApplyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) {
      setFeedback('Digite um código de cupom.')
      return
    }
    setCouponLoading(true)
    setFeedback('')
    const { data, error } = await validateCoupon(code, totalBrl)
    setCouponLoading(false)
    if (error) {
      setCouponApplied(null)
      setFeedback(error.message)
      return
    }
    setCouponApplied(data)
    setFeedback('')
  }

  const handleRemoveCoupon = () => {
    setCouponApplied(null)
    setCouponInput('')
    setFeedback('')
  }

  const handleUpdateQty = async (productId, quantity) => {
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1))
    const currentItem = items.find((i) => i.product_id === productId)
    const currentQty = Number(currentItem?.quantity || 1)
    if (qty === currentQty) {
      setQtyDrafts((d) => {
        const next = { ...d }
        delete next[productId]
        return next
      })
      return
    }
    const { error } = await updateCartItem(user.id, productId, qty)
    if (error) setFeedback(error.message)
    else {
      setQtyDrafts((d) => {
        const next = { ...d }
        delete next[productId]
        return next
      })
      loadCart()
    }
  }

  const handleRemove = async (productId) => {
    const { error } = await removeFromCart(user.id, productId)
    if (error) setFeedback(error.message)
    else {
      loadCart()
    }
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      setFeedback('Sem itens da loja para finalizar.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: latestPendingStoreOrder, error: latestPendingError } = await getLatestPendingStoreOrder(user.id)
      if (latestPendingError) {
        setFeedback(latestPendingError.message || 'Erro ao verificar pagamento pendente.')
        return
      }

      if (latestPendingStoreOrder?.id) {
        setPayModal({ open: true, order: latestPendingStoreOrder, useWallet: true })
        setFeedback('')
        return
      }

      const { data: order, error } = await createStoreOrder(
        user.id,
        false,
        null,
        null,
        couponApplied ? couponInput.trim() : null
      )
      if (error) {
        setFeedback(error.message || 'Erro ao criar pedido')
        setSubmitting(false)
        return
      }
      const pendingList = await loadPendingOrders()
      let orderToPay = order && typeof order === 'object' ? order : null

      if (!orderToPay?.id) {
        const maybeOrderId =
          (typeof order === 'string' && order) ||
          order?.id ||
          order?.order_id ||
          order?.orderId ||
          null

        if (maybeOrderId) {
          orderToPay = (pendingList ?? []).find((o) => o.id === maybeOrderId) ?? null
        }
      }

      // Fallback: abre a pendência de pagamento mais recente.
      if (!orderToPay?.id) {
        orderToPay =
          (pendingList ?? []).find((o) => o.order_source === 'store') ||
          (pendingList ?? [])[0] ||
          null
      }

      if (!orderToPay?.id) {
        setFeedback('Pedido criado, mas não foi possível abrir o modal automaticamente. Use "Pagamentos pendentes" abaixo.')
        return
      }

      // Pedido criado: abre modal de pagamento (Stripe / PIX / carteira).
      setPayModal({ open: true, order: orderToPay, useWallet: true })
      setCouponApplied(null)
      setCouponInput('')
      setFeedback('')
    } catch (e) {
      setFeedback(e?.message || 'Erro ao processar')
    } finally {
      setSubmitting(false)
    }
  }

  const getOrderChargeJpy = (order) => {
    const payable = getPayableAmount(order)
    if (!payable) return null
    const currency = (payable.currency || 'JPY').toUpperCase()
    if (currency === 'BRL') {
      return { jpy: brlToJpy(payable.amount), approxBrl: payable.amount, label: payable.label }
    }
    return { jpy: Number(payable.amount) || 0, approxBrl: jpyToBrl(payable.amount), label: payable.label }
  }

  const getPaymentBreakdown = (order, useWallet) => {
    const charge = getOrderChargeJpy(order)
    const balance = wallet?.balance ?? 0
    const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
    const totalJpy = charge?.jpy ?? 0

    // Se a carteira já foi aplicada ao pedido antes, isso vem em `order.wallet_applied_amount`.
    // Usamos esse valor para evitar que o PIX continue mostrando o valor inteiro.
    const alreadyAppliedJpy = Math.max(0, Number(order?.wallet_applied_amount) || 0)
    const remainingAfterAlreadyApplied = Math.max(0, totalJpy - alreadyAppliedJpy)

    // "Carteira aplicada" aqui é quanto vai ser aplicado (nesta intenção) somado ao que já foi aplicado.
    const walletAppliedAdditional = !!useWallet && canUseWallet ? Math.min(balance, remainingAfterAlreadyApplied) : 0
    const walletApplied = alreadyAppliedJpy + walletAppliedAdditional
    const remainingJpy = Math.max(0, totalJpy - walletApplied)

    // Evita mostrar "resto" ínfimo por diferenças de conversão/precisão.
    const EPS_JPY = 0.0001
    const remainingBrl =
      remainingJpy > EPS_JPY ? Math.round(jpyToBrl(remainingJpy) * 100) / 100 : 0
    return {
      charge,
      balance,
      canUseWallet,
      totalJpy,
      walletApplied,
      remainingJpy,
      remainingBrl,
      isFullyCovered: !!useWallet && remainingJpy <= EPS_JPY,
    }
  }

  const handlePayCard = async (forceWallet = false) => {
    if (!payModal.order) return
    const accessToken = session?.access_token
    if (!accessToken) {
      setFeedback('Faça login novamente para pagar.')
      return
    }
    const orderId = payModal.order.id
    try {
      setSubmitting(true)
      setFeedback('')
      const result = await createCheckoutSession(orderId, accessToken, { useWallet: forceWallet || !!payModal.useWallet })
      if (result?.paid) {
        setPayModal({ open: false, order: null, useWallet: true })
        setFeedback('Pagamento realizado com carteira.')
        await loadCart()
        await loadPendingOrders()
        return
      }
      if (result?.url) window.location.href = result.url
      else setFeedback('Erro ao redirecionar para pagamento.')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento.')
    } finally {
      setSubmitting(false)
    }
  }


  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to="/login" className="font-medium text-earth-900 underline">Faça login</Link> para acessar a central de pagamentos.
        </p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Central de Pagamentos | Plataforma</title>
      </Helmet>
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
        amountBrl={pixModal.amountBrl ?? (getOrderChargeJpy(pixModal.order)?.approxBrl ?? null)}
        userId={user?.id}
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Central de Pagamentos</h1>
        <p className="mt-2 text-earth-600">
          Faça todos os pagamentos da sua conta aqui: pedidos da loja, fretes e valores pendentes.
        </p>

        {feedback && !payModal.open && !pixModal.open && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && items.length === 0 && (
          <p className="mt-6 text-earth-600">
            Sem itens da loja no momento. <Link to="/app/loja" className="font-medium text-earth-900 underline">Compre na loja</Link>.
          </p>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              {items.map((item) => {
                const p = item.products
                if (!p) return null
                const subtotal = Number(p.price) * (item.quantity || 1)
                const unit = formatPriceBrlAsJpy(p.price)
                const sub = formatPriceBrlAsJpy(subtotal)
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-earth-200 bg-earth-50 p-4"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-20 w-20 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-earth-200 text-earth-500 text-sm">
                        Sem imagem
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-earth-900">{p.name}</h3>
                      <p className="text-sm text-earth-600">
                        {formatJPY(unit.jpy)} cada <span className="text-xs">({formatBRL(unit.approxBrl)} aprox.)</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={qtyDrafts[item.product_id] ?? item.quantity}
                        onChange={(e) =>
                          setQtyDrafts((d) => ({ ...d, [item.product_id]: e.target.value }))
                        }
                        onBlur={(e) => handleUpdateQty(item.product_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleUpdateQty(item.product_id, e.currentTarget.value)
                          }
                        }}
                        className="w-16 rounded border border-earth-300 px-2 py-1 text-center text-earth-900"
                      />
                      <span className="font-semibold text-earth-900">{formatJPY(sub.jpy)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.product_id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-earth-200 bg-earth-50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-sm font-medium text-earth-700">Cupom de desconto</label>
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                    placeholder="Digite o código"
                    disabled={!!couponApplied}
                    className="flex-1 min-w-0 rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400 focus:border-earth-500 focus:outline-none focus:ring-1 focus:ring-earth-500 disabled:bg-earth-100 disabled:cursor-not-allowed"
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="shrink-0 rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="shrink-0 rounded-lg border border-earth-300 bg-white px-4 py-2 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                    >
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  )}
                </div>
              </div>
              {couponApplied && (
                <p className="text-sm text-green-700 font-medium">
                  Cupom {couponApplied.code} aplicado! Desconto: -{formatBRL(couponApplied.discount_brl)}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-earth-200">
                <div>
                  <p className="text-xl font-bold text-earth-900">Total: {formatJPY(totalJpy)}</p>
                  <p className="text-sm text-earth-600">Aprox.: {formatBRL(jpyToBrl(totalJpy))}</p>
                  {discountBrl > 0 && (
                    <p className="text-sm text-green-600 mt-0.5">Subtotal {formatBRL(totalBrl)} − desconto {formatBRL(discountBrl)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="rounded-lg bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                >
                  {submitting ? 'Processando...' : 'Finalizar compra'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-semibold text-earth-900">Pagamentos pendentes</h2>
          <p className="mt-1 text-sm text-earth-600">Pedidos aguardando pagamento para finalizar o fluxo.</p>

          {pendingLoading && <p className="mt-4 text-earth-600">Carregando pendências...</p>}

          {!pendingLoading && pendingOrders.length === 0 && (
            <p className="mt-4 text-earth-600">Nenhum pagamento pendente.</p>
          )}

          {!pendingLoading && pendingOrders.length > 0 && (
            <div className="mt-4 space-y-3">
              {pendingOrders.map((order) => {
                const payable = getPayableAmount(order)
                const charge = getOrderChargeJpy(order)
                return (
                  <div key={order.id} className="rounded-xl border border-earth-200 bg-earth-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-earth-900">Pedido {order.id?.slice(0, 8)}…</p>
                        <p className="text-xs text-earth-600">
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          {payable?.label ? ` - ${payable.label}` : ''}
                        </p>
                        {charge && (
                          <p className="mt-1 text-sm text-earth-700">
                            {formatJPY(charge.jpy)} <span className="text-earth-500">({formatBRL(charge.approxBrl)} aprox.)</span>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: true, order, useWallet: true })}
                        className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
                      >
                        Pagar agora
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      

      {payModal.open && payModal.order &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 relative"
            style={{ position: 'fixed', inset: 0 }}
            onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
          >
          {feedback && (
            <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
              <p
                className={`rounded-lg px-4 py-2 text-sm ${
                  feedback.includes('Erro') || feedback.includes('erro')
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {feedback}
              </p>
            </div>
          )}
          <div
            className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <h3 className="font-semibold text-earth-900">Pagamento</h3>
              <p className="mt-1 text-sm text-earth-600">Escolha a forma de pagamento.</p>

              {(() => {
                const {
                  charge,
                  balance,
                  canUseWallet,
                  totalJpy,
                  walletApplied,
                  remainingJpy,
                } = getPaymentBreakdown(payModal.order, payModal.useWallet)
                const useWallet = !!payModal.useWallet && canUseWallet

                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 space-y-2">
                      {charge && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-earth-600">{charge.label || 'Subtotal'}</span>
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
                          <p className="text-xs text-earth-500 mt-1">
                            Aprox. em BRL: {formatBRL(remainingJpy > 0 ? jpyToBrl(remainingJpy) : 0)}
                          </p>
                        </>
                      )}
                    </div>

                    <label
                      className={`flex items-start gap-3 rounded-lg border p-4 ${
                        canUseWallet ? 'border-earth-200 bg-white cursor-pointer' : 'border-earth-100 bg-earth-50 opacity-70'
                      }`}
                    >
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
                const { isFullyCovered, remainingBrl } = getPaymentBreakdown(payModal.order, payModal.useWallet)

                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayCard(!!payModal.useWallet)}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        Cartão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isFullyCovered) {
                            handlePayCard(true)
                            return
                          }
                          setPayModal((m) => ({ ...m, open: false }))
                          setPixModal({ open: true, order: payModal.order, amountBrl: remainingBrl })
                        }}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        PIX
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayCard(isFullyCovered ? true : !!payModal.useWallet)}
                        disabled={submitting}
                        className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {submitting ? 'Processando...' : 'Finalizar pagamento'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default Cart
