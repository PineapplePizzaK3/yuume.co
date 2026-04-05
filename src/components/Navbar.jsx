import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { REDES_SOCIAIS } from '../data/redesSociais'
import { useAuth } from '../hooks/useAuth'
import { useCartCount } from '../hooks/useCartCount'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'

/**
 * Navbar fixa no topo com links de navegação.
 * Logado: mostra link para plataforma e status. Deslogado: mostra Login/Cadastro.
 * Responsiva: menu hamburger no mobile, links completos no desktop.
 */
function Navbar() {
  const { isAuthenticated, user, profile, isAdmin, signOut } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const cartCount = useCartCount(user?.id)
  const unreadNotifications = useUnreadNotifications(user?.id, 20)
  const hasCartItems = cartCount > 0
  const cartBadgeLabel = cartCount > 99 ? '99+' : String(cartCount)
  const hasUnreadNotifications = unreadNotifications > 0

  const fecharMenu = () => setMenuAberto(false)

  const linkAtivo =
    'font-semibold text-earth-900'
  const linkNormal =
    'text-earth-600 transition hover:text-earth-900'

  const isAtivo = (path, exact = true) =>
    exact ? location.pathname === path : location.pathname.startsWith(path)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-earth-50 shadow-sm border-b border-earth-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className={`shrink-0 ${isAtivo('/') ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
          >
            <img
              src="/logo.png"
              alt="Logo da loja - Delivery"
              className="h-10 w-auto object-contain sm:h-12"
            />
          </Link>

          {/* Links de navegação - desktop (oculto no mobile) */}
          <div className="hidden h-16 items-center gap-6 lg:flex">
            <Link
              to="/"
              className={isAtivo('/') ? linkAtivo : linkNormal}
            >
              Home
            </Link>
            <Link
              to="/servicos-e-precos"
              className={isAtivo('/servicos-e-precos', false) ? linkAtivo : linkNormal}
            >
              Serviços e Preços
            </Link>
            <Link
              to="/onde-comprar"
              className={isAtivo('/onde-comprar') ? linkAtivo : linkNormal}
            >
              Aonde comprar
            </Link>
            <Link
              to="/faq"
              className={isAtivo('/faq', false) ? linkAtivo : linkNormal}
            >
              Dúvidas
            </Link>
            <Link
              to="/contact"
              className={isAtivo('/contact') ? linkAtivo : linkNormal}
            >
              Contato
            </Link>
            <div className="flex self-stretch">
              <Link
                to="/loja"
                className={`flex items-center px-4 text-sm font-medium text-white transition hover:bg-red-400 ${
                  isAtivo('/loja') ? 'bg-red-500 ring-2 ring-white' : 'bg-red-300'
                }`}
              >
                Loja Virtual
              </Link>
            </div>

            {/* Login/Registro ou status logado */}
            {isAuthenticated ? (
              <Link
                to="/app/dashboard"
                className="relative flex items-center gap-2 rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-700"
              >
                {hasUnreadNotifications && (
                  <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                )}
                <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
                {profile?.name || user?.email?.split('@')[0] || 'Minha conta'}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
              >
                Login / Cadastro
              </Link>
            )}

            {/* Redes sociais */}
            <div className="flex items-center gap-3 border-l border-earth-200 pl-4">
              {REDES_SOCIAIS.map((rede) => (
                <a
                  key={rede.nome}
                  href={rede.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-earth-500 transition hover:text-earth-600"
                  aria-label={rede.nome}
                >
                  {rede.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Ação do usuário no mobile (sempre visível no header) */}
          <div className="flex items-center gap-2 lg:hidden">
            {isAuthenticated ? (
              <>
                <Link
                  to="/app/cart"
                  className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-earth-400 ${
                    hasCartItems
                      ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300 hover:bg-amber-200'
                      : 'bg-earth-100 text-earth-700 hover:bg-earth-200 hover:text-earth-900'
                  }`}
                  aria-label="Central de Pagamentos"
                  title="Central de Pagamentos"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 7.5h16.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V9a1.5 1.5 0 011.5-1.5zM2.25 11.25h19.5M6.75 14.25h3.75" />
                  </svg>
                  {hasCartItems && (
                    <span className="absolute -right-1.5 -top-1.5 min-w-[1.15rem] rounded-full bg-red-600 px-1 text-center text-[0.65rem] font-bold leading-5 text-white shadow-md">
                      {cartBadgeLabel}
                    </span>
                  )}
                </Link>
                <Link
                  to="/app/dashboard"
                  className="relative inline-flex items-center justify-center gap-2 rounded-lg bg-earth-800 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-700"
                >
                  {hasUnreadNotifications && (
                    <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-earth-50" aria-hidden />
                  )}
                  <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
                  <span className="max-w-[7.5rem] truncate">
                    {profile?.name || user?.email?.split('@')[0] || 'Conta'}
                  </span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/app/admin"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800 transition hover:bg-amber-200 hover:text-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Painel Admin"
                    title="Painel Admin"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7.5 3v5.25c0 4.244-2.66 7.912-6.405 9.402a3.09 3.09 0 01-2.19 0C7.16 19.162 4.5 15.494 4.5 11.25V6L12 3z" />
                    </svg>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-earth-100 text-earth-700 transition hover:bg-earth-200 hover:text-earth-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-earth-400"
                  aria-label="Sair"
                  title="Sair"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5H8.25A2.25 2.25 0 006 6.75v10.5A2.25 2.25 0 008.25 19.5h5.25M12 12h9m0 0l-3-3m3 3l-3 3" />
                  </svg>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
              >
                Login / Cadastro
              </Link>
            )}
          </div>

          {/* Botão hamburger - apenas mobile */}
          <button
            type="button"
            onClick={() => setMenuAberto(!menuAberto)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-earth-600 hover:bg-earth-100 hover:text-earth-900 lg:hidden"
            aria-expanded={menuAberto}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuAberto ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Menu mobile (dropdown) */}
        {menuAberto && (
          <div className="border-t border-earth-200 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              <Link
                to="/"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/') ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Home
              </Link>
              <Link
                to="/servicos-e-precos"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/servicos-e-precos', false) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Serviços e Preços
              </Link>
              <Link
                to="/onde-comprar"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/onde-comprar') ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Aonde comprar
              </Link>
              <Link
                to="/faq"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/faq', false) ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Dúvidas
              </Link>
              <Link
                to="/contact"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/contact') ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Contato
              </Link>
              <Link
                to="/loja"
                onClick={fecharMenu}
                className={`px-4 py-3 font-medium text-white transition hover:bg-red-400 ${
                  isAtivo('/loja') ? 'bg-red-500 ring-2 ring-white' : 'bg-red-300'
                }`}
              >
                Loja Virtual
              </Link>
              <div className="mt-4 flex justify-center gap-4 border-t border-earth-200 pt-4">
                {REDES_SOCIAIS.map((rede) => (
                  <a
                    key={rede.nome}
                    href={rede.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fecharMenu}
                    className="p-2 text-earth-500 transition hover:text-earth-600"
                    aria-label={rede.nome}
                  >
                    {rede.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
