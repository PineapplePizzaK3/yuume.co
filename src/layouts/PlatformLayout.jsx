/**
 * PlatformLayout - Layout for authenticated platform pages.
 * Sidebar navigation with grouped items: Minha Conta, Loja.
 */
import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCartCount } from '../hooks/useCartCount'

const LOJA_ITEMS = [
  { to: '/app/services', label: 'Serviços' },
  { to: '/app/grupo-de-compras', label: 'Grupo de Compras' },
  { to: '/app/loja', label: 'Loja Virtual' },
]

const MINHA_CONTA_ITEMS = [
  { to: '/app/lounge', label: '⭐ Lounge' },
  { to: '/app/conta', label: 'Dados da conta' },
  { to: '/app/cart', label: '🛒 Central de Pagamentos' },
]

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Resumo da Conta' },
]

const MENU_ORDER_STORAGE_KEY = 'platform_menu_order_v1'
const DEFAULT_MENU_ORDER = {
  nav: NAV_ITEMS.map((i) => i.to),
  conta: MINHA_CONTA_ITEMS.map((i) => i.to),
  loja: LOJA_ITEMS.map((i) => i.to),
}

function normalizeSectionOrder(value, allowed) {
  const raw = Array.isArray(value) ? value : []
  const safe = raw.filter((to) => allowed.includes(to))
  for (const to of allowed) {
    if (!safe.includes(to)) safe.push(to)
  }
  return safe
}

function normalizeMenuOrder(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  return {
    nav: normalizeSectionOrder(value.nav, DEFAULT_MENU_ORDER.nav),
    conta: normalizeSectionOrder(value.conta, DEFAULT_MENU_ORDER.conta),
    loja: normalizeSectionOrder(value.loja, DEFAULT_MENU_ORDER.loja),
  }
}

function readMenuOrder(userId) {
  if (!userId) return DEFAULT_MENU_ORDER
  try {
    const raw = localStorage.getItem(MENU_ORDER_STORAGE_KEY)
    if (!raw) return DEFAULT_MENU_ORDER
    const all = JSON.parse(raw)
    return normalizeMenuOrder(all?.[userId])
  } catch {
    return DEFAULT_MENU_ORDER
  }
}

function writeMenuOrder(userId, menuOrder) {
  if (!userId) return
  try {
    const raw = localStorage.getItem(MENU_ORDER_STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = normalizeMenuOrder(menuOrder)
    localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

export function PlatformLayout() {
  const { user, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const cartCount = useCartCount(user?.id)
  const hasCartItems = cartCount > 0
  const cartBadgeLabel = cartCount > 99 ? '99+' : String(cartCount)
  const [lojaOpen, setLojaOpen] = useState(true)
  const [contaOpen, setContaOpen] = useState(true)
  const [menuOrder, setMenuOrder] = useState(DEFAULT_MENU_ORDER)
  const [draggingItem, setDraggingItem] = useState(null)
  // Banner é descartado apenas durante a sessão logada atual.
  // Ao sair e entrar novamente, ele reaparece.
  const [referralBannerDismissed, setReferralBannerDismissed] = useState(false)

  const dismissReferralBanner = () => {
    setReferralBannerDismissed(true)
  }

  const isActive = (path) => {
    return location.pathname === path
  }
  const isInLoja = LOJA_ITEMS.some((i) => i.to === location.pathname)
  const isInConta =
    MINHA_CONTA_ITEMS.some((i) => i.to === location.pathname)

  const orderedNavItems = menuOrder.nav
    .map((to) => NAV_ITEMS.find((i) => i.to === to))
    .filter(Boolean)
  const orderedContaItems = menuOrder.conta
    .map((to) => MINHA_CONTA_ITEMS.find((i) => i.to === to))
    .filter(Boolean)
  const orderedLojaItems = menuOrder.loja
    .map((to) => LOJA_ITEMS.find((i) => i.to === to))
    .filter(Boolean)

  useEffect(() => {
    if (isInLoja) setLojaOpen(true)
  }, [isInLoja])
  useEffect(() => {
    if (isInConta) setContaOpen(true)
  }, [isInConta])

  useEffect(() => {
    setMenuOrder(readMenuOrder(user?.id))
  }, [user?.id])

  useEffect(() => {
    writeMenuOrder(user?.id, menuOrder)
  }, [user?.id, menuOrder])

  const handleReorder = (section, draggedTo, targetTo) => {
    if (!section || !draggedTo || !targetTo || draggedTo === targetTo) return
    setMenuOrder((prev) => {
      const current = Array.isArray(prev?.[section]) ? [...prev[section]] : []
      const draggedIndex = current.indexOf(draggedTo)
      const targetIndex = current.indexOf(targetTo)
      if (draggedIndex < 0 || targetIndex < 0) return prev
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedTo)
      return { ...prev, [section]: current }
    })
  }

  const mobileTabs = [
    {
      id: 'services',
      to: '/app/services',
      label: 'Serviços',
      active: isActive('/app/services'),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 9.75h15M4.5 14.25h15M8.25 5.25h7.5M8.25 18.75h7.5" />
        </svg>
      ),
    },
    {
      id: 'grupo-compras',
      to: '/app/grupo-de-compras',
      label: 'Grupos',
      active: isActive('/app/grupo-de-compras'),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM11.25 9.75a3 3 0 11-6 0 3 3 0 016 0zM3.75 18a4.5 4.5 0 019 0M12.75 18a3.75 3.75 0 017.5 0" />
        </svg>
      ),
    },
    {
      id: 'lounge',
      to: '/app/lounge',
      label: 'Lounge',
      active: isActive('/app/lounge'),
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 19.5l3-1.8 3 1.8-.813-3.596L17 13.5l-3.688-.318L12 9.75l-1.312 3.432L7 13.5l2.813 2.404z" />
        </svg>
      ),
    },
    {
      id: 'loja-virtual',
      to: '/app/loja',
      label: 'Loja',
      active: isActive('/app/loja'),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5h18M5.25 7.5l1.5 12a1.5 1.5 0 001.49 1.313h7.52a1.5 1.5 0 001.49-1.313l1.5-12M9 11.25h.008v.008H9v-.008zm6 0h.008v.008H15v-.008z" />
        </svg>
      ),
    },
    {
      id: 'minha-conta',
      to: '/app/conta',
      label: 'Conta',
      active: isActive('/app/conta'),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a8.25 8.25 0 0115 0" />
        </svg>
      ),
    },
  ]

  // Banner de indicação só na página inicial da plataforma (Resumo da conta).
  const isPlatformHome = location.pathname === '/app/dashboard'
  const showReferralBanner = isPlatformHome && !referralBannerDismissed

  return (
    <div className="flex min-h-screen flex-col pt-16 lg:flex-row">
      {showReferralBanner && (
        <div
          id="platform-referral-banner"
          className="fixed left-0 right-0 top-16 z-30 flex items-center gap-2 bg-green-600 py-2 pl-4 pr-2 text-sm font-medium text-white"
        >
          <div className="min-w-0 flex-1">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 text-center">
              <span>Convide um amigo e vocês dois ganham</span>
              <Link
                to="/app/dashboard#referral-section"
                className="rounded border border-white/70 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Ver meu código
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissReferralBanner}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Fechar aviso de indicação"
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
      )}
      {/* Mobile: bottom menu fixo com 5 atalhos */}
      <nav
        id="platform-mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-earth-200 bg-earth-50/98 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-1 pb-[calc(env(safe-area-inset-bottom)+0.2rem)] pt-0.5">
          {mobileTabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.to}
              className={`flex min-h-[3.35rem] flex-col items-center justify-center px-1 text-[0.62rem] font-medium transition ${
                tab.id === 'lounge'
                  ? 'relative -translate-y-1'
                  : `rounded-lg ${
                      tab.active
                        ? 'bg-earth-900 text-earth-50'
                        : 'text-earth-600 hover:bg-earth-100'
                    }`
              }`}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.id === 'lounge' ? (
                <>
                  <span
                    className={`flex h-[4rem] w-[4rem] flex-col items-center justify-center rounded-full shadow-lg ${
                      tab.active
                        ? 'bg-earth-900 text-earth-50 ring-2 ring-earth-50'
                        : 'bg-earth-200 text-earth-700'
                    }`}
                  >
                    {tab.icon}
                    <span className="mt-0.5 text-[.6rem] leading-none font-semibold">
                      {tab.label}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {tab.icon}
                  <span className="mt-1 truncate">{tab.label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop: sidebar com grupos */}
      <aside
        className={`hidden w-56 shrink-0 border-r border-earth-200 bg-earth-100 lg:block lg:min-h-screen ${showReferralBanner ? 'mt-9' : 'mt-0'}`}
      >
        <div className="flex flex-col gap-0 p-4">
          {orderedNavItems.map((item) => (
            <div
              key={item.to}
              onDragOver={(e) => {
                if (!draggingItem || draggingItem.section !== 'nav' || draggingItem.to === item.to) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (!draggingItem || draggingItem.section !== 'nav') return
                e.preventDefault()
                handleReorder('nav', draggingItem.to, item.to)
              }}
              className="mb-1"
            >
              <Link
                to={item.to}
                draggable
                onDragStart={(e) => {
                  setDraggingItem({ section: 'nav', to: item.to })
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setDraggingItem(null)}
                className={`block cursor-grab rounded-lg px-4 py-2 font-medium transition active:cursor-grabbing ${
                  item.featured ? 'text-base' : 'text-sm'
                } ${
                  isActive(item.to)
                    ? item.featured
                      ? 'bg-amber-500 text-white'
                      : 'bg-earth-900 text-earth-50'
                    : item.featured
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'text-earth-700 hover:bg-earth-200'
                }`}
              >
                {item.label}
              </Link>
            </div>
          ))}

          {/* Grupo Minha Conta */}
          <div className="mt-2 w-full">
            <button
              type="button"
              onClick={() => setContaOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm font-medium transition ${
                isInConta ? 'bg-earth-800 text-earth-50' : 'text-earth-700 hover:bg-earth-200'
              }`}
            >
              Minha Conta
              <svg className={`h-4 w-4 transition-transform ${contaOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {contaOpen && (
              <div className="mt-1 ml-3 space-y-0.5 border-l-2 border-earth-300 pl-3">
                {orderedContaItems.map((item) => (
                  <div
                    key={item.to}
                    onDragOver={(e) => {
                      if (!draggingItem || draggingItem.section !== 'conta' || draggingItem.to === item.to) return
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      if (!draggingItem || draggingItem.section !== 'conta') return
                      e.preventDefault()
                      handleReorder('conta', draggingItem.to, item.to)
                    }}
                    className=""
                  >
                    <Link
                      to={item.to}
                      draggable
                      onDragStart={(e) => {
                        setDraggingItem({ section: 'conta', to: item.to })
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      className={`relative flex cursor-grab items-center justify-between rounded-lg px-3 py-2 text-sm transition active:cursor-grabbing ${
                        item.to === '/app/cart' && hasCartItems
                          ? 'font-semibold bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200'
                          : isActive(item.to)
                            ? 'font-medium text-earth-900 bg-earth-200'
                            : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.to === '/app/cart' && hasCartItems && (
                        <span className="ml-2 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-[0.65rem] font-bold leading-5 text-white shadow-sm">
                          {cartBadgeLabel}
                        </span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grupo Loja */}
          <div className="w-full">
            <button
              type="button"
              onClick={() => setLojaOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm font-medium transition ${
                isInLoja ? 'bg-earth-800 text-earth-50' : 'text-earth-700 hover:bg-earth-200'
              }`}
            >
              Loja
              <svg className={`h-4 w-4 transition-transform ${lojaOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {lojaOpen && (
              <div className="mt-1 ml-3 space-y-0.5 border-l-2 border-earth-300 pl-3">
                {orderedLojaItems.map((item) => (
                  <div
                    key={item.to}
                    onDragOver={(e) => {
                      if (!draggingItem || draggingItem.section !== 'loja' || draggingItem.to === item.to) return
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      if (!draggingItem || draggingItem.section !== 'loja') return
                      e.preventDefault()
                      handleReorder('loja', draggingItem.to, item.to)
                    }}
                    className=""
                  >
                    <Link
                      to={item.to}
                      draggable
                      onDragStart={(e) => {
                        setDraggingItem({ section: 'loja', to: item.to })
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      className={`block cursor-grab rounded-lg px-3 py-2 text-sm transition active:cursor-grabbing ${
                        isActive(item.to)
                          ? 'font-medium text-earth-900 bg-earth-200'
                          : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <Link
              to="/app/admin"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive('/app/admin')
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 rounded-lg px-4 py-2 text-left text-sm font-medium text-earth-600 hover:bg-earth-200 lg:mt-auto"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className={`flex-1 p-4 pb-24 lg:pb-4 ${showReferralBanner ? 'pt-32' : 'pt-20'}`}>
        <div className={`mx-auto ${location.pathname === '/app/loja' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
