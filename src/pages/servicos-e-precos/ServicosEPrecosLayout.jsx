import { Outlet, Link, useLocation } from 'react-router-dom'

/**
 * Layout para Serviços e Preços com sub-páginas.
 */
function ServicosEPrecosLayout() {
  const location = useLocation()

  return (
    <section className="px-4 pt-24 pb-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
          Serviços e Preços
        </h1>

        {/* Menu de sub-páginas */}
        <nav className="mb-10 border-b border-earth-200">
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link
                to="/servicos-e-precos"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/servicos-e-precos'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Serviços
              </Link>
            </li>
            <li>
              <Link
                to="/servicos-e-precos/fretes-prazos"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/servicos-e-precos/fretes-prazos'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Fretes e Prazos
              </Link>
            </li>
            <li>
              <Link
                to="/servicos-e-precos/simulador"
                className={`block border-b-2 pb-3 text-sm font-medium transition ${
                  location.pathname === '/servicos-e-precos/simulador'
                    ? 'border-earth-900 text-earth-900'
                    : 'border-transparent text-earth-600 hover:border-earth-300 hover:text-earth-900'
                }`}
              >
                Simulador
              </Link>
            </li>
          </ul>
        </nav>

        <Outlet />
      </div>
    </section>
  )
}

export default ServicosEPrecosLayout
