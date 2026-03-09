import { Outlet, Link, useLocation } from 'react-router-dom'

/**
 * Layout para FAQ e sub-páginas.
 */
function FaqLayout() {
  const location = useLocation()

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
          FAQ
        </h1>

        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link
                to="/faq"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/faq'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Perguntas frequentes
              </Link>
            </li>
            <li>
              <Link
                to="/faq/itens-proibidos"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/faq/itens-proibidos'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Itens proibidos
              </Link>
            </li>
            <li>
              <Link
                to="/faq/taxas-alfandegarias"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/faq/taxas-alfandegarias'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Taxas alfandegárias
              </Link>
            </li>
          </ul>
        </nav>

        <div className="max-w-3xl">
          <Outlet />
        </div>
      </div>
    </section>
  )
}

export default FaqLayout
