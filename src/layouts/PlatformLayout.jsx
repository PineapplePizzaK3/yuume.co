/**
 * PlatformLayout - Layout for authenticated platform pages.
 * Sidebar navigation with grouped items: Loja, Minha Conta.
 */
import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const LOJA_ITEMS = [
  { to: '/app/loja', label: 'Loja Virtual' },
  { to: '/app/cart', label: 'Carrinho' },
  { to: '/app/grupo-de-compras', label: 'Grupo de Compras' },
]

const MINHA_CONTA_ITEMS = [
  { to: '/app/conta', label: 'Dados da conta' },
  { to: '/app/payments', label: 'Pagamentos' },
  { to: '/app/lista-desejos', label: 'Lista de Desejos' },
]

const NAV_ITEMS = [
  { to: '/app/lounge', label: '⭐ Lounge', featured: true },
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/services', label: 'Serviços' },
]

export function PlatformLayout() {
  const { user, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const [lojaOpen, setLojaOpen] = useState(false)
  const [contaOpen, setContaOpen] = useState(false)

  const isActive = (path) => location.pathname === path
  const isInLoja = LOJA_ITEMS.some((i) => i.to === location.pathname)
  const isInConta = MINHA_CONTA_ITEMS.some((i) => i.to === location.pathname)

  useEffect(() => {
    if (isInLoja) setLojaOpen(true)
  }, [isInLoja])
  useEffect(() => {
    if (isInConta) setContaOpen(true)
  }, [isInConta])

  const allMobileItems = [
    ...NAV_ITEMS,
    ...LOJA_ITEMS,
    ...MINHA_CONTA_ITEMS,
    ...(isAdmin ? [{ to: '/app/admin', label: 'Admin' }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col pt-16 lg:flex-row">
      {/* Mobile: menu horizontal em uma linha */}
      <aside className="border-b border-earth-200 bg-earth-100 lg:hidden">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {allMobileItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`shrink-0 rounded-lg px-4 py-2 font-medium transition whitespace-nowrap ${
                item.featured ? 'text-base' : 'text-sm'
              } ${
                isActive(item.to)
                  ? item.featured
                    ? 'bg-amber-500 text-white'
                    : 'bg-earth-900 text-earth-50'
                  : item.featured
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'bg-earth-50 text-earth-700 hover:bg-earth-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => signOut()}
            className="shrink-0 rounded-lg bg-earth-50 px-4 py-2 text-sm font-medium text-earth-600 transition hover:bg-earth-200 whitespace-nowrap"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Desktop: sidebar com grupos */}
      <aside className="hidden w-56 shrink-0 border-r border-earth-200 bg-earth-100 lg:block lg:min-h-screen">
        <div className="flex flex-col gap-0 p-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-4 py-2 font-medium transition ${
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
          ))}

          {/* Grupo Loja */}
          <div className="mt-2 w-full">
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
                {LOJA_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      isActive(item.to)
                        ? 'font-medium text-earth-900 bg-earth-200'
                        : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Grupo Minha Conta */}
          <div className="w-full">
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
                {MINHA_CONTA_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      isActive(item.to)
                        ? 'font-medium text-earth-900 bg-earth-200'
                        : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                    }`}
                  >
                    {item.label}
                  </Link>
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
      <main className="flex-1 p-4 pt-24">
        <div className={`mx-auto ${location.pathname === '/app/loja' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
