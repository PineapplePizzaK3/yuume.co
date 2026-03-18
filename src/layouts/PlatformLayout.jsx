/**
 * PlatformLayout - Layout for authenticated platform pages.
 * Sidebar navigation for Dashboard, Services, Orders, Payments, Profile.
 * Admin link visible only for role = 'admin'.
 */
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/services', label: 'Serviços' },
  { to: '/app/orders', label: 'Pedidos' },
  { to: '/app/meus-produtos', label: 'Meus Produtos' },
  { to: '/app/wallet', label: 'Carteira' },
  { to: '/app/payments', label: 'Pagamentos' },
  { to: '/app/conta', label: 'Minha Conta' },
  { to: '/app/loja', label: 'Loja Virtual' },
  { to: '/app/cart', label: 'Carrinho' },
  { to: '/app/grupo-de-compras', label: 'Grupo de Compras' },
  { to: '/app/lista-desejos', label: 'Lista de Desejos' },
  { to: '/app/envios', label: 'Envios' },
]

export function PlatformLayout() {
  const { user, isAdmin, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <div className="flex min-h-screen flex-col pt-16 lg:flex-row">
      <aside className="w-full border-b border-earth-200 bg-earth-100 lg:w-56 lg:border-b-0 lg:border-r lg:min-h-screen">
        <div className="flex flex-wrap gap-2 p-4 lg:flex-col lg:gap-0 lg:p-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive(item.to)
                  ? 'bg-earth-900 text-earth-50'
                  : 'text-earth-700 hover:bg-earth-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
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
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Plataforma em testes.</span>{' '}
            Ainda estamos em fase de testes e podem haver problemas. Pedimos a compreensão.
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
