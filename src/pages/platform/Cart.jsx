/**
 * Central de Pagamentos - checkout da loja + pagamentos pendentes.
 * Todos os pagamentos da conta são centralizados aqui para melhorar a UX.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { PageSeo } from '../../components/PageSeo'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCart, updateCartItem, removeFromCart, getLatestPendingStoreOrder } from '../../services/cartService'
import { getMyCoupons, validateCoupon } from '../../services/couponService'
import { createCheckoutSession, fetchExchangeRates, getMyPayments } from '../../services/paymentService'
import { getMyOrders } from '../../services/orderService'
import { getWallet } from '../../services/walletService'
import {
  computeGrupoComprasFeeBrl,
  computeGrupoComprasFeeDisplayBrl,
  SERVICE_FEE_JPY_PER_ITEM,
  GRUPO_COMPRAS_FEE_PERCENT,
  GRUPO_COMPRAS_FEE_PER_UNIT_USD,
} from '../../data/serviceFees'
import { brlToJpy, formatUSD, jpyToBrl, getFxBrlPerJpy } from '../../lib/fx'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import { appStoreProductPath } from '../../lib/localeRoutes'
import { getSystemSettings } from '../../services/settingsService'
import { GATEWAY_OPTIONS_META, PAYMENT_METHODS_BY_GATEWAY } from '../../components/paymentModalConstants'

function getCartItemImages(product, variant) {
  const variantList = Array.isArray(variant?.image_urls) ? variant.image_urls.filter(Boolean) : []
  if (variantList.length > 0) return variantList
  if (variant?.image_url) return [variant.image_url]
  const productList = Array.isArray(product?.image_urls) ? product.image_urls.filter(Boolean) : []
  if (productList.length > 0) return productList
  if (product?.image_url) return [product.image_url]
  return []
}

function formatPriceBrlAsJpy(brl) {
  const jpy = Math.round(brlToJpy(brl))
  const approxBrl = jpyToBrl(jpy)
  return { jpy, approxBrl }
}

/** Estoque limitado: retorna inteiro ≥ 0. `null` = sem limite (ilimitado). */
function getProductStockCap(p) {
  if (!p || p.stock_quantity == null) return null
  const n = Number(p.stock_quantity)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.floor(n))
}

const CART_TAB_ORDER_STORAGE_KEY = 'cart_tabs_order_v1'
const CART_TAB_IDS = ['checkout', 'history']

function Cart() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const fp = useFormatPrice()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const { user, session } = useAuth()
  const lp = useLocalizedPath()
  const [searchParams, setSearchParams] = useSearchParams()

  const cartTabs = useMemo(
    () => [
      { id: 'checkout', label: t('platform.cart.tabCheckout') },
      { id: 'history', label: t('platform.cart.tabHistory') },
    ],
    [t]
  )

  const gatewayOptions = useMemo(
    () =>
      GATEWAY_OPTIONS_META.map((entry) => ({
        ...entry,
        details: t(`platform.orders.gateway.${entry.id}`),
      })),
    [t]
  )

  const paymentStatusLabels = useMemo(
    () => ({
      pending: t('platform.cart.paymentStatus.pending'),
      completed: t('platform.cart.paymentStatus.completed'),
      failed: t('platform.cart.paymentStatus.failed'),
      refunded: t('platform.cart.paymentStatus.refunded'),
    }),
    [t]
  )

  const methodGroupLabels = useMemo(
    () => ({
      card: t('platform.cart.methodGroup.card'),
      pix: t('platform.cart.methodGroup.pix'),
      transfer: t('platform.cart.methodGroup.transfer'),
    }),
    [t]
  )
  const [items, setItems] = useState([])
  const [qtyDrafts, setQtyDrafts] = useState({})
  const [pendingOrders, setPendingOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: false, cartCheckout: false })
  const [walletApplyMode, setWalletApplyMode] = useState('full')
  const [walletCustomAmount, setWalletCustomAmount] = useState('')
  const [selectedGateway, setSelectedGateway] = useState('parcelow')
  const [selectedMethodGroup, setSelectedMethodGroup] = useState('card')
  const [feedback, setFeedback] = useState('')
  const [systemSettings, setSystemSettings] = useState(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [myCoupons, setMyCoupons] = useState([])
  const [myCouponsLoading, setMyCouponsLoading] = useState(false)
  const [draggingTabId, setDraggingTabId] = useState('')
  const [tabOrder, setTabOrder] = useState(() => [...CART_TAB_IDS])
  const [exchangeSnapshot, setExchangeSnapshot] = useState(null)
  const loadCartSeqRef = useRef(0)

  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'
  const payOrderId = searchParams.get('payOrderId')
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'checkout'

  const normalizeTabOrder = (raw) => {
    const allowed = [...CART_TAB_IDS]
    const base = Array.isArray(raw) ? raw : []
    const safe = base.filter((id) => allowed.includes(id))
    for (const id of allowed) {
      if (!safe.includes(id)) safe.push(id)
    }
    return safe
  }

  const orderedTabs = normalizeTabOrder(tabOrder)

  const handleTabReorder = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    setTabOrder((prev) => {
      const current = normalizeTabOrder(prev)
      const draggedIndex = current.indexOf(draggedId)
      const targetIndex = current.indexOf(targetId)
      if (draggedIndex < 0 || targetIndex < 0) return current
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedId)
      return current
    })
  }

  const loadCart = async ({ silent = false } = {}) => {
    if (!user?.id) return
    const seq = ++loadCartSeqRef.current
    if (!silent) setLoading(true)
    try {
      const { data, error } = await getCart(user.id)
      if (seq !== loadCartSeqRef.current) return
      setItems(data ?? [])
      if (error) setFeedback(error.message)
    } finally {
      if (seq === loadCartSeqRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setTabOrder([...CART_TAB_IDS])
      return
    }
    try {
      const raw = localStorage.getItem(CART_TAB_ORDER_STORAGE_KEY)
      if (!raw) {
        setTabOrder([...CART_TAB_IDS])
        return
      }
      const all = JSON.parse(raw)
      setTabOrder(normalizeTabOrder(all?.[user.id]))
    } catch {
      setTabOrder([...CART_TAB_IDS])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(CART_TAB_ORDER_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      all[user.id] = normalizeTabOrder(tabOrder)
      localStorage.setItem(CART_TAB_ORDER_STORAGE_KEY, JSON.stringify(all))
    } catch {
      // ignore
    }
  }, [user?.id, tabOrder])

  const getPayableAmount = (order) => {
    if (order?.status !== 'awaiting_payment') return null
    if (order?.quote_amount != null && Number(order.quote_amount) > 0) {
      return { amount: Number(order.quote_amount), currency: order.quote_currency || 'JPY', kind: 'quote' }
    }
    if (order?.total_amount != null && Number(order.total_amount) > 0) {
      return { amount: Number(order.total_amount), currency: 'BRL', kind: 'productTotal' }
    }
    if (order?.shipping_cost != null && Number(order.shipping_cost) > 0) {
      return { amount: Number(order.shipping_cost), currency: order.shipping_currency || 'JPY', kind: 'shipping' }
    }
    return null
  }

  const loadPendingOrders = async () => {
    if (!user?.id) return
    setPendingLoading(true)
    const { data, error } = await getMyOrders(user.id, { limit: 40, offset: 0 })
    if (error) {
      setFeedback(error.message || t('platform.cart.errors.loadPending'))
      setPendingOrders([])
      setPendingLoading(false)
      return []
    }
    const list = (data ?? []).filter((order) => !!getPayableAmount(order))
    setPendingOrders(list)
    setPendingLoading(false)
    return list
  }

  const loadPayments = async () => {
    if (!user?.id) return
    setPaymentsLoading(true)
    const { data, error } = await getMyPayments()
    if (error) {
      setFeedback(error.message || t('platform.cart.errors.loadHistory'))
      setPayments([])
      setPaymentsLoading(false)
      return
    }
    setPayments(data ?? [])
    setPaymentsLoading(false)
  }

  useEffect(() => {
    loadCart()
  }, [user?.id])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const r = await fetchExchangeRates()
        if (!active || !r?.ok || !r?.jpy_usd) return
        setExchangeSnapshot(r)
      } catch {
        // mantém fallback fx.js
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setQtyDrafts((prev) => {
      const next = {}
      for (const item of items) {
        const key = item.variant_id || item.product_id
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key]
        }
      }
      return next
    })
  }, [items])

  useEffect(() => {
    loadPendingOrders()
  }, [user?.id])

  useEffect(() => {
    loadPayments()
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
    let active = true
    const run = async () => {
      if (!user?.id) return
      setMyCouponsLoading(true)
      const { data, error } = await getMyCoupons(user.id)
      if (!active) return
      if (error) {
        setMyCoupons([])
      } else {
        setMyCoupons(data ?? [])
      }
      setMyCouponsLoading(false)
    }
    run()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (!success && !canceled) return
    if (success) setFeedback(t('platform.cart.feedbackSuccess'))
    else if (canceled) setFeedback(t('platform.cart.feedbackCanceled'))
    const next = new URLSearchParams(searchParams)
    next.delete('success')
    next.delete('canceled')
    setSearchParams(next, { replace: true })
  }, [success, canceled, searchParams, setSearchParams, t])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      const settingsRes = await getSystemSettings()
      if (!isActive) return
      setSystemSettings(settingsRes.data || null)
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  useEffect(() => {
    if (!payOrderId || pendingLoading || payModal.open) return
    const target = pendingOrders.find((o) => o.id === payOrderId)
    if (!target) return
    setPayModal({ open: true, order: target, useWallet: false, cartCheckout: false })
    setFeedback('')
  }, [payOrderId, pendingLoading, pendingOrders, payModal.open])

  useEffect(() => {
    if (!payModal.open) return
    // Volta do gateway (cancel/success) deixa feedback preso no overlay do modal; limpar ao abrir.
    setFeedback((prev) => {
      const prevStr = String(prev || '').trim()
      const clearMsgs = [
        t('platform.cart.feedbackCanceled'),
        t('platform.cart.feedbackSuccess'),
        t('platform.cart.payWalletSuccess'),
      ]
      if (clearMsgs.includes(prevStr)) return ''
      return prev
    })
  }, [payModal.open, t])

  useEffect(() => {
    if (!payModal.open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [payModal.open])

  useEffect(() => {
    if (!payModal.open) {
      setWalletApplyMode('full')
      setWalletCustomAmount('')
      setSelectedGateway('parcelow')
      setSelectedMethodGroup('card')
    }
  }, [payModal.open])

  useEffect(() => {
    const methods = PAYMENT_METHODS_BY_GATEWAY[selectedGateway] || []
    const groups = Array.from(new Set(methods.map((m) => m.group || 'card')))
    if (groups.length > 0 && !groups.includes(selectedMethodGroup)) {
      setSelectedMethodGroup(groups[0])
    }
  }, [selectedGateway, selectedMethodGroup])

  const { productSubtotalBrl, grupoFeeBrl, grupoQty, cartSubtotalJpy } = useMemo(() => {
    let lojaBrl = 0
    let grupoBrl = 0
    let grupoUsd = 0
    let q = 0
    let cartJpy = 0
    for (const i of items) {
      const p = i.products
      const variant = i.product_variants
      if (!p) continue
      const qty = Number(i.quantity) || 1
      const jpyUnit = Number(variant?.price_jpy ?? p.price_jpy ?? p.price) || 0
      cartJpy += jpyUnit * qty
      const brlUnit = Number(p.price_brl)
      const usdUnit = Number(p.price_usd)
      const lineBrl = Number.isFinite(brlUnit) && brlUnit > 0 ? brlUnit * qty : jpyToBrl(jpyUnit) * qty
      const lineUsd = Number.isFinite(usdUnit) && usdUnit > 0 ? usdUnit * qty : 0
      if (p.purchase_group_id) {
        grupoBrl += lineBrl
        grupoUsd += lineUsd
        q += qty
      } else {
        lojaBrl += lineBrl
      }
    }
    const usdBrl = Number(exchangeSnapshot?.usd_brl)
    const fee =
      usdBrl > 0 && grupoUsd > 0
        ? computeGrupoComprasFeeDisplayBrl(grupoUsd, q, usdBrl)
        : (() => {
            const fxRaw = Number(systemSettings?.fx_brl_per_jpy?.amount)
            const fx = Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : getFxBrlPerJpy()
            // Subtotal em BRL do grupo — não usar JPY aqui: computeGrupoComprasFeeBrl aplica % sobre BRL.
            return computeGrupoComprasFeeBrl(grupoBrl, q, fx)
          })()
    return {
      productSubtotalBrl: lojaBrl + grupoBrl,
      grupoFeeBrl: fee,
      grupoQty: q,
      cartSubtotalJpy: cartJpy,
    }
  }, [items, systemSettings, exchangeSnapshot])

  const totalBrl = productSubtotalBrl + grupoFeeBrl
  const discountBrl = couponApplied?.discount_brl ?? 0
  const totalAfterDiscountBrl = Math.max(0, totalBrl - discountBrl)

  const cartItemsKey = useMemo(
    () => items.map((i) => `${i.variant_id || i.product_id}:${i.quantity}`).join('|'),
    [items]
  )

  useEffect(() => {
    if (!couponApplied?.code || loading) return
    const code = String(couponApplied.code).trim()
    if (!code) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await validateCoupon(code, totalBrl)
      if (cancelled) return
      if (error || !data) {
        setCouponApplied(null)
        setCouponInput('')
        setFeedback(t('platform.cart.errors.couponInvalidAfterCart'))
        return
      }
      setCouponApplied((prev) => {
        if (!prev || String(prev.code).trim() !== code) return data
        if (
          prev.discount_brl === data.discount_brl
          && prev.coupon_id === data.coupon_id
        ) {
          return prev
        }
        return data
      })
    })()
    return () => {
      cancelled = true
    }
  }, [cartItemsKey, totalBrl, couponApplied?.code, loading, t])
  const effBrlPerJpyCheckout =
    Number(exchangeSnapshot?.effective_brl_per_jpy) > 0
      ? Number(exchangeSnapshot.effective_brl_per_jpy)
      : getFxBrlPerJpy()
  /** Iene do resumo = soma dos ¥ dos itens (+ taxa grupo na mesma taxa implícita BRL/¥ do carrinho), depois cupom — não inverter só com cotação Frankfurter (diverge do price_brl do servidor). */
  const impliedBrlPerJpyFromCart =
    cartSubtotalJpy > 0 && productSubtotalBrl > 0
      ? productSubtotalBrl / cartSubtotalJpy
      : null
  const feeJpyConversionRate =
    impliedBrlPerJpyFromCart != null && impliedBrlPerJpyFromCart > 0
      ? impliedBrlPerJpyFromCart
      : effBrlPerJpyCheckout
  const grupoFeeJpy =
    grupoFeeBrl > 0 && feeJpyConversionRate > 0
      ? Math.round(grupoFeeBrl / feeJpyConversionRate)
      : 0
  const totalJpyBeforeCoupon = Math.round(cartSubtotalJpy + grupoFeeJpy)
  const totalJpy =
    cartSubtotalJpy > 0 && totalBrl > 0
      ? Math.max(0, Math.round(totalJpyBeforeCoupon * (totalAfterDiscountBrl / totalBrl)))
      : Math.round(totalAfterDiscountBrl / effBrlPerJpyCheckout)
  const totalUsdEstimate =
    exchangeSnapshot?.usd_brl > 0 ? totalAfterDiscountBrl / Number(exchangeSnapshot.usd_brl) : null

  const handleApplyCoupon = async (inputCode = null) => {
    const code = String(inputCode ?? couponInput).trim()
    if (!code) {
      setFeedback(t('platform.cart.errors.couponEmpty'))
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
    setCouponInput(String(data?.code || code).toUpperCase())
    setCouponApplied(data)
    setFeedback('')
  }

  const handleRemoveCoupon = () => {
    setCouponApplied(null)
    setCouponInput('')
    setFeedback('')
  }

  const handleUpdateQty = async (variantId, quantity) => {
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1))
    const currentItem = items.find((i) => (i.variant_id || i.product_id) === variantId)
    const currentQty = Number(currentItem?.quantity || 1)
    if (qty === currentQty) {
      setQtyDrafts((d) => {
        const next = { ...d }
        delete next[variantId]
        return next
      })
      return
    }
    const { error } = await updateCartItem(user.id, variantId, qty)
    if (error) setFeedback(error.message)
    else {
      setQtyDrafts((d) => {
        const next = { ...d }
        delete next[variantId]
        return next
      })
      loadCart({ silent: true })
    }
  }

  const handleRemove = async (variantId) => {
    const snapshot = items
    setItems((prev) => prev.filter((i) => (i.variant_id || i.product_id) !== variantId))
    const { error } = await removeFromCart(user.id, variantId)
    if (error) {
      setFeedback(error.message)
      setItems(snapshot)
      return
    }
    await loadCart({ silent: true })
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      setFeedback(t('platform.cart.errors.noStoreItems'))
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: latestPendingStoreOrder, error: latestPendingError } = await getLatestPendingStoreOrder(user.id)
      if (latestPendingError) {
        setFeedback(latestPendingError.message || t('platform.cart.errors.verifyPending'))
        return
      }

      if (latestPendingStoreOrder?.id) {
        setPayModal({ open: true, order: latestPendingStoreOrder, useWallet: false, cartCheckout: false })
        setFeedback('')
        return
      }

      const orderItemsPreview = items
        .map((i) => {
          const p = i.products
          const variant = i.product_variants
          if (!p) return null
          const qty = Math.max(1, Number(i.quantity) || 1)
          const jpyUnit = Number(variant?.price_jpy ?? p.price_jpy ?? p.price) || 0
          return { quantity: qty, price_at_purchase: jpyUnit }
        })
        .filter(Boolean)

      const orderToPay = {
        id: null,
        status: 'awaiting_payment',
        order_source: 'store',
        ship_immediately: false,
        total_amount: totalAfterDiscountBrl,
        total_amount_usd:
          totalUsdEstimate != null && Number.isFinite(totalUsdEstimate) ? totalUsdEstimate : null,
        discount_amount: discountBrl > 0 ? discountBrl : null,
        wallet_applied_amount: 0,
        order_items: orderItemsPreview,
      }

      setPayModal({ open: true, order: orderToPay, useWallet: false, cartCheckout: true })
      setFeedback('')
    } catch (e) {
      setFeedback(e?.message || t('platform.cart.errors.processGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const getOrderChargeJpy = (order) => {
    const payable = getPayableAmount(order)
    if (!payable) return null
    const currency = (payable.currency || 'JPY').toUpperCase()
    const effBrlPerJpy =
      Number(exchangeSnapshot?.effective_brl_per_jpy) > 0
        ? Number(exchangeSnapshot.effective_brl_per_jpy)
        : getFxBrlPerJpy()

    if (currency === 'BRL') {
      const baseBrl = Number(payable.amount) || 0
      const orderItems = order?.order_items
      const brlBasedJpy = Math.round(baseBrl / effBrlPerJpy)
      let lineBasedJpy = null
      if (
        order?.order_source === 'store'
        && Array.isArray(orderItems)
        && orderItems.length > 0
      ) {
        const itemsJpySum = orderItems.reduce((sum, it) => {
          const unit = Number(it.price_at_purchase) || 0
          const q = Number(it.quantity) || 0
          return sum + unit * q
        }, 0)
        const fullBrl = baseBrl + (Number(order.discount_amount) || 0)
        if (itemsJpySum > 0 && fullBrl > 0) {
          lineBasedJpy = Math.round(itemsJpySum * (baseBrl / fullBrl))
        }
      }
      let jpy = brlBasedJpy
      const totalUsd = Number(order?.total_amount_usd)
      let chargeUsd = null
      if (order?.order_source === 'store' && jpy > 0) {
        const jpyUsd = Number(
          exchangeSnapshot?.jpy_usd_charge ?? exchangeSnapshot?.jpy_usd
        )
        let usdBasedJpy = null
        if (Number.isFinite(jpyUsd) && jpyUsd > 0) {
          if (Number.isFinite(totalUsd) && totalUsd > 0 && baseBrl > 0) {
            const amountUsd = totalUsd
            usdBasedJpy = Math.round(amountUsd / jpyUsd)
          }
          const candidates = [brlBasedJpy, lineBasedJpy, usdBasedJpy]
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
          if (candidates.length > 0) {
            jpy = Math.max(...candidates)
          }
          chargeUsd = jpy * jpyUsd
        } else if (Number.isFinite(totalUsd) && totalUsd > 0 && baseBrl > 0) {
          chargeUsd = totalUsd
          const candidates = [brlBasedJpy, lineBasedJpy]
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
          if (candidates.length > 0) {
            jpy = Math.max(...candidates)
          }
        }
      } else if (lineBasedJpy != null && lineBasedJpy > jpy) {
        jpy = lineBasedJpy
      }
      return { jpy, approxBrl: baseBrl, chargeUsd, kind: payable.kind }
    }
    const jpy = Math.round(Number(payable.amount) || 0)
    return { jpy, approxBrl: jpy * effBrlPerJpy, chargeUsd: null, kind: payable.kind }
  }

  const parseWalletAmountJpy = (rawValue) => {
    const normalized = String(rawValue ?? '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
    const n = Number(normalized)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.floor(n)
  }

  const getPaymentBreakdown = (order, useWallet, applyMode = 'full', customAmountRaw = '') => {
    const charge = getOrderChargeJpy(order)
    const balance = wallet?.balance ?? 0
    const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
    const totalJpy = charge?.jpy ?? 0

    // Se a carteira já foi aplicada ao pedido antes, isso vem em `order.wallet_applied_amount`.
    // Usamos esse valor para evitar que o PIX continue mostrando o valor inteiro.
    const alreadyAppliedJpy = Math.max(0, Number(order?.wallet_applied_amount) || 0)
    const remainingAfterAlreadyApplied = Math.max(0, totalJpy - alreadyAppliedJpy)

    const customRequestedJpy = parseWalletAmountJpy(customAmountRaw)
    const requestedWalletJpy = applyMode === 'custom'
      ? customRequestedJpy
      : Math.floor(remainingAfterAlreadyApplied)

    // "Carteira aplicada" aqui é quanto vai ser aplicado (nesta intenção) somado ao que já foi aplicado.
    const walletAppliedAdditional = !!useWallet && canUseWallet
      ? Math.min(balance, remainingAfterAlreadyApplied, Math.max(0, requestedWalletJpy))
      : 0
    const walletApplied = alreadyAppliedJpy + walletAppliedAdditional
    let remainingJpy = Math.max(0, totalJpy - walletApplied)

    // Evita mostrar "resto" ínfimo por diferenças de conversão/precisão e frações < ¥1
    // (BRL→JPY é float; a carteira aplica inteiros — sobra poeira que o formatador arredonda a ¥1).
    const EPS_JPY = 0.0001
    if (remainingJpy <= EPS_JPY) remainingJpy = 0
    else if (remainingJpy > 0 && remainingJpy < 1) remainingJpy = 0

    const effBrlPerJpy =
      Number(exchangeSnapshot?.effective_brl_per_jpy) > 0
        ? Number(exchangeSnapshot.effective_brl_per_jpy)
        : getFxBrlPerJpy()
    const remainingBrl =
      remainingJpy > EPS_JPY ? Math.round(remainingJpy * effBrlPerJpy * 100) / 100 : 0
    return {
      charge,
      balance,
      canUseWallet,
      totalJpy,
      walletApplied,
      requestedWalletJpy: Math.max(0, requestedWalletJpy),
      remainingAfterAlreadyApplied,
      remainingJpy,
      remainingBrl,
      isFullyCovered: !!useWallet && remainingJpy <= EPS_JPY,
    }
  }

  const handlePayWithGateway = async ({ provider = null, forceWallet = false } = {}) => {
    if (!payModal.order) return
    const accessToken = session?.access_token
    if (!accessToken) {
      setFeedback(t('platform.cart.errors.loginAgain'))
      return
    }
    const orderId = payModal.order.id
    const breakdown = getPaymentBreakdown(
      payModal.order,
      payModal.useWallet,
      walletApplyMode,
      walletCustomAmount
    )
    const balanceOk = (wallet?.balance ?? 0) > 0 && (wallet?.currency || 'JPY') === 'JPY'
    const customJpy = parseWalletAmountJpy(walletCustomAmount)
    const shouldUseWallet =
      forceWallet ||
      (!!payModal.useWallet &&
        balanceOk &&
        (walletApplyMode === 'full' || customJpy > 0))
    // null = API aplica o máximo possível da carteira até cobrir o restante (valor oficial em JPY no servidor).
    const walletAmountJpyForApi =
      !shouldUseWallet
        ? null
        : forceWallet || walletApplyMode === 'full'
          ? null
          : Math.floor(Math.max(0, customJpy))
    try {
      setSubmitting(true)
      setFeedback('')
      const result = await createCheckoutSession(
        payModal.cartCheckout ? null : orderId,
        accessToken,
        {
          cartCheckout: !!payModal.cartCheckout,
          cartParams: payModal.cartCheckout
            ? {
                couponCode: couponApplied ? couponInput.trim() : null,
                shipImmediately: false,
              }
            : null,
          useWallet: shouldUseWallet,
          walletAmountJpy: walletAmountJpyForApi,
          provider: provider || null,
        }
      )
      if (result?.paid) {
        setPayModal({ open: false, order: null, useWallet: false, cartCheckout: false })
        setFeedback(t('platform.cart.payWalletSuccess'))
        setCouponApplied(null)
        setCouponInput('')
        await loadCart({ silent: true })
        await loadPendingOrders()
        await loadPayments()
        await (async () => {
          const { data: box } = await getMyCoupons(user.id)
          setMyCoupons(box ?? [])
        })()
        return
      }
      if (result?.url) {
        try {
          if (result?.debug) {
            sessionStorage.setItem('parcelow_checkout_debug_last', JSON.stringify(result.debug))
          }
        } catch {
          // noop
        }
        window.location.href = result.url
      } else setFeedback(t('platform.cart.errors.redirectPay'))
    } catch (err) {
      setFeedback(err.message || t('platform.cart.errors.processPay'))
    } finally {
      setSubmitting(false)
    }
  }

  const closePayModal = () => {
    setPayModal({ open: false, order: null, useWallet: false, cartCheckout: false })
    setFeedback('')
    const next = new URLSearchParams(searchParams)
    next.delete('payOrderId')
    next.delete('success')
    next.delete('canceled')
    setSearchParams(next, { replace: true })
  }

  const payableKindLabel = (kind) =>
    kind ? t(`platform.orders.payable.${kind}`, { defaultValue: kind }) : ''

  const historyPaymentKind = (order, orderId, paymentIdLower) => {
    if (paymentIdLower === 'referral_discount' || paymentIdLower === 'coupon_discount') return t('platform.cart.historyKind.discount')
    if (order?.order_source === 'store') return t('platform.cart.historyKind.store')
    if (Number(order?.quote_amount) > 0) return t('platform.cart.historyKind.service')
    if (Number(order?.shipping_cost) > 0) return t('platform.cart.historyKind.shipping')
    if (orderId) return t('platform.cart.historyKind.order')
    return t('platform.cart.historyKind.payment')
  }

  const historyPayMethodLabel = (raw) => {
    const paymentId = String(raw || '').trim().toLowerCase()
    if (!paymentId) return '—'
    if (paymentId.startsWith('wallet')) return t('platform.cart.payMethod.wallet')
    if (paymentId === 'referral_discount' || paymentId === 'coupon_discount') return t('platform.cart.payMethod.discount')
    if (paymentId.startsWith('parcelow')) return 'Parcelow'
    if (paymentId.includes('pix')) return 'PIX'
    if (paymentId.startsWith('pi_') || paymentId.startsWith('cs_') || paymentId.startsWith('ch_')) {
      return t('platform.cart.payMethod.card')
    }
    if (paymentId.includes('manual')) return t('platform.cart.payMethod.manual')
    return t('platform.cart.payMethod.card')
  }

  const feedbackTonePositive = (msg) => /success|sucesso/i.test(String(msg || ''))

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to={lp('login')} className="font-medium text-earth-900 underline">
            {t('platform.cart.loginLink')}
          </Link>
          {t('platform.cart.loginPromptSuffix')}
        </p>
      </div>
    )
  }

  return (
    <>
      <PageSeo
        routeKey="appCart"
        title={t('meta.appCart.title')}
        description={t('meta.appCart.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.cart.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.cart.intro')}</p>

        <div className="mt-4 inline-flex rounded-lg border border-earth-200 bg-earth-50 p-1">
          {orderedTabs.map((tabId) => {
            const tab = cartTabs.find((entry) => entry.id === tabId)
            if (!tab) return null
            return (
              <button
                key={tab.id}
                type="button"
                draggable
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  if (tab.id === 'checkout') next.delete('tab')
                  else next.set('tab', tab.id)
                  setSearchParams(next, { replace: true })
                }}
                onDragStart={(e) => {
                  setDraggingTabId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                  handleTabReorder(draggingTabId, tab.id)
                }}
                onDragEnd={() => setDraggingTabId('')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'bg-earth-900 text-white'
                    : 'text-earth-700 hover:bg-earth-100'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {feedback && !payModal.open && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedbackTonePositive(feedback) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {activeTab === 'checkout' && loading && (
          <p className="mt-6 text-earth-600">{t('platform.cart.loading')}</p>
        )}

        {activeTab === 'checkout' && !loading && items.length === 0 && (
          <p className="mt-6 text-earth-600">
            {t('platform.cart.emptyCart')}{' '}
            <Link to={lp('appLoja')} className="font-medium text-earth-900 underline">
              {t('platform.cart.shopLink')}
            </Link>
            .
          </p>
        )}

        {activeTab === 'checkout' && !loading && items.length > 0 && (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-earth-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-earth-100 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-earth-900">{t('platform.cart.cartTitle')}</h2>
                  <p className="text-sm text-earth-600">{t('platform.cart.cartSubtitle')}</p>
                </div>
                <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-semibold text-earth-700">
                  {t('platform.cart.item', { count: items.length })}
                </span>
              </div>
              <div className="space-y-4">
                {items.map((item) => {
                  const p = item.products
                  const variant = item.product_variants
                  if (!p) return null
                  const qty = Math.max(1, Number(item.quantity) || 1)
                  const jpyUnit = Number(variant?.price_jpy ?? p.price_jpy ?? p.price) || 0
                  const brlUnit = Number(p.price_brl)
                  const usdUnit = Number(p.price_usd)
                  const hasTri =
                    Number.isFinite(brlUnit) && brlUnit > 0 && Number.isFinite(usdUnit) && usdUnit > 0
                  const unitBrl = hasTri ? brlUnit : jpyToBrl(jpyUnit)
                  const unitUsd = hasTri ? usdUnit : NaN
                  const lineJpy = jpyUnit * qty
                  const lineBrl = unitBrl * qty
                  const lineUsd = hasTri ? usdUnit * qty : NaN
                  const sourceTag = p.purchase_group_id
                    ? t('platform.cart.sourceGroupBuy')
                    : t('platform.cart.sourceStore')
                  const sourceTagClass = p.purchase_group_id
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                  const stockCap = getProductStockCap(variant || p)
                  const qtyOverStock =
                    stockCap != null && stockCap > 0 && qty > stockCap
                  const lineOutOfStock = stockCap != null && stockCap <= 0
                  const itemImages = getCartItemImages(p, variant)
                  const cartImage = itemImages[0] || ''
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start gap-4 rounded-xl border border-earth-200 bg-earth-50 p-4"
                    >
                      {cartImage ? (
                        <img src={cartImage} alt={p.name} className="h-20 w-20 rounded-lg bg-white object-contain" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-earth-200 text-earth-500 text-sm">
                          {t('platform.cart.noImage')}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceTagClass}`}>
                            {sourceTag}
                          </span>
                        </div>
                        <h3 className="font-semibold text-earth-900">
                          <Link
                            to={appStoreProductPath(p.id, locale, item.variant_id ? { variantId: item.variant_id } : {})}
                            className="hover:text-earth-700 hover:underline"
                          >
                            {p.name}
                          </Link>
                        </h3>
                        {variant && (
                          <p className="text-xs text-earth-600">
                            Versão: {variant?.attributes?.versao || variant?.title || 'Padrão'}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-earth-500">
                          {t('platform.cart.unitLabel')}
                        </p>
                        <TriCurrencyDisplay
                          brl={unitBrl}
                          jpy={jpyUnit}
                          usd={unitUsd}
                          variant="compact"
                          footnote={hasTri ? null : t('platform.cart.triFootnoteRates')}
                        />
                        {lineOutOfStock && (
                          <p className="mt-2 text-sm font-medium text-amber-800">
                            {t('platform.cart.stockLineOutOfStock')}
                          </p>
                        )}
                        {qtyOverStock && (
                          <p className="mt-2 text-sm font-medium text-amber-800">
                            {t('platform.cart.stockOverNotice', { count: stockCap, qty })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={qtyDrafts[item.variant_id || item.product_id] ?? item.quantity}
                          onChange={(e) =>
                            setQtyDrafts((d) => ({ ...d, [item.variant_id || item.product_id]: e.target.value }))
                          }
                          onBlur={(e) => handleUpdateQty(item.variant_id || item.product_id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleUpdateQty(item.variant_id || item.product_id, e.currentTarget.value)
                            }
                          }}
                          className="w-16 rounded border border-earth-300 px-2 py-1 text-center text-earth-900"
                        />
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-earth-500">
                            {t('platform.cart.subtotalLine', { qty })}
                          </p>
                          <TriCurrencyDisplay brl={lineBrl} jpy={lineJpy} usd={lineUsd} variant="compact" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.variant_id || item.product_id)}
                          className="text-sm text-red-600 hover:text-red-800 sm:ml-1"
                        >
                          {t('platform.cart.remove')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="rounded-xl border border-earth-200 bg-earth-50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-sm font-medium text-earth-700">{t('platform.cart.couponLabel')}</label>
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                    placeholder={t('platform.cart.couponPlaceholder')}
                    disabled={!!couponApplied}
                    className="flex-1 min-w-0 rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400 focus:border-earth-500 focus:outline-none focus:ring-1 focus:ring-earth-500 disabled:bg-earth-100 disabled:cursor-not-allowed"
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="shrink-0 rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      {t('platform.cart.removeCoupon')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="shrink-0 rounded-lg border border-earth-300 bg-white px-4 py-2 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                    >
                      {couponLoading ? t('platform.cart.applyingDots') : t('platform.cart.apply')}
                    </button>
                  )}
                </div>
              </div>
              {myCouponsLoading ? (
                <p className="text-sm text-earth-600">{t('platform.cart.couponBoxLoading')}</p>
              ) : myCoupons.length > 0 ? (
                <div className="rounded-lg border border-earth-200 bg-white p-3">
                  <p className="text-sm font-medium text-earth-800">{t('platform.cart.couponBoxTitle')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {myCoupons.map((cp) => {
                      const usedCount = Number(cp?.used_count) || 0
                      const maxUses = cp?.max_uses != null ? Number(cp.max_uses) : null
                      const exhausted = maxUses != null && usedCount >= maxUses
                      const expired = cp?.valid_until ? new Date(cp.valid_until).getTime() < Date.now() : false
                      const disabled = exhausted || expired || !!couponApplied
                      return (
                        <button
                          key={cp.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleApplyCoupon(cp.code)}
                          className="rounded-md border border-earth-300 bg-earth-50 px-3 py-2 text-left text-sm text-earth-800 hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="block font-semibold">{cp.code}</span>
                          <span className="block text-xs text-earth-600">
                            {cp.discount_type === 'percent'
                              ? t('platform.cart.couponBoxPercent', { value: Number(cp.discount_value) || 0 })
                              : t('platform.cart.couponBoxFixed', { value: fp.brl(Number(cp.discount_value) || 0) })}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {couponApplied && (
                <p className="text-sm text-green-700 font-medium">
                  {t('platform.cart.couponApplied', {
                    code: couponApplied.code,
                    amount: fp.brl(couponApplied.discount_brl),
                  })}
                </p>
              )}
              {grupoFeeBrl > 0 && (
                <div className="rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm text-earth-700">
                  <p className="font-medium text-earth-900">{t('platform.cart.grupoFeeTitle')}</p>
                  <p className="mt-1">
                    {t('platform.cart.grupoFeeBody', {
                      percent: GRUPO_COMPRAS_FEE_PERCENT,
                      perUnit: formatUSD(GRUPO_COMPRAS_FEE_PER_UNIT_USD),
                      qty: grupoQty,
                      feeJpy: SERVICE_FEE_JPY_PER_ITEM,
                      total: fp.brl(grupoFeeBrl),
                    })}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-4 border-t border-earth-200 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm text-earth-600">
                    {t('platform.cart.composition', {
                      subtotal: fp.brl(productSubtotalBrl),
                      grupo:
                        grupoFeeBrl > 0
                          ? t('platform.cart.compositionGrupo', { amount: fp.brl(grupoFeeBrl) })
                          : '',
                      coupon:
                        discountBrl > 0
                          ? t('platform.cart.couponLine', { amount: fp.brl(discountBrl) })
                          : '',
                    })}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-earth-500">
                    {t('platform.cart.totalOrderLabel')}
                  </p>
                  <TriCurrencyDisplay
                    brl={totalAfterDiscountBrl}
                    jpy={totalJpy}
                    usd={
                      totalUsdEstimate != null && Number.isFinite(totalUsdEstimate)
                        ? totalUsdEstimate
                        : NaN
                    }
                    variant="checkout"
                    footnote={
                      totalUsdEstimate != null && Number.isFinite(totalUsdEstimate)
                        ? t('platform.cart.triFootnoteCheckout')
                        : t('platform.cart.triFootnoteCheckoutPending')
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="rounded-lg bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                >
                  {submitting ? t('platform.cart.processing') : t('platform.cart.finalizePurchase')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checkout' && <div className="mt-8">
          <h2 className="text-xl font-semibold text-earth-900">{t('platform.cart.pendingTitle')}</h2>
          <p className="mt-1 text-sm text-earth-600">{t('platform.cart.pendingSubtitle')}</p>

          {pendingLoading && (
            <p className="mt-4 text-earth-600">{t('platform.cart.pendingLoading')}</p>
          )}

          {!pendingLoading && pendingOrders.length === 0 && (
            <p className="mt-4 text-earth-600">{t('platform.cart.noPending')}</p>
          )}

          {!pendingLoading && pendingOrders.length > 0 && (
            <div className="mt-4 space-y-3">
              {pendingOrders.map((order) => {
                const payable = getPayableAmount(order)
                const charge = getOrderChargeJpy(order)
                const breakdown = getPaymentBreakdown(order, false, 'full', '')
                const pendingJpy = breakdown.remainingJpy
                const pendingBrl = breakdown.remainingBrl
                const totalJpy = breakdown.totalJpy
                const jpyUsdRate = Number(exchangeSnapshot?.jpy_usd_charge ?? exchangeSnapshot?.jpy_usd)
                const pendingUsd =
                  order?.order_source === 'store' &&
                  Number.isFinite(Number(order?.total_amount_usd)) &&
                  Number(order?.total_amount_usd) > 0 &&
                  totalJpy > 0
                    ? Number(order.total_amount_usd) * (pendingJpy / totalJpy)
                    : (Number.isFinite(jpyUsdRate) && jpyUsdRate > 0
                        ? pendingJpy * jpyUsdRate
                        : (charge?.chargeUsd != null && Number.isFinite(charge.chargeUsd) && totalJpy > 0
                            ? charge.chargeUsd * (pendingJpy / totalJpy)
                            : NaN))
                const alreadyAppliedJpy = Math.max(0, Number(order?.wallet_applied_amount) || 0)
                return (
                  <div key={order.id} className="rounded-xl border border-earth-200 bg-earth-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p>
                          <Link
                            to={lp('appLounge', `?tab=pedidos&orderId=${encodeURIComponent(order.id)}`)}
                            className="font-medium text-earth-900 underline decoration-earth-300 underline-offset-2 hover:decoration-earth-700"
                          >
                            {t('platform.cart.orderLink', { id: order.id?.slice(0, 8) })}
                          </Link>
                        </p>
                        <p className="text-xs text-earth-600">
                          {t(`platform.orders.status.${order.status}`, { defaultValue: order.status })}
                          {payable?.kind ? ` - ${payableKindLabel(payable.kind)}` : ''}
                        </p>
                        {charge && (
                          <div className="mt-2">
                            <TriCurrencyDisplay
                              brl={pendingBrl}
                              jpy={pendingJpy}
                              usd={pendingUsd}
                              variant="compact"
                            />
                            {alreadyAppliedJpy > 0 && (
                              <p className="mt-1 text-xs text-green-700">
                                {t('platform.cart.walletPreviouslyApplied', {
                                  amount: fp.jpy(alreadyAppliedJpy),
                                })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: true, order, useWallet: false, cartCheckout: false })}
                        className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
                      >
                        {t('platform.cart.payNow')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {activeTab === 'history' && (
          <div className="mt-6">
            {paymentsLoading && (
              <p className="text-earth-600">{t('platform.cart.historyLoading')}</p>
            )}
            {!paymentsLoading && payments.length === 0 && (
              <p className="text-earth-600">{t('platform.cart.historyEmpty')}</p>
            )}
            {!paymentsLoading && payments.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-earth-200">
                <div className="hidden bg-earth-100 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-4 sm:py-3 sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide sm:text-earth-600">
                  <div className="sm:col-span-3">{t('platform.cart.colDate')}</div>
                  <div className="sm:col-span-3">{t('platform.cart.colDescription')}</div>
                  <div className="sm:col-span-2">{t('platform.cart.colAmount')}</div>
                  <div className="sm:col-span-2">{t('platform.cart.colMethod')}</div>
                  <div className="sm:col-span-2">{t('platform.cart.colStatus')}</div>
                </div>
                <ul className="divide-y divide-earth-200">
                  {payments.map((p) => {
                    const order = p.orders ?? p.order
                    const orderId = order?.id ?? p.order_id
                    const serviceName = order?.service?.name ?? order?.service?.[0]?.name ?? ''
                    const rawPaymentId = String(p?.stripe_payment_id || '').trim()
                    const paymentId = rawPaymentId.toLowerCase()
                    const paymentMethod = historyPayMethodLabel(rawPaymentId)
                    const paymentKind = historyPaymentKind(order, orderId, paymentId)
                    const paymentCurrency = String(p.currency || 'JPY').toUpperCase()
                    const amount = Number(p.amount) || 0
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 bg-white px-4 py-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:py-3"
                      >
                        <div className="w-full text-earth-700 sm:col-span-3 sm:w-auto">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleString(dateLocale, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </div>
                        <div className="w-full sm:col-span-3 sm:w-auto">
                          {orderId ? (
                            <Link
                              to={lp('appLounge', `?tab=pedidos&orderId=${encodeURIComponent(orderId)}`)}
                              className="text-earth-900 underline decoration-earth-300 underline-offset-2 hover:decoration-earth-700"
                            >
                              {t('platform.cart.historyDesc', {
                                kind: paymentKind,
                                id: String(orderId).slice(0, 8),
                              })}
                            </Link>
                          ) : (
                            <span className="text-earth-900">{paymentKind}</span>
                          )}
                          {serviceName && (
                            <p className="text-sm text-earth-500">{serviceName}</p>
                          )}
                        </div>
                        <div className="w-full font-medium text-earth-900 sm:col-span-2 sm:w-auto">
                          <div>{fp.byCurrency(amount, paymentCurrency)}</div>
                          <p className="text-xs font-normal text-earth-500">
                            {paymentCurrency === 'BRL'
                              ? t('platform.cart.legacyBrl')
                              : t('platform.cart.convertedBrl', { amount: fp.brl(jpyToBrl(amount)) })}
                          </p>
                        </div>
                        <div className="w-full text-earth-600 sm:col-span-2 sm:w-auto">
                          {paymentMethod}
                        </div>
                        <div className="w-full sm:col-span-2 sm:w-auto">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : p.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-earth-100 text-earth-700'
                            }`}
                          >
                            {paymentStatusLabels[p.status] ?? p.status}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      

      {payModal.open && payModal.order &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 relative"
            style={{ position: 'fixed', inset: 0 }}
            onClick={closePayModal}
          >
          {feedback && (
            <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
              <p
                className={`rounded-lg px-4 py-2 text-sm ${
                  /error|erro/i.test(String(feedback))
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
              <h3 className="font-semibold text-earth-900">{t('platform.cart.modalTitle')}</h3>
              <p className="mt-1 text-sm text-earth-600">{t('platform.cart.modalSubtitle')}</p>

              {(() => {
                const breakdown = getPaymentBreakdown(
                  payModal.order,
                  payModal.useWallet,
                  walletApplyMode,
                  walletCustomAmount
                )
                const {
                  charge,
                  balance,
                  canUseWallet,
                  totalJpy,
                  walletApplied,
                  remainingJpy,
                  isFullyCovered,
                } = breakdown
                const useWallet = !!payModal.useWallet && canUseWallet
                const ch = getOrderChargeJpy(payModal.order)
                const jpyUsdRate = Number(exchangeSnapshot?.jpy_usd_charge ?? exchangeSnapshot?.jpy_usd)
                const storeTotalUsd = Number(payModal.order?.total_amount_usd)
                const remainingUsdParcelow =
                  payModal.order?.order_source === 'store' &&
                  Number.isFinite(storeTotalUsd) &&
                  storeTotalUsd > 0 &&
                  totalJpy > 0
                    ? storeTotalUsd * (remainingJpy / totalJpy)
                    : (Number.isFinite(jpyUsdRate) && jpyUsdRate > 0
                        ? remainingJpy * jpyUsdRate
                        : (ch?.chargeUsd != null && Number.isFinite(ch.chargeUsd) && totalJpy > 0
                            ? ch.chargeUsd * (remainingJpy / totalJpy)
                            : null))
                const remainingBrlUi =
                  remainingJpy > 0
                    ? (Number(exchangeSnapshot?.effective_brl_per_jpy) > 0
                        ? remainingJpy * Number(exchangeSnapshot.effective_brl_per_jpy)
                        : jpyToBrl(remainingJpy))
                    : 0
                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 space-y-2">
                      {charge && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-earth-600">
                              {charge.kind ? payableKindLabel(charge.kind) : t('platform.cart.subtotal')}
                            </span>
                            <span className="font-medium text-earth-900">{fp.jpy(totalJpy)}</span>
                          </div>
                          {useWallet && walletApplied > 0 && (
                            <div className="flex justify-between text-sm text-green-700">
                              <span>{t('platform.cart.modalWalletApplied')}</span>
                              <span>-{fp.jpy(walletApplied)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-earth-200 space-y-2">
                            <p className="text-sm font-medium text-earth-800">
                              {t('platform.cart.modalTotalWalletLine')}
                            </p>
                            {remainingJpy > 0 ? (
                              <TriCurrencyDisplay
                                brl={remainingBrlUi}
                                jpy={remainingJpy}
                                usd={
                                  remainingUsdParcelow != null &&
                                  Number.isFinite(remainingUsdParcelow) &&
                                  remainingUsdParcelow > 0
                                    ? remainingUsdParcelow
                                    : undefined
                                }
                                variant="modal"
                                footnote={t('platform.cart.triFootnoteCheckout')}
                              />
                            ) : (
                              <p className="text-sm font-medium text-green-800">
                                {t('platform.cart.modalTotalCoveredByWallet')}
                              </p>
                            )}
                          </div>
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
                        <p className="font-medium text-earth-900">{t('platform.cart.modalUseWallet')}</p>
                        <p className="text-sm text-earth-600">
                          {t('platform.cart.modalWalletAvailable', { amount: fp.jpy(balance) })}
                        </p>
                        {useWallet && canUseWallet && (
                          <div className="mt-3 space-y-2">
                            <label className="flex items-center gap-2 text-sm text-earth-700">
                              <input
                                type="radio"
                                name="wallet-apply-mode"
                                checked={walletApplyMode === 'full'}
                                onChange={() => setWalletApplyMode('full')}
                              />
                              <span>{t('platform.cart.modalWalletFull')}</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-earth-700">
                              <input
                                type="radio"
                                name="wallet-apply-mode"
                                checked={walletApplyMode === 'custom'}
                                onChange={() => setWalletApplyMode('custom')}
                              />
                              <span>{t('platform.cart.modalWalletCustom')}</span>
                            </label>
                            {walletApplyMode === 'custom' && (
                              <div className="mt-2">
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-earth-500">
                                  {t('platform.cart.modalWalletJpyLabel')}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={walletCustomAmount}
                                  onChange={(e) => setWalletCustomAmount(e.target.value)}
                                  placeholder={t('platform.cart.modalWalletJpyPh')}
                                  className="w-full rounded border border-earth-300 px-3 py-2 text-sm text-earth-900"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                    {!isFullyCovered && (
                    <div className="rounded-lg border border-earth-200 bg-white p-4">
                      <p className="font-medium text-earth-900">{t('platform.cart.modalPayMethod')}</p>
                      {(() => {
                        const option =
                          gatewayOptions.find((entry) => entry.id === selectedGateway) || gatewayOptions[0]
                        const methods = PAYMENT_METHODS_BY_GATEWAY[option.id] || []
                        const groups = Array.from(new Set(methods.map((method) => method.group || 'card')))
                        const visibleMethods = methods.filter((method) => (method.group || 'card') === selectedMethodGroup)
                        return (
                          <>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {gatewayOptions.map((entry) => {
                                const active = entry.id === option.id
                                return (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => setSelectedGateway(entry.id)}
                                    className={`rounded-md border px-3 py-2 text-left transition ${
                                      active
                                        ? 'border-earth-400 bg-earth-100'
                                        : 'border-earth-200 bg-white hover:bg-earth-50'
                                    }`}
                                  >
                                    <p className="text-sm font-medium text-earth-900">
                                      <span className="mr-1">{entry.icon}</span>
                                      {entry.label}
                                    </p>
                                    <p className="text-xs text-earth-600">{entry.details}</p>
                                  </button>
                                )
                              })}
                            </div>
                            <div className="mt-3 rounded-md border border-earth-100 bg-earth-50 px-3 py-2">
                              <p className="text-sm font-medium text-earth-900">
                                <span className="mr-1">{option.icon}</span>
                                {option.label}
                              </p>
                              <p className="text-xs text-earth-600">{option.details}</p>
                              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-earth-500">
                                {t('platform.cart.modalAccepted')}
                              </p>
                              {groups.length > 1 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {groups.map((group) => {
                                    const activeGroup = group === selectedMethodGroup
                                    return (
                                      <button
                                        key={group}
                                        type="button"
                                        onClick={() => setSelectedMethodGroup(group)}
                                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                          activeGroup
                                            ? 'border-earth-400 bg-earth-200 text-earth-900'
                                            : 'border-earth-200 bg-white text-earth-600 hover:bg-earth-100'
                                        }`}
                                      >
                                        {methodGroupLabels[group] || group}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {visibleMethods.map((method) =>
                                  method.layout === 'strip' ? (
                                    <div key={method.id} className="w-full rounded-md border border-earth-200 bg-white px-2 py-2 sm:px-4">
                                      <img
                                        src={method.src}
                                        alt={t('platform.cart.cardBadgeAlt', { label: method.label })}
                                        className="h-auto w-full max-h-32 object-contain object-left sm:max-h-40 md:max-h-44"
                                        loading="lazy"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none'
                                        }}
                                      />
                                      <p className="mt-1 text-xs font-medium text-earth-700">{method.label}</p>
                                    </div>
                                  ) : (
                                    <div
                                      key={method.id}
                                      className="inline-flex items-center gap-2 rounded-md border border-earth-200 bg-white px-2 py-1"
                                    >
                                      <img
                                        src={method.src}
                                        alt={t('platform.cart.cardBadgeAlt', { label: method.label })}
                                        className="h-7 w-auto max-w-[10rem] rounded object-contain object-left"
                                        loading="lazy"
                                        onError={(ev) => {
                                          if (method.fallbackSrc && ev.currentTarget.src !== method.fallbackSrc) {
                                            ev.currentTarget.src = method.fallbackSrc
                                          }
                                        }}
                                      />
                                      <span className="text-xs font-medium text-earth-700">{method.label}</span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="shrink-0 border-t border-earth-200 bg-earth-50 p-4">
              {(() => {
                const { isFullyCovered } = getPaymentBreakdown(
                  payModal.order,
                  payModal.useWallet,
                  walletApplyMode,
                  walletCustomAmount
                )
                const customWalletInvalid =
                  !!payModal.useWallet &&
                  walletApplyMode === 'custom' &&
                  parseWalletAmountJpy(walletCustomAmount) <= 0 &&
                  (wallet?.balance ?? 0) > 0

                return (
                  <div className="flex flex-col gap-3">
                    {!isFullyCovered && (
                      <p className="text-xs text-earth-500">{t('platform.cart.modalParcelowHint')}</p>
                    )}
                    {customWalletInvalid && (
                      <p className="text-xs text-amber-700">{t('platform.cart.modalWalletCustomError')}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handlePayWithGateway({
                            provider: selectedGateway,
                            forceWallet: isFullyCovered,
                          })
                        }
                        disabled={submitting || customWalletInvalid}
                        className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {submitting
                          ? t('platform.cart.processing')
                          : isFullyCovered
                            ? t('platform.cart.modalCompleteWallet')
                            : t('platform.cart.modalPaySelected')}
                      </button>
                      <button
                        type="button"
                        onClick={closePayModal}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                      >
                        {t('platform.cart.modalClose')}
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
