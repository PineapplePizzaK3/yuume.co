/**
 * Pedidos em fase de envio internacional — exibidos na aba Envios do Lounge.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { useAuth } from '../../hooks/useAuth'
import { getOrderById } from '../../services/orderService'
import { createCheckoutSession } from '../../services/paymentService'
import { getWallet } from '../../services/walletService'
import { brlToJpy, jpyToBrl } from '../../lib/fx'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import QuoteProductsList from '../../components/QuoteProductsList'
import OrderAttachments from '../../components/OrderAttachments'
import {
  getLoungeShippingTabPayableAmount,
  isOrderInLoungeShippingTab,
  readUserShippingQuoteBreakdown,
} from '../../lib/loungeOrderRouting'
import { fetchLoungeOrderPage } from '../../lib/loungeOrdersPagedFetch'
import { PARCELOW_CARD_BRANDS_IMG, PIX_OFFICIAL_LOGO_IMG } from '../../components/paymentModalConstants'

const PAGE_SIZE = 12

const GATEWAY_OPTIONS_META = [
  { id: 'parcelow', label: 'Parcelow', icon: '🇧🇷' },
  { id: 'stripe', label: 'Stripe', icon: '🌐' },
]

function numPositive(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0
}

function getChargeJpyForShipping(order) {
  const p = getLoungeShippingTabPayableAmount(order)
  if (!p) return null
  const c = (p.currency || 'JPY').toUpperCase()
  const amountJpy = c === 'BRL' ? brlToJpy(p.amount) : p.amount
  const roundedJpy = Math.round(Number(amountJpy) || 0)
  return { amountJpy: roundedJpy, approxBrl: jpyToBrl(roundedJpy), kind: p.kind || 'shipping' }
}

function orderStatusLabel(t, status) {
  if (!status) return ''
  const key = `platform.orders.status.${status}`
  return t(key, { defaultValue: status })
}

function getProductThumb(product) {
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

/** Itens de loja / carrinho ligados ao pedido (mesma lógica da aba Pedidos). */
function getRequestedItems(order, t) {
  if (!Array.isArray(order?.order_items)) return []
  return order.order_items.map((it, index) => {
    const qty = Math.max(1, parseInt(it?.quantity, 10) || 1)
    const unitPrice = Number(it?.price_at_purchase) || 0
    const pid = it?.product_id
    const name =
      it?.product?.name ||
      (pid
        ? t('platform.orders.productFallback', { id: String(pid).slice(0, 8) })
        : t('platform.orders.itemFallback', { n: index + 1 }))
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

function getRequestedItemsCurrency(order) {
  if (order?.order_source === 'store') return 'BRL'
  if (order?.quote_currency) return order.quote_currency
  if (order?.shipping_currency) return order.shipping_currency
  return 'JPY'
}

export default function LoungeShippingOrdersSection() {
  const { t } = useTranslation()
  const fp = useFormatPrice()
  const formatByCurrency = (value, currency = 'JPY') => fp.byCurrency(value, currency)
  const lp = useLocalizedPath()
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [banner, setBanner] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [selectedGateway, setSelectedGateway] = useState('parcelow')
  const [detailsModal, setDetailsModal] = useState({ open: false, order: null })
  const [targetOrderId, setTargetOrderId] = useState(null)
  const [hasOpenedTargetOrder, setHasOpenedTargetOrder] = useState(false)

  const gatewayOptions = useMemo(
    () =>
      GATEWAY_OPTIONS_META.map((entry) => ({
        ...entry,
        details: t(`platform.orders.gateway.${entry.id}`),
      })),
    [t],
  )

  useEffect(() => {
    if (!payModal.open) setSelectedGateway('parcelow')
  }, [payModal.open])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const id = url.searchParams.get('orderId')
      if (!id) return
      setTargetOrderId(id)
      setHasOpenedTargetOrder(false)
      url.searchParams.delete('orderId')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id || !targetOrderId || hasOpenedTargetOrder) return
      const onPage = orders.find((o) => o.id === targetOrderId)
      if (onPage) {
        if (!isActive) return
        setDetailsModal({ open: true, order: onPage })
        setHasOpenedTargetOrder(true)
        return
      }
      const { data, error } = await getOrderById(targetOrderId, user.id)
      if (!isActive) return
      if (error || !data) {
        setBanner({ text: t('platform.shippingOrders.orderNotFound'), variant: 'info' })
        setHasOpenedTargetOrder(true)
        return
      }
      if (!isOrderInLoungeShippingTab(data)) {
        navigate(
          lp('appLounge', `?tab=pedidos&orderId=${encodeURIComponent(targetOrderId)}`),
          { replace: true },
        )
        setHasOpenedTargetOrder(true)
        return
      }
      setDetailsModal({ open: true, order: data })
      setHasOpenedTargetOrder(true)
    }
    void run()
    return () => {
      isActive = false
    }
  }, [user?.id, targetOrderId, hasOpenedTargetOrder, orders, navigate, lp, t])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error, hasMore: more } = await fetchLoungeOrderPage(user.id, {
        page,
        pageSize: PAGE_SIZE,
        matchFn: isOrderInLoungeShippingTab,
        excludeStatus: 'completed',
      })
      if (!isActive) return
      if (error) {
        setBanner({ text: error.message || t('platform.shippingOrders.loadError'), variant: 'info' })
        setOrders([])
        setHasMore(false)
      } else {
        setOrders(data)
        setHasMore(more)
        const { data: w } = await getWallet(user.id)
        if (isActive) setWallet(w ?? null)
      }
      setLoading(false)
    }
    void run()
    return () => {
      isActive = false
    }
  }, [user?.id, page, t])

  const handlePay = async (order, { useWallet = false, provider = null } = {}) => {
    if (!getLoungeShippingTabPayableAmount(order)) return
    setPayingId(order.id)
    setBanner(null)
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setBanner({ text: t('platform.shippingOrders.loginPay'), variant: 'info' })
        setPayingId(null)
        return
      }
      const result = await createCheckoutSession(order.id, accessToken, { useWallet, provider })
      if (result?.paid) {
        setBanner({ text: t('platform.shippingOrders.paySuccess'), variant: 'success' })
        setPayModal({ open: false, order: null, useWallet: true })
        setPage(0)
        const { data, hasMore: more } = await fetchLoungeOrderPage(user.id, {
          page: 0,
          pageSize: PAGE_SIZE,
          matchFn: isOrderInLoungeShippingTab,
          excludeStatus: 'completed',
        })
        setOrders(data)
        setHasMore(more)
        const { data: w } = await getWallet(user.id)
        setWallet(w ?? null)
        return
      }
      const url = result?.url
      if (url) window.location.href = url
      else setBanner({ text: t('platform.shippingOrders.sessionError'), variant: 'info' })
    } catch (err) {
      setBanner({ text: err.message || t('platform.shippingOrders.payError'), variant: 'info' })
    } finally {
      setPayingId(null)
    }
  }

  if (!user) return null

  return (
    <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <h2 className="text-lg font-semibold text-earth-900">{t('platform.shippingOrders.title')}</h2>
      <p className="mt-1 text-sm text-earth-600">{t('platform.shippingOrders.subtitle')}</p>

      {banner && (
        <p
          className={`mt-4 rounded-lg px-4 py-2 text-sm ${
            banner.variant === 'success' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {banner.text}
        </p>
      )}

      {loading && <p className="mt-4 text-sm text-earth-600">{t('platform.shippingOrders.loading')}</p>}

      {!loading && orders.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">{t('platform.shippingOrders.empty')}</p>
      )}

      {!loading && orders.length > 0 && (
        <div className="mt-4 space-y-4">
          {orders.map((o) => {
            const bd = readUserShippingQuoteBreakdown(o)
            const payable = getLoungeShippingTabPayableAmount(o)
            const stLabel = orderStatusLabel(t, o.status)
            return (
              <div key={o.id} className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-medium text-earth-900">
                      {t('platform.shippingOrders.orderId', { id: o.id?.slice(0, 8) })}
                    </span>
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      {stLabel}
                    </span>
                    {o.order_source === 'store' && (
                      <span className="ml-2 rounded-md bg-earth-100 px-2 py-0.5 text-xs text-earth-800">
                        {t('platform.shippingOrders.storeTag')}
                      </span>
                    )}
                    {o.service?.name && <p className="mt-1 text-sm text-earth-600">{o.service.name}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsModal({ open: true, order: o })}
                      className="rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
                    >
                      {t('platform.shippingOrders.details')}
                    </button>
                    {payable && (
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: true, order: o, useWallet: true })}
                        className="rounded-lg bg-earth-900 px-3 py-1.5 text-sm font-medium text-earth-50 hover:bg-earth-800"
                      >
                        {t('platform.shippingOrders.payShipping')}
                      </button>
                    )}
                  </div>
                </div>

                {bd && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-earth-700">
                    <p className="font-semibold text-earth-900">{t('platform.shippingOrders.breakdownTitle')}</p>
                    <p>
                      {t('platform.shippingOrders.breakdownLine', {
                        base: formatByCurrency(bd.base, bd.currency),
                        perItem: formatByCurrency(bd.perItem, bd.currency),
                        count: bd.itemsCount,
                        perItemTotal: formatByCurrency(bd.perItemTotal, bd.currency),
                      })}
                    </p>
                    {bd.finalTotal != null && (
                      <p className="mt-1 font-semibold text-earth-900">
                        {t('platform.shippingOrders.totalCharged', {
                          amount: formatByCurrency(bd.finalTotal, bd.currency),
                        })}
                      </p>
                    )}
                  </div>
                )}

                {!bd && numPositive(o.shipping_cost) && (
                  <p className="mt-3 text-sm text-earth-700">
                    {t('platform.shippingOrders.shippingOnly', {
                      amount: formatByCurrency(Number(o.shipping_cost), o.shipping_currency || 'JPY'),
                    })}
                  </p>
                )}

                {o.message && (
                  <div className="mt-3">
                    <QuoteProductsList
                      message={o.message}
                      quoteCurrency={o.quote_currency || 'JPY'}
                      formatMoney={(v, c) => formatByCurrency(v, c)}
                      orderModule={o.order_module}
                    />
                  </div>
                )}
                {Array.isArray(o.attachment_urls) && o.attachment_urls.length > 0 && (
                  <div className="mt-2">
                    <OrderAttachments urls={o.attachment_urls} />
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-earth-50 px-3 py-2">
            <p className="text-xs text-earth-600">{t('platform.shippingOrders.page', { page: page + 1 })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={loading || page <= 0}
                className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
              >
                {t('platform.shippingOrders.prev')}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || !hasMore}
                className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
              >
                {t('platform.shippingOrders.next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal.open && detailsModal.order && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailsModal({ open: false, order: null })}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-earth-900">{t('platform.shippingOrders.detailTitle')}</h3>
            <p className="mt-2 text-sm text-earth-600">
              {t('platform.shippingOrders.statusLine', {
                status: orderStatusLabel(t, detailsModal.order.status),
              })}
            </p>
            {detailsModal.order.service?.name && (
              <p className="mt-2 text-sm text-earth-700">
                <span className="text-earth-500">{t('platform.orders.labelService')}: </span>
                {detailsModal.order.service.name}
              </p>
            )}
            {readUserShippingQuoteBreakdown(detailsModal.order) && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-earth-700">
                {(() => {
                  const b = readUserShippingQuoteBreakdown(detailsModal.order)
                  return (
                    <>
                      <p className="font-semibold text-earth-900">{t('platform.shippingOrders.breakdownTitle')}</p>
                      <p>
                        {t('platform.shippingOrders.breakdownBase', {
                          amount: formatByCurrency(b.base, b.currency),
                        })}
                      </p>
                      <p>
                        {t('platform.shippingOrders.redirectFeeLine', {
                          perItem: formatByCurrency(b.perItem, b.currency),
                          count: b.itemsCount,
                          perItemTotal: formatByCurrency(b.perItemTotal, b.currency),
                        })}
                      </p>
                      {b.finalTotal != null && (
                        <p className="font-semibold">
                          {t('platform.shippingOrders.totalSimple', {
                            amount: formatByCurrency(b.finalTotal, b.currency),
                          })}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            {detailsModal.order.message && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-earth-500">
                  {t('platform.orders.requestBlockTitle')}
                </p>
                <QuoteProductsList
                  message={detailsModal.order.message}
                  quoteCurrency={detailsModal.order.quote_currency || 'JPY'}
                  formatMoney={(v, c) => formatByCurrency(v, c)}
                  orderModule={detailsModal.order.order_module}
                />
              </div>
            )}
            {(() => {
              const requestedItems = getRequestedItems(detailsModal.order, t)
              if (requestedItems.length === 0) return null
              const totalRequested = requestedItems.reduce((sum, item) => sum + item.lineTotal, 0)
              const itemsCurrency = getRequestedItemsCurrency(detailsModal.order)
              const storeItemsJpy = detailsModal.order?.order_source === 'store'
              return (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-earth-500">
                    {t('platform.orders.requestedItemsTitle')}
                  </p>
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
                              <p className="text-xs text-earth-600">{t('platform.orders.qty', { n: item.qty })}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-earth-700">
                              {storeItemsJpy ? fp.jpy(item.lineTotal) : formatByCurrency(item.lineTotal, itemsCurrency)}
                            </p>
                            {item.qty > 1 && (
                              <p className="text-xs text-earth-500">
                                {t('platform.orders.each', {
                                  price: storeItemsJpy
                                    ? fp.jpy(item.unitPrice)
                                    : formatByCurrency(item.unitPrice, itemsCurrency),
                                })}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-earth-200 pt-2 text-sm font-semibold text-earth-900">
                      {t('platform.orders.itemsTotal')}{' '}
                      {storeItemsJpy ? fp.jpy(totalRequested) : formatByCurrency(totalRequested, itemsCurrency)}
                    </p>
                  </div>
                </div>
              )
            })()}
            {Array.isArray(detailsModal.order.attachment_urls) && detailsModal.order.attachment_urls.length > 0 && (
              <div className="mt-3">
                <OrderAttachments urls={detailsModal.order.attachment_urls} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setDetailsModal({ open: false, order: null })}
              className="mt-6 rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
            >
              {t('platform.shippingOrders.close')}
            </button>
          </div>
        </div>
      )}

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <h3 className="font-semibold text-earth-900">{t('platform.shippingOrders.payModalTitle')}</h3>
              {(() => {
                const p = getChargeJpyForShipping(payModal.order)
                const balance = wallet?.balance ?? 0
                const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
                const totalJpy = p?.amountJpy ?? 0
                const useWallet = !!payModal.useWallet && canUseWallet
                const walletApplied = useWallet ? Math.min(balance, totalJpy) : 0
                let remainingJpy = Math.max(0, totalJpy - walletApplied)
                if (remainingJpy > 0 && remainingJpy < 1) remainingJpy = 0
                const lineKey = p?.kind ? `platform.orders.payable.${p.kind}` : 'platform.orders.payable.shipping'
                const lineLabel = p ? t(lineKey, { defaultValue: p.kind }) : ''
                return (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2 rounded-lg border border-earth-200 bg-earth-50 p-4">
                      {p && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-earth-600">{lineLabel}</span>
                            <span className="font-medium text-earth-900">{fp.jpy(totalJpy)}</span>
                          </div>
                          {useWallet && walletApplied > 0 && (
                            <div className="flex justify-between text-sm text-green-700">
                              <span>{t('platform.shippingOrders.wallet')}</span>
                              <span>-{fp.jpy(walletApplied)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-earth-200 pt-2 font-medium">
                            <span className="text-earth-800">{t('platform.shippingOrders.totalDue')}</span>
                            <span className="text-earth-900">{fp.jpy(remainingJpy)}</span>
                          </div>
                          <p className="mt-1 text-xs text-earth-500">
                            {t('platform.shippingOrders.approxBrl', {
                              amount: fp.brl(jpyToBrl(remainingJpy)),
                            })}
                          </p>
                        </>
                      )}
                    </div>
                    <label
                      className={`flex items-start gap-3 rounded-lg border p-4 ${
                        canUseWallet ? 'cursor-pointer border-earth-200 bg-white' : 'border-earth-100 bg-earth-50 opacity-70'
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
                        <p className="font-medium text-earth-900">{t('platform.shippingOrders.useWallet')}</p>
                        <p className="text-sm text-earth-600">
                          {t('platform.shippingOrders.balance', { amount: fp.jpy(balance) })}
                        </p>
                      </div>
                    </label>
                    <div className="rounded-lg border border-earth-200 bg-white p-4">
                      <p className="font-medium text-earth-900">{t('platform.shippingOrders.payMethod')}</p>
                      <select
                        value={selectedGateway}
                        onChange={(e) => setSelectedGateway(e.target.value)}
                        className="mt-2 w-full rounded border border-earth-300 px-3 py-2 text-sm"
                      >
                        {gatewayOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.icon} {opt.label} — {opt.details}
                          </option>
                        ))}
                      </select>
                      {selectedGateway === 'parcelow' && (
                        <div className="mt-3 space-y-2 rounded-md border border-earth-100 bg-earth-50/90 p-3">
                          <p className="text-xs font-medium text-earth-600">Parcelow · formas aceitas</p>
                          <div className="flex flex-col gap-3">
                            <img
                              src={PIX_OFFICIAL_LOGO_IMG}
                              alt="PIX"
                              className="h-9 w-auto max-w-full object-contain object-left"
                              loading="lazy"
                            />
                            <img
                              src={PARCELOW_CARD_BRANDS_IMG}
                              alt=""
                              className="h-auto w-full max-h-32 object-contain object-left sm:max-h-40 md:max-h-44"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="shrink-0 border-t border-earth-200 bg-earth-50 p-4">
              {(() => {
                const p = getChargeJpyForShipping(payModal.order)
                const balance = wallet?.balance ?? 0
                const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
                const totalJpy = p?.amountJpy ?? 0
                const useWallet = !!payModal.useWallet && canUseWallet
                let remainingJpy = Math.max(0, totalJpy - (useWallet ? Math.min(balance, totalJpy) : 0))
                if (remainingJpy > 0 && remainingJpy < 1) remainingJpy = 0
                const isFullyCovered = remainingJpy <= 0 && useWallet
                return (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handlePay(payModal.order, {
                          useWallet: isFullyCovered ? true : useWallet,
                          provider: selectedGateway,
                        })
                      }
                      disabled={payingId === payModal.order.id}
                      className="flex-1 min-w-[8rem] rounded-lg bg-earth-900 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                    >
                      {payingId === payModal.order.id
                        ? t('platform.shippingOrders.processing')
                        : t('platform.shippingOrders.pay')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
                      className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      {t('platform.shippingOrders.cancel')}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
