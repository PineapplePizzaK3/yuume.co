import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { CATEGORIAS_LOJAS } from '../data/lojasOndeComprar'

/**
 * Card de loja com logo e nome. Link para o site da loja.
 */
function LojaCard({ loja }) {
  const [imgErro, setImgErro] = useState(false)
  const logoPath = `/logos/${loja.id}.png`

  return (
    <a
      href={loja.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center rounded-lg border border-earth-200 bg-earth-100 p-4 shadow-sm transition hover:border-earth-300 hover:shadow-md"
    >
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-earth-100 sm:h-28 sm:w-28">
        {imgErro ? (
          <span className="text-2xl font-bold text-earth-400">
            {loja.nome.charAt(0)}
          </span>
        ) : (
          <img
            src={logoPath}
            alt={`Logo ${loja.nome}`}
            className="h-full w-full object-contain p-2"
            onError={() => setImgErro(true)}
          />
        )}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-earth-900">
        {loja.nome}
      </p>
    </a>
  )
}

/**
 * Página Aonde comprar.
 * Layout: logo da loja + nome. Categorias com sidebar e filtros.
 */
function OndeComprar() {
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const categoriasFiltradas = useMemo(() => {
    let resultado = CATEGORIAS_LOJAS

    if (categoriaFiltro) {
      resultado = resultado.filter((cat) => cat.id === categoriaFiltro)
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase().trim()
      resultado = resultado
        .filter((cat) => {
          const categoriaMatch = cat.nome.toLowerCase().includes(termo)
          const lojasMatch = cat.lojas.some(
            (loja) =>
              loja.nome.toLowerCase().includes(termo) ||
              loja.id.toLowerCase().includes(termo)
          )
          return categoriaMatch || lojasMatch
        })
        .map((cat) => {
          const categoriaMatch = cat.nome.toLowerCase().includes(termo)
          return {
            ...cat,
            lojas: categoriaMatch
              ? cat.lojas
              : cat.lojas.filter(
                  (loja) =>
                    loja.nome.toLowerCase().includes(termo) ||
                    loja.id.toLowerCase().includes(termo)
                ),
          }
        })
    }

    return resultado
  }, [busca, categoriaFiltro])

  return (
    <>
      <Helmet>
        <title>Aonde comprar | As melhores lojas para comprar no Japão</title>
        <meta
          name="description"
          content="Aonde comprar - Encontre lojas parceiras por categoria: Amazon, AmiAmi, Pokemon Center, Mercari e mais."
        />
      </Helmet>

      <section className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            Aonde comprar
          </h1>
          <p className="mt-2 text-earth-600">
            Lojas parceiras onde você pode comprar e enviar para nosso endereço
            no Japão.
          </p>

          {/* Barra de pesquisa + dropdown */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar lojas ou categorias..."
              className="flex-1 rounded-lg border border-earth-300 px-4 py-3 shadow-sm placeholder:text-earth-400 focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
              aria-label="Pesquisar lojas ou categorias"
            />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="rounded-lg border border-earth-300 px-4 py-3 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900 sm:w-56"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {CATEGORIAS_LOJAS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-10 flex flex-col gap-8 lg:flex-row">
            {/* Sidebar: categorias */}
            <aside className="shrink-0 lg:w-56">
              <div className="rounded-lg border border-earth-200 bg-earth-100 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
                  Categorias
                </h2>
                <ul className="mt-3 space-y-1">
                  {CATEGORIAS_LOJAS.map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoriaFiltro(
                            categoriaFiltro === cat.id ? '' : cat.id
                          )
                        }
                        className={`block w-full rounded px-3 py-2 text-left text-sm transition ${
                          categoriaFiltro === cat.id
                            ? 'bg-earth-900 font-medium text-earth-50'
                            : 'text-earth-700 hover:bg-earth-200'
                        }`}
                      >
                        {cat.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Grid de lojas por categoria */}
            <div className="min-w-0 flex-1">
              {categoriasFiltradas.length > 0 ? (
                <div className="space-y-10">
                  {categoriasFiltradas.map((categoria) => (
                    <div key={categoria.id}>
                      <h2 className="mb-4 text-lg font-semibold text-earth-900">
                        {categoria.nome}
                      </h2>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {categoria.lojas.map((loja) => (
                          <LojaCard key={loja.id} loja={loja} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-earth-200 bg-earth-100 p-8 text-center text-earth-500">
                  Nenhuma loja encontrada
                  {busca && <> para &quot;{busca}&quot;</>}
                  {categoriaFiltro && <> na categoria selecionada</>}.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default OndeComprar
