import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CATEGORIAS_LOJAS, RECOMENDACOES_QUICK_ACCESS } from '../data/lojasOndeComprar'
import ImageLightbox from '../components/ImageLightbox'

/**
 * Card de loja simples (uma URL).
 */
function LojaCardSimple({ loja }) {
  const [imgErro, setImgErro] = useState(false)
  const logoPathPng = `/logos/${loja.id}.png`
  const logoPathSvg = `/logos/${loja.id}.svg`

  const handleLogoError = (e) => {
    const el = e.currentTarget
    if (el.dataset.logoExt === 'svg') {
      setImgErro(true)
      return
    }
    el.dataset.logoExt = 'svg'
    el.src = logoPathSvg
  }

  return (
    <a
      href={loja.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center rounded-lg border border-earth-200 bg-earth-100 p-4 shadow-sm transition hover:border-earth-300 hover:shadow-md"
    >
      <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
        {imgErro ? (
          <span className="text-3xl font-bold text-earth-400">
            {loja.nome.charAt(0)}
          </span>
        ) : (
          <img
            src={logoPathPng}
            alt={`Logo ${loja.nome}`}
            width={120}
            height={120}
            className="h-full w-full object-contain p-2"
            data-logo-ext="png"
            onError={handleLogoError}
          />
        )}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-earth-900">
        {loja.nome}
      </p>
      {loja.descricao && (
        <p className="mt-1 text-center text-xs text-earth-600 line-clamp-2">
          {loja.descricao}
        </p>
      )}
    </a>
  )
}

/**
 * Card de loja agrupada (vários sites sob uma marca). Compacto para evitar overload.
 */
function LojaCardAgrupada({ loja }) {
  const [imgErro, setImgErro] = useState(false)
  const logoPathPng = `/logos/${loja.id}.png`
  const logoPathSvg = `/logos/${loja.id}.svg`

  const handleLogoError = (e) => {
    const el = e.currentTarget
    if (el.dataset.logoExt === 'svg') {
      setImgErro(true)
      return
    }
    el.dataset.logoExt = 'svg'
    el.src = logoPathSvg
  }

  return (
    <div className="flex flex-col items-center rounded-lg border border-earth-200 bg-earth-100 p-4 shadow-sm transition hover:border-earth-300">
      <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
        {imgErro ? (
          <span className="text-3xl font-bold text-earth-400">
            {loja.nome.charAt(0)}
          </span>
        ) : (
          <img
            src={logoPathPng}
            alt={`Logo ${loja.nome}`}
            width={120}
            height={120}
            className="h-full w-full object-contain p-2"
            data-logo-ext="png"
            onError={handleLogoError}
          />
        )}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-earth-900">
        {loja.nome}
      </p>
      {loja.descricao && (
        <p className="mt-1 text-center text-xs text-earth-600">
          {loja.descricao}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-1.5 w-full">
        {loja.sites.map((site) => (
          <a
            key={site.url}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded bg-earth-200 px-3 py-1.5 text-center text-xs font-medium text-earth-800 transition hover:bg-earth-300 hover:text-earth-900"
          >
            {site.nome}
          </a>
        ))}
      </div>
    </div>
  )
}

function LojaCard({ loja }) {
  if (loja.sites?.length) {
    return <LojaCardAgrupada loja={loja} />
  }
  return <LojaCardSimple loja={loja} />
}

/** Card compacto com ícone para Quick Access */
function LojaMiniCard({ loja }) {
  const [imgErro, setImgErro] = useState(false)
  const logoPathPng = `/logos/${loja.id}.png`
  const logoPathSvg = `/logos/${loja.id}.svg`

  const handleLogoError = (e) => {
    const el = e.currentTarget
    if (el.dataset.logoExt === 'svg') {
      setImgErro(true)
      return
    }
    el.dataset.logoExt = 'svg'
    el.src = logoPathSvg
  }
  const href = loja.sites?.length ? loja.sites[0].url : loja.url
  const label = loja.nome

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-earth-200 bg-white px-3 py-2 shadow-sm transition hover:border-earth-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-earth-100">
        {imgErro ? (
          <span className="text-sm font-bold text-earth-400">{loja.nome.charAt(0)}</span>
        ) : (
          <img
            src={logoPathPng}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-contain p-0.5"
            data-logo-ext="png"
            onError={handleLogoError}
          />
        )}
      </div>
      <span className="text-sm font-medium text-earth-800">{label}</span>
    </a>
  )
}

/** Mapa id → loja de todas as categorias */
function getLojasById() {
  const mapa = new Map()
  for (const cat of CATEGORIAS_LOJAS) {
    for (const loja of cat.lojas) {
      mapa.set(loja.id, loja)
    }
  }
  return mapa
}

/**
 * Quick Access: carrossel de recomendações por tipo de loja.
 * Imagem, tipo, lojas recomendadas e descrição.
 */
function QuickAccessRecommendations() {
  const [index, setIndex] = useState(0)
  const [imgErro, setImgErro] = useState(false)
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' })
  const lojasById = useMemo(getLojasById, [])

  const handleIndexChange = (newIndex) => {
    setIndex(newIndex)
    setImgErro(false)
  }

  const items = RECOMENDACOES_QUICK_ACCESS
  const item = items[index]
  const imagem = item?.imagens?.length ? item.imagens[0] : item?.imagem
  const lojasRecomendadas = useMemo(() => {
    if (!item) return []
    return item.lojaIds
      .map((id) => lojasById.get(id))
      .filter(Boolean)
  }, [item, lojasById])

  const goNext = () => handleIndexChange((index + 1) % items.length)
  const goPrev = () => handleIndexChange((index - 1 + items.length) % items.length)

  const openLightbox = (src) => {
    if (!src) return
    setLightbox({ open: true, src, alt: item?.tipoLoja || '' })
  }

  return (
    <div className="mb-10 overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm">
      <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-earth-500">
        Nossas recomendações
      </h2>
      <div className="relative flex items-stretch">
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-0 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-earth-700 shadow-md transition hover:bg-white hover:text-earth-900"
          aria-label="Item anterior"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-0 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-earth-700 shadow-md transition hover:bg-white hover:text-earth-900"
          aria-label="Próximo item"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex w-full flex-col sm:flex-row">
          {/* Imagem */}
          <div className="relative w-full shrink-0 overflow-hidden bg-earth-200 sm:w-64">
            {!imgErro ? (
              <button
                type="button"
                className="relative h-48 w-full cursor-zoom-in sm:h-56"
                onClick={() => openLightbox(imagem)}
                aria-label={`Ampliar imagem de ${item.tipoLoja}`}
              >
                <img
                  src={imagem}
                  alt={item.tipoLoja}
                  className="h-full w-full object-cover"
                  onError={() => setImgErro(true)}
                />
              </button>
            ) : null}
            <div
              className={`h-full w-full items-center justify-center bg-gradient-to-br from-earth-300 to-earth-400 ${imgErro ? 'flex' : 'hidden'}`}
              aria-hidden
            >
              <span className="text-4xl font-bold text-earth-600/50">{item.tipoLoja.charAt(0)}</span>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-earth-900">{item.tipoLoja}</h3>

            <div className="mt-3 flex flex-wrap gap-3">
              {lojasRecomendadas.map((loja) => (
                <LojaMiniCard key={loja.id} loja={loja} />
              ))}
            </div>

            <p className="mt-3 flex-1 text-sm text-earth-600">{item.descricao}</p>

            <div className="mt-4 flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleIndexChange(i)}
                  className={`h-2 w-2 rounded-full transition ${
                    i === index ? 'bg-earth-900' : 'bg-earth-300 hover:bg-earth-400'
                  }`}
                  aria-label={`Ir para item ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ open: false, src: '', alt: '' })}
      />
    </div>
  )
}

/**
 * Página Aonde comprar.
 * Layout: logo da loja + nome. Categorias com sidebar e filtros.
 */
function OndeComprar() {
  const [searchParams] = useSearchParams()
  const categoriaFromUrl = searchParams.get('categoria') || ''
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState(categoriaFromUrl)

  useEffect(() => {
    if (categoriaFromUrl) setCategoriaFiltro(categoriaFromUrl)
  }, [categoriaFromUrl])

  const categoriasOrdenadas = useMemo(() => {
    const list = [...CATEGORIAS_LOJAS]
    return list.sort((a, b) => {
      if (a.id === 'gerais' && b.id !== 'gerais') return -1
      if (b.id === 'gerais' && a.id !== 'gerais') return 1
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    })
  }, [])

  const categoriasFiltradas = useMemo(() => {
    let resultado = categoriasOrdenadas

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
              loja.id.toLowerCase().includes(termo) ||
              (loja.descricao && loja.descricao.toLowerCase().includes(termo)) ||
              (loja.sites && loja.sites.some((s) => s.nome.toLowerCase().includes(termo)))
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
                    loja.id.toLowerCase().includes(termo) ||
                    (loja.descricao && loja.descricao.toLowerCase().includes(termo)) ||
                    (loja.sites && loja.sites.some((s) => s.nome.toLowerCase().includes(termo)))
                ),
          }
        })
    }

    return resultado
  }, [busca, categoriaFiltro, categoriasOrdenadas])

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
              {categoriasOrdenadas.map((cat) => (
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
                  {categoriasOrdenadas.map((cat) => (
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

            {/* Quick Access + Grid de lojas por categoria */}
            <div className="min-w-0 flex-1">
              <QuickAccessRecommendations />
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
