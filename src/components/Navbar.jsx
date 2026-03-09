import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { REDES_SOCIAIS } from '../data/redesSociais'

/** URL da plataforma (login/registro). Substitua pelo endereço real. */
const PLATAFORMA_URL = 'https://plataforma.exemplo.com'

/**
 * Navbar fixa no topo com links de navegação, botão Login/Registro e ícones de redes sociais.
 * Responsiva: menu hamburger no mobile, links completos no desktop.
 */
function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()

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
          <div className="hidden items-center gap-6 lg:flex">
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
              FAQ
            </Link>
            <Link
              to="/contact"
              className={isAtivo('/contact') ? linkAtivo : linkNormal}
            >
              Contato
            </Link>

            {/* Login/Registro */}
            <a
              href={PLATAFORMA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
            >
              Login / Registro
            </a>

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
                FAQ
              </Link>
              <Link
                to="/contact"
                onClick={fecharMenu}
                className={`rounded-lg px-4 py-3 ${isAtivo('/contact') ? 'bg-earth-100 font-semibold text-earth-900' : 'text-earth-600 hover:bg-earth-50 hover:text-earth-900'}`}
              >
                Contato
              </Link>
              <a
                href={PLATAFORMA_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={fecharMenu}
                className="mx-4 mt-2 inline-flex justify-center rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 transition hover:bg-earth-800"
              >
                Login / Registro
              </a>
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
