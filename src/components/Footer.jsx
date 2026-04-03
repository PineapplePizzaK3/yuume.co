import { Link, useLocation } from 'react-router-dom'

/**
 * Footer com links de navegação.
 */
function Footer() {
  const currentYear = new Date().getFullYear()
  const location = useLocation()

  const isAtivo = (path, exact = true) =>
    exact ? location.pathname === path : location.pathname.startsWith(path)

  const linkClasse = (path, exact = true) =>
    `text-sm transition hover:text-earth-900 py-1 ${isAtivo(path, exact) ? 'font-semibold text-earth-900' : 'text-earth-600'}`

  return (
    <footer className="border-t border-earth-200 bg-earth-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <p className="text-sm text-earth-600 w-full sm:w-auto sm:order-first">
            © {currentYear} Eiko's Delivery Service. Todos os direitos reservados.
          </p>
          <nav className="flex flex-col gap-2" aria-label="Menu principal">
            <span className="text-xs font-semibold uppercase tracking-wide text-earth-500">
              Menu
            </span>
            <div className="flex flex-col gap-1">
              <Link to="/" className={linkClasse('/')}>
                Home
              </Link>
              <Link to="/servicos-e-precos" className={linkClasse('/servicos-e-precos', false)}>
                Serviços e Preços
              </Link>
              <Link to="/faq" className={linkClasse('/faq', false)}>
                Dúvidas
              </Link>
              <Link to="/onde-comprar" className={linkClasse('/onde-comprar')}>
                Aonde comprar
              </Link>
              <Link to="/contact" className={linkClasse('/contact')}>
                Contato
              </Link>
            </div>
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Legal">
            <span className="text-xs font-semibold uppercase tracking-wide text-earth-500">
              Legal
            </span>
            <div className="flex flex-col gap-1">
              <Link to="/legal/privacy" className={linkClasse('/legal/privacy')}>
                Política de Privacidade
              </Link>
              <Link to="/legal/terms" className={linkClasse('/legal/terms')}>
                Termos de uso e serviços
              </Link>
              <Link to="/legal/commercial-disclosure" className={linkClasse('/legal/commercial-disclosure')}>
                特定商取引法に基づく表記
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default Footer
