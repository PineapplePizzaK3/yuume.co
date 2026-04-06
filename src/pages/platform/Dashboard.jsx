/**
 * Resumo da conta - Visão geral com informações concretas.
 * Mostra pedidos recentes, carteira, pagamentos e lista de desejos sem sair da página.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { LOCALE_EN } from '../../lib/localeRoutes'
import { getMyOrders } from '../../services/orderService'
import { getWallet } from '../../services/walletService'
import { getWishlistLinks } from '../../services/wishlistLinkService'
import { getMyNotifications, markNotificationRead } from '../../services/notificationService'
import { getMyInventoryCount, getMyShipments } from '../../services/inventoryService'
import { SHIPPING_ADDRESS_JAPAN } from '../../data/legalConfig'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { getMyReferralOverview } from '../../services/referralService'
import { getSystemSettings } from '../../services/settingsService'
import { brlToJpy } from '../../lib/fx'
import { useFormatPrice } from '../../hooks/useFormatPrice'

/** Mesmos status da aba "Envios em processo" em Lounge → Envios. */
const SHIPMENT_IN_PROCESS_STATUSES = ['requested', 'awaiting_payment', 'paid', 'shipped']

const DASHBOARD_PREFS_KEY = 'dashboard_prefs_v1'
const DEFAULT_DASHBOARD_PREFS = {
  showNotifications: true,
  showAccountCards: true,
  showAddress: true,
  showCardAccount: true,
  showCardShipments: true,
  showCardWallet: true,
  showCardOrders: true,
  showCardWishlist: true,
  showCardMyProducts: true,
}

function formatMoney(value, currency = 'BRL', numberLocale = 'pt-BR') {
  return Number(value)?.toLocaleString(numberLocale, { style: 'currency', currency }) ?? '—'
}

function readDashboardPrefs(userId) {
  if (!userId) return DEFAULT_DASHBOARD_PREFS
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return DEFAULT_DASHBOARD_PREFS
    const all = JSON.parse(raw)
    const userPrefs = all?.[userId] ?? {}
    return { ...DEFAULT_DASHBOARD_PREFS, ...userPrefs }
  } catch {
    return DEFAULT_DASHBOARD_PREFS
  }
}

function writeDashboardPrefs(userId, prefs) {
  if (!userId) return
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = prefs
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(all))
  } catch {
    // noop
  }
}

function CopyAddressButton({ address }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const fullText = [
    address.recipient,
    address.company,
    address.postalCode,
    address.prefecture,
    address.city,
    address.line1,
    address.line2,
    address.country,
  ]
    .filter(Boolean)
    .join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-3 rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50"
    >
      {copied ? t('platform.dashboard.copyDone') : t('platform.dashboard.copyAddress')}
    </button>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const siteLocale = useSiteLocale()
  const fp = useFormatPrice()
  const dateLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'
  const { user, profile } = useAuth()
  const lp = useLocalizedPath()
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [wishlist, setWishlist] = useState([])
  const [deliveredAtHomeCount, setDeliveredAtHomeCount] = useState(0)
  const [shipmentsInProcessCount, setShipmentsInProcessCount] = useState(0)
  const [inventoryCount, setInventoryCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [referral, setReferral] = useState({
    code: null,
    referrals: [],
    credits: 0,
    stats: { total: 0, awaitingReferrerCredit: 0, rewarded: 0 },
  })
  const [referralRewards, setReferralRewards] = useState({ discountBrl: 0, creditBrl: 0 })
  const [referralLoadError, setReferralLoadError] = useState('')
  const [referralRefreshing, setReferralRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifsLoading, setNotifsLoading] = useState(true)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [dashboardPrefs, setDashboardPrefs] = useState(DEFAULT_DASHBOARD_PREFS)

  useEffect(() => {
    setDashboardPrefs(readDashboardPrefs(user?.id))
  }, [user?.id])

  const updateDashboardPref = (key, value) => {
    setDashboardPrefs((prev) => {
      const next = { ...prev, [key]: !!value }
      writeDashboardPrefs(user?.id, next)
      return next
    })
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      // Cache: mostra dados instantaneamente e atualiza em background.
      const k = cacheKey(user.id, 'dashboard_v1')
      const cached = readCache(k, 1000 * 60 * 30) // 30 min
      if (cached && isActive) {
        setOrders(cached.orders ?? [])
        setWallet(cached.wallet ?? null)
        setWishlist(cached.wishlist ?? [])
        setDeliveredAtHomeCount(Number(cached.deliveredAtHomeCount) || 0)
        setShipmentsInProcessCount(Number(cached.shipmentsInProcessCount) || 0)
        setInventoryCount(Number(cached.inventoryCount) || 0)
        setLoading(false)
      }
      try {
        const [ordersRes, walletRes, wishlistLinksRes, deliveredRes, inProcessRes, inventoryRes] = await Promise.all([
          getMyOrders(user.id),
          getWallet(user.id),
          getWishlistLinks(user.id),
          getMyShipments(user.id, { limit: 200, offset: 0, statusIn: ['completed'] }),
          getMyShipments(user.id, { limit: 200, offset: 0, statusIn: SHIPMENT_IN_PROCESS_STATUSES }),
          getMyInventoryCount(user.id),
        ])
        if (!isActive) return
        setOrders(ordersRes.data ?? [])
        setWallet(walletRes.data ?? null)
        setWishlist(wishlistLinksRes.data ?? [])
        const deliveredN = (deliveredRes.data ?? []).length
        const processN = (inProcessRes.data ?? []).length
        const inventoryN = Number(inventoryRes.data) || 0
        setDeliveredAtHomeCount(deliveredN)
        setShipmentsInProcessCount(processN)
        setInventoryCount(inventoryN)
        writeCache(k, {
          orders: ordersRes.data ?? [],
          wallet: walletRes.data ?? null,
          wishlist: wishlistLinksRes.data ?? [],
          deliveredAtHomeCount: deliveredN,
          shipmentsInProcessCount: processN,
          inventoryCount: inventoryN,
        })
      } catch {
        if (isActive) {
          setOrders([])
          setWallet(null)
          setWishlist([])
          setDeliveredAtHomeCount(0)
          setShipmentsInProcessCount(0)
          setInventoryCount(0)
        }
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      const [overviewRes, settingsRes] = await Promise.all([
        getMyReferralOverview(user.id),
        getSystemSettings(),
      ])
      if (!isActive) return
      if (overviewRes.data) setReferral(overviewRes.data)
      setReferralLoadError(overviewRes.error?.message || '')
      const s = settingsRes.data || {}
      setReferralRewards({
        discountBrl: Math.max(0, Number(s?.referral_discount_value?.amount) || 0),
        creditBrl: Math.max(0, Number(s?.referral_credit_value?.amount) || 0),
      })
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  const refreshReferralCode = async () => {
    if (!user?.id) return
    setReferralRefreshing(true)
    try {
      const { data: overviewData, error: overviewError } = await getMyReferralOverview(user.id)
      if (overviewData) setReferral(overviewData)
      setReferralLoadError(overviewError?.message || '')
    } finally {
      setReferralRefreshing(false)
    }
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (!user?.id) {
        if (isActive) setNotifsLoading(false)
        return
      }
      const k = cacheKey(user.id, 'notifications_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setNotifications(Array.isArray(cached) ? cached : [])
        setNotifsLoading(false)
      }
      if (isActive) setNotifsLoading(true)
      try {
        const { data } = await getMyNotifications(user.id, 20)
        if (!isActive) return
        setNotifications(data ?? [])
        writeCache(k, data ?? [])
      } finally {
        if (isActive) setNotifsLoading(false)
      }
    }
    run()
    const interval = setInterval(run, 30000)
    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [user?.id])

  const name = profile?.name?.trim() || user?.email?.split('@')[0] || t('platform.dashboard.userFallback')
  const accountCode = profile?.account_code ?? ''
  const recipientLine = accountCode ? `${name} - ${accountCode}` : name
  const balance = wallet?.balance ?? 0
  const currency = wallet?.currency ?? 'JPY'
  const referralDiscountJpy = Math.round(brlToJpy(referralRewards.discountBrl || 0))
  const referralCreditJpy = Math.round(brlToJpy(referralRewards.creditBrl || 0))
  const referralCreditsJpy = Math.round(brlToJpy(referral.credits || 0))
  const unreadCount = notifications.filter((n) => !n.read_at).length
  const addressForUser = {
    recipient: recipientLine,
    company: SHIPPING_ADDRESS_JAPAN.company,
    line1: SHIPPING_ADDRESS_JAPAN.line1,
    line2: SHIPPING_ADDRESS_JAPAN.line2,
    city: SHIPPING_ADDRESS_JAPAN.city,
    prefecture: SHIPPING_ADDRESS_JAPAN.prefecture,
    postalCode: SHIPPING_ADDRESS_JAPAN.postalCode,
    country: SHIPPING_ADDRESS_JAPAN.country,
  }

  return (
    <>
      <PageSeo
        routeKey="appDashboard"
        title={t('meta.appDashboard.title')}
        description={t('meta.appDashboard.description')}
        noindex
      />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-earth-900">{t('platform.dashboard.pageTitle')}</h1>
          <button
            type="button"
            onClick={() => setShowCustomizer((v) => !v)}
            className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
          >
            {showCustomizer ? t('platform.dashboard.customizeClose') : t('platform.dashboard.customizeOpen')}
          </button>
        </div>
        <p className="mt-2 text-earth-600">
          {t('platform.dashboard.greeting', { name })}
        </p>

        {showCustomizer && (
          <section className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-700">{t('platform.dashboard.whatToShow')}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-earth-800">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showNotifications}
                  onChange={(e) => updateDashboardPref('showNotifications', e.target.checked)}
                  className="rounded border-earth-300"
                />
                {t('platform.dashboard.chkNotifications')}
              </label>
              <label className="flex items-center gap-2 text-sm text-earth-800">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showAddress}
                  onChange={(e) => updateDashboardPref('showAddress', e.target.checked)}
                  className="rounded border-earth-300"
                />
                {t('platform.dashboard.chkJapanAddress')}
              </label>
              <label className="flex items-center gap-2 text-sm text-earth-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showAccountCards}
                  onChange={(e) => updateDashboardPref('showAccountCards', e.target.checked)}
                  className="rounded border-earth-300"
                />
                {t('platform.dashboard.chkQuickCards')}
              </label>
              {dashboardPrefs.showAccountCards && (
                <>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardAccount}
                      onChange={(e) => updateDashboardPref('showCardAccount', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardAccount')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardShipments}
                      onChange={(e) => updateDashboardPref('showCardShipments', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardShipments')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardWallet}
                      onChange={(e) => updateDashboardPref('showCardWallet', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardWallet')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardOrders}
                      onChange={(e) => updateDashboardPref('showCardOrders', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardOrders')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardWishlist}
                      onChange={(e) => updateDashboardPref('showCardWishlist', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardWishlist')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardMyProducts}
                      onChange={(e) => updateDashboardPref('showCardMyProducts', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    {t('platform.dashboard.chkCardMyProducts')}
                  </label>
                </>
              )}
            </div>
          </section>
        )}

        {loading && (
          <p className="mt-6 text-earth-600">{t('platform.dashboard.loading')}</p>
        )}

        {!loading && (
          <div className="mt-6 space-y-8">
            {/* Notificações */}
            {dashboardPrefs.showNotifications && <section className="rounded-xl border border-earth-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-earth-900">{t('platform.dashboard.notifTitle')}</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-earth-700">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden />
                    {t('platform.dashboard.notifNew', { count: unreadCount })}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-earth-600">
                {t('platform.dashboard.notifHint')}
              </p>

              {notifsLoading && (
                <p className="mt-4 text-sm text-earth-600">{t('platform.dashboard.notifLoading')}</p>
              )}

              {!notifsLoading && notifications.length === 0 && (
                <p className="mt-4 text-sm text-earth-600">{t('platform.dashboard.notifEmpty')}</p>
              )}

              {!notifsLoading && notifications.length > 0 && (
                <div
                  className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-2"
                  aria-label={t('platform.dashboard.notifListAria')}
                >
                  {notifications.map((n) => {
                    const isUnread = !n.read_at
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onMouseEnter={async () => {
                          if (isUnread) {
                            await markNotificationRead(n.id)
                            setNotifications((prev) =>
                              prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
                            )
                          }
                        }}
                        onClick={async () => {
                          if (isUnread) {
                            await markNotificationRead(n.id)
                            setNotifications((prev) =>
                              prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
                            )
                          }
                          const orderId = n.meta?.order_id
                          if (orderId) {
                            navigate(lp('appLounge', `?tab=pedidos&orderId=${encodeURIComponent(orderId)}`))
                          }
                        }}
                        className="w-full rounded-lg border border-earth-200 bg-earth-50 p-3 text-left hover:bg-earth-100"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium text-earth-900">
                              {isUnread && <span className="inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden />}
                              <span className="truncate">{n.title}</span>
                            </p>
                            {n.body && <p className="mt-1 text-sm text-earth-600">{n.body}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-earth-500">
                            {n.created_at ? new Date(n.created_at).toLocaleString(dateLocale) : ''}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>}

            {/* Informações da conta – ícones pequenos */}
            {dashboardPrefs.showAccountCards && <section className="flex flex-wrap gap-3">
              {dashboardPrefs.showCardAccount && <Link
                to={lp('appConta')}
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title={t('platform.dashboard.cardAccountTitle')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block truncate font-medium text-earth-900">{name}</span>
                  <span className="block truncate text-earth-500">
                    {accountCode ? t('platform.dashboard.accountWithCode', { code: accountCode }) : t('platform.dashboard.accountShort')}
                  </span>
                </span>
              </Link>}
              {dashboardPrefs.showCardShipments && (
                <>
                  <Link
                    to={lp('appLounge', '?tab=envios')}
                    className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                    title={t('platform.dashboard.cardShipmentsProcessTitle')}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                        />
                      </svg>
                    </span>
                    <span className="min-w-0 text-xs">
                      <span className="block font-medium text-earth-900">
                        {t('platform.dashboard.inProcessCount', { count: shipmentsInProcessCount })}
                      </span>
                      <span className="block text-earth-500">{t('platform.dashboard.inProcessSub')}</span>
                    </span>
                  </Link>
                  <Link
                    to={lp('appLounge', '?tab=envios&envSub=recebidos')}
                    className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                    title={t('platform.dashboard.cardShipmentsDeliveredTitle')}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                    </span>
                    <span className="min-w-0 text-xs">
                      <span className="block font-medium text-earth-900">
                        {t('platform.dashboard.deliveredCount', { count: deliveredAtHomeCount })}
                      </span>
                      <span className="block text-earth-500">{t('platform.dashboard.deliveredSub')}</span>
                    </span>
                  </Link>
                </>
              )}
              {dashboardPrefs.showCardWallet && <Link
                to={lp('appLounge')}
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title={t('platform.dashboard.cardWalletTitle')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">{formatMoney(balance, currency, dateLocale)}</span>
                  <span className="block text-earth-500">{t('platform.dashboard.walletLabel')}</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardOrders && <Link
                to={lp('appLounge', '?tab=pedidos')}
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title={t('platform.dashboard.cardOrdersTitle')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">
                    {t('platform.dashboard.ordersCount', { count: orders.length })}
                  </span>
                  <span className="block text-earth-500">{t('platform.dashboard.ordersLabel')}</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardWishlist && <Link
                to={lp('appLounge', '?tab=desejos')}
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title={t('platform.dashboard.cardWishlistTitle')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">
                    {t('platform.dashboard.wishlistCount', { count: wishlist.length })}
                  </span>
                  <span className="block text-earth-500">{t('platform.dashboard.wishlistLabel')}</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardMyProducts && <Link
                to={lp('appLounge')}
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title={t('platform.dashboard.cardProductsTitle')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">
                    {t('platform.dashboard.inventoryCount', { count: inventoryCount })}
                  </span>
                  <span className="block text-earth-500">{t('platform.dashboard.productsLabel')}</span>
                </span>
              </Link>}
            </section>}

            {/* Endereço para envio dos seus pedidos */}
            {dashboardPrefs.showAddress && <section className="rounded-xl border border-earth-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.dashboard.addressTitle')}</h2>
              <p className="mt-1 text-sm text-earth-600">
                {t('platform.dashboard.addressIntro')}
              </p>
              <address className="mt-4 rounded-lg border border-earth-100 bg-earth-50 p-4 font-normal not-italic text-earth-800">
                <p className="font-semibold text-earth-900">
                  <span className="text-earth-500 font-normal">{t('platform.dashboard.labelRecipient')}</span> {recipientLine}
                </p>
                <p className="text-earth-600">
                  <span className="text-earth-500">{t('platform.dashboard.labelCompany')}</span> {SHIPPING_ADDRESS_JAPAN.company}
                </p>
                <p>
                  <span className="text-earth-500">{t('platform.dashboard.labelPostal')}</span> {SHIPPING_ADDRESS_JAPAN.postalCode}
                </p>
                {SHIPPING_ADDRESS_JAPAN.prefecture && (
                  <p>
                    <span className="text-earth-500">{t('platform.dashboard.labelPrefecture')}</span> {SHIPPING_ADDRESS_JAPAN.prefecture}
                  </p>
                )}
                <p>
                  <span className="text-earth-500">{t('platform.dashboard.labelCity')}</span> {SHIPPING_ADDRESS_JAPAN.city}
                </p>
                <p>
                  <span className="text-earth-500">{t('platform.dashboard.labelLine1')}</span> {SHIPPING_ADDRESS_JAPAN.line1}
                </p>
                {SHIPPING_ADDRESS_JAPAN.line2 && (
                  <p>
                    <span className="text-earth-500">{t('platform.dashboard.labelLine2')}</span> {SHIPPING_ADDRESS_JAPAN.line2}
                  </p>
                )}
                <p>
                  <span className="text-earth-500">{t('platform.dashboard.labelCountry')}</span> {SHIPPING_ADDRESS_JAPAN.country}
                </p>
              </address>
              <CopyAddressButton address={addressForUser} />
            </section>}

            <section id="referral-section" className="rounded-xl border border-green-200 bg-green-50 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.dashboard.referralTitle')}</h2>
              {referralLoadError && (
                <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-xs text-amber-800">
                  {referralLoadError}
                </p>
              )}
              <p className="mt-2 text-sm text-earth-800">
                <strong>{t('platform.dashboard.referralThemStrong')}</strong>
                {t('platform.dashboard.referralThemBody', { amount: fp.jpy(referralDiscountJpy) })}
              </p>
              <p className="mt-2 text-sm text-earth-800">
                <strong>{t('platform.dashboard.referralYouStrong')}</strong>
                {t('platform.dashboard.referralYouBody', { amount: fp.jpy(referralCreditJpy) })}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded bg-white px-3 py-1.5 text-sm font-semibold text-earth-900 border border-green-200">
                  {t('platform.dashboard.yourCode', { code: referral.code || '—' })}
                </span>
                <button
                  type="button"
                  onClick={refreshReferralCode}
                  disabled={referralRefreshing}
                  className="rounded border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-70"
                >
                  {referralRefreshing ? t('platform.dashboard.referralGenLoading') : t('platform.dashboard.referralGenAgain')}
                </button>
                {referral.code && (
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}${lp('register')}?invite=${referral.code}`
                      )
                    }
                    className="rounded border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                  >
                    {t('platform.dashboard.referralCopySignup')}
                  </button>
                )}
              </div>
              <p className="mt-3 text-sm text-earth-700">
                {t('platform.dashboard.referralWalletLine', { amount: fp.jpy(referralCreditsJpy) })}
              </p>
              <p className="mt-1 text-xs text-earth-600">
                {t('platform.dashboard.referralStats', {
                  total: referral.stats?.total || 0,
                  awaiting: referral.stats?.awaitingReferrerCredit ?? 0,
                  rewarded: referral.stats?.rewarded || 0,
                })}
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
