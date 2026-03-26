/**
 * Resumo da conta - Visão geral com informações concretas.
 * Mostra pedidos recentes, carteira, pagamentos e lista de desejos sem sair da página.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMyOrders } from '../../services/orderService'
import { getWallet } from '../../services/walletService'
import { getWishlistLinks } from '../../services/wishlistLinkService'
import { getMyNotifications, markNotificationRead } from '../../services/notificationService'
import { getMyInventory, getMyShipments } from '../../services/inventoryService'
import { SHIPPING_ADDRESS_JAPAN } from '../../data/legalConfig'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

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
}

function formatMoney(value, currency = 'BRL') {
  return Number(value)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
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
      {copied ? 'Copiado!' : 'Copiar endereço'}
    </button>
  )
}

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [wishlist, setWishlist] = useState([])
  const [receivedCount, setReceivedCount] = useState(0)
  const [requestedCount, setRequestedCount] = useState(0)
  const [notifications, setNotifications] = useState([])
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
        setReceivedCount(Number(cached.receivedCount) || 0)
        setRequestedCount(Number(cached.requestedCount) || 0)
        setLoading(false)
      }
      try {
        const [ordersRes, walletRes, wishlistLinksRes, inventoryRes, shipmentsRes] = await Promise.all([
          getMyOrders(user.id),
          getWallet(user.id),
          getWishlistLinks(user.id),
          getMyInventory(user.id, { limit: 200, offset: 0 }),
          getMyShipments(user.id, { limit: 200, offset: 0 }),
        ])
        if (!isActive) return
        setOrders(ordersRes.data ?? [])
        setWallet(walletRes.data ?? null)
        setWishlist(wishlistLinksRes.data ?? [])
        setReceivedCount((inventoryRes.data ?? []).length)
        setRequestedCount((shipmentsRes.data ?? []).length)
        writeCache(k, {
          orders: ordersRes.data ?? [],
          wallet: walletRes.data ?? null,
          wishlist: wishlistLinksRes.data ?? [],
          receivedCount: (inventoryRes.data ?? []).length,
          requestedCount: (shipmentsRes.data ?? []).length,
        })
      } catch {
        if (isActive) {
          setOrders([])
          setWallet(null)
          setWishlist([])
          setReceivedCount(0)
          setRequestedCount(0)
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

  const name = profile?.name?.trim() || user?.email?.split('@')[0] || 'usuário'
  const accountCode = profile?.account_code ?? ''
  const recipientLine = accountCode ? `${name} - ${accountCode}` : name
  const balance = wallet?.balance ?? 0
  const currency = wallet?.currency ?? 'BRL'
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
      <Helmet>
        <title>Resumo da conta | Plataforma</title>
      </Helmet>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-earth-900">Resumo da conta</h1>
          <button
            type="button"
            onClick={() => setShowCustomizer((v) => !v)}
            className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
          >
            {showCustomizer ? 'Fechar personalização' : 'Personalizar dashboard'}
          </button>
        </div>
        <p className="mt-2 text-earth-600">
          Olá, {name}. Resumo da sua conta abaixo.
        </p>

        {showCustomizer && (
          <section className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-700">O que mostrar</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-earth-800">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showNotifications}
                  onChange={(e) => updateDashboardPref('showNotifications', e.target.checked)}
                  className="rounded border-earth-300"
                />
                Notificações
              </label>
              <label className="flex items-center gap-2 text-sm text-earth-800">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showAddress}
                  onChange={(e) => updateDashboardPref('showAddress', e.target.checked)}
                  className="rounded border-earth-300"
                />
                Endereço de envio no Japão
              </label>
              <label className="flex items-center gap-2 text-sm text-earth-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={dashboardPrefs.showAccountCards}
                  onChange={(e) => updateDashboardPref('showAccountCards', e.target.checked)}
                  className="rounded border-earth-300"
                />
                Cards rápidos da conta
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
                    Card Minha conta
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardShipments}
                      onChange={(e) => updateDashboardPref('showCardShipments', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    Card Envios
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardWallet}
                      onChange={(e) => updateDashboardPref('showCardWallet', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    Card Carteira
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardOrders}
                      onChange={(e) => updateDashboardPref('showCardOrders', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    Card Pedidos
                  </label>
                  <label className="flex items-center gap-2 text-sm text-earth-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={dashboardPrefs.showCardWishlist}
                      onChange={(e) => updateDashboardPref('showCardWishlist', e.target.checked)}
                      className="rounded border-earth-300"
                    />
                    Card Lista de desejos
                  </label>
                </>
              )}
            </div>
          </section>
        )}

        {loading && (
          <p className="mt-6 text-earth-600">Carregando...</p>
        )}

        {!loading && (
          <div className="mt-6 space-y-8">
            {/* Notificações */}
            {dashboardPrefs.showNotifications && <section className="rounded-xl border border-earth-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-earth-900">Notificações</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-earth-700">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden />
                    {unreadCount} nova(s)
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-earth-600">
                Você receberá uma notificação quando seu pedido mudar de status.
              </p>

              {notifsLoading && (
                <p className="mt-4 text-sm text-earth-600">Carregando notificações...</p>
              )}

              {!notifsLoading && notifications.length === 0 && (
                <p className="mt-4 text-sm text-earth-600">Nenhuma notificação ainda.</p>
              )}

              {!notifsLoading && notifications.length > 0 && (
                <div
                  className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-2"
                  aria-label="Lista de notificações"
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
                          if (orderId) window.location.href = '/app/orders'
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
                            {n.created_at ? new Date(n.created_at).toLocaleString('pt-BR') : ''}
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
                to="/app/conta"
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title="Minha conta"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block truncate font-medium text-earth-900">{name}</span>
                  <span className="block truncate text-earth-500">{accountCode ? `Conta · ${accountCode}` : 'Conta'}</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardShipments && <Link
                to="/app/lounge?tab=envios"
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title="Envios"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">Recebidos: {receivedCount}</span>
                  <span className="block text-earth-500">Solicitados: {requestedCount}</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardWallet && <Link
                to="/app/wallet"
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title="Carteira"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">{formatMoney(balance, currency)}</span>
                  <span className="block text-earth-500">Carteira</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardOrders && <Link
                to="/app/orders"
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title="Pedidos"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">{orders.length} pedido(s)</span>
                  <span className="block text-earth-500">Pedidos</span>
                </span>
              </Link>}
              {dashboardPrefs.showCardWishlist && <Link
                to="/app/lista-desejos"
                className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 text-left transition hover:bg-earth-50"
                title="Lista de desejos"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-100 text-earth-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium text-earth-900">{wishlist.length} item(ns)</span>
                  <span className="block text-earth-500">Lista de desejos</span>
                </span>
              </Link>}
            </section>}

            {/* Endereço para envio dos seus pedidos */}
            {dashboardPrefs.showAddress && <section className="rounded-xl border border-earth-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-earth-900">Nosso endereço para envio dos seus pedidos</h2>
              <p className="mt-1 text-sm text-earth-600">
                Use este endereço nas lojas japonesas (Amazon, Rakuten, Mercari, etc.) como destino de entrega. O <strong>destinatário</strong> deve ser seu nome e código (abaixo). Os pacotes chegam até nós e consolidamos antes de enviar para você.
              </p>
              <address className="mt-4 rounded-lg border border-earth-100 bg-earth-50 p-4 font-normal not-italic text-earth-800">
                <p className="font-semibold text-earth-900">
                  <span className="text-earth-500 font-normal">Destinatário:</span> {recipientLine}
                </p>
                <p className="text-earth-600">
                  <span className="text-earth-500">Empresa:</span> {SHIPPING_ADDRESS_JAPAN.company}
                </p>
                <p>
                  <span className="text-earth-500">Código postal:</span> {SHIPPING_ADDRESS_JAPAN.postalCode}
                </p>
                {SHIPPING_ADDRESS_JAPAN.prefecture && (
                  <p>
                    <span className="text-earth-500">Prefectura:</span> {SHIPPING_ADDRESS_JAPAN.prefecture}
                  </p>
                )}
                <p>
                  <span className="text-earth-500">Cidade:</span> {SHIPPING_ADDRESS_JAPAN.city}
                </p>
                <p>
                  <span className="text-earth-500">Endereço (linha 1):</span> {SHIPPING_ADDRESS_JAPAN.line1}
                </p>
                {SHIPPING_ADDRESS_JAPAN.line2 && (
                  <p>
                    <span className="text-earth-500">Complemento (linha 2):</span> {SHIPPING_ADDRESS_JAPAN.line2}
                  </p>
                )}
                <p>
                  <span className="text-earth-500">País:</span> {SHIPPING_ADDRESS_JAPAN.country}
                </p>
              </address>
              <CopyAddressButton address={addressForUser} />
            </section>}
          </div>
        )}
      </div>
    </>
  )
}
