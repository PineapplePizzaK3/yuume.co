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
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-earth-600">
            © {currentYear} Eiko's Delivery Service. Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link to="/" className={linkClasse('/')}>
              Home
            </Link>
            <Link to="/servicos-e-precos" className={linkClasse('/servicos-e-precos', false)}>
              Serviços e Preços
            </Link>
            <Link to="/faq" className={linkClasse('/faq', false)}>
              FAQ
            </Link>
            <Link to="/onde-comprar" className={linkClasse('/onde-comprar')}>
              Aonde comprar
            </Link>
            <Link to="/contact" className={linkClasse('/contact')}>
              Contato
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
