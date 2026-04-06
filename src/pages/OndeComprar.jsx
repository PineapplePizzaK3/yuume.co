import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CATEGORIAS_LOJAS, RECOMENDACOES_QUICK_ACCESS } from '../data/lojasOndeComprar'
import ImageLightbox from '../components/ImageLightbox'
import { PageSeo } from '../components/PageSeo'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { LOCALE_EN } from '../lib/localeRoutes'

const CAT_LABEL_KEY = {
  gerais: 'catGerais',
  stationery: 'catStationery',
  cosmeticos: 'catCosmeticos',
  tcg: 'catTcg',
  anime: 'catAnime',
  personagens: 'catPersonagens',
  usados: 'catUsados',
  moda: 'catModa',
}

/** @param {import('react-i18next').TFunction} t */
function categoryDisplayName(t, cat) {
  const k = CAT_LABEL_KEY[cat.id]
  if (!k) return cat.nome
  return t(`ondeComprarPage.${k}`, { defaultValue: cat.nome })
}

/** @param {import('react-i18next').TFunction} t */
function storeDescText(t, loja) {
  if (!loja.descricao) return ''
  return t(`ondeComprarStoreDesc.${loja.id}`, { defaultValue: loja.descricao })
}

/**
 * Card de loja simples (uma URL).
 */
function LojaCardSimple({ loja }) {
  const { t } = useTranslation()
  const [imgErro, setImgErro] = useState(false)
  const logoPathPng = `/logos/${loja.id}.png`
  const logoPathSvg = `/logos/${loja.id}.svg`
  const desc = loja.descricao
    ? t(`ondeComprarStoreDesc.${loja.id}`, { defaultValue: loja.descricao })
    : null

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
      {desc && (
        <p className="mt-1 text-center text-xs text-earth-600 line-clamp-2">
          {desc}
        </p>
      )}
    </a>
  )
}

/**
 * Card de loja agrupada (vários sites sob uma marca). Compacto para evitar overload.
 */
function LojaCardAgrupada({ loja }) {
  const { t } = useTranslation()
  const [imgErro, setImgErro] = useState(false)
  const logoPathPng = `/logos/${loja.id}.png`
  const logoPathSvg = `/logos/${loja.id}.svg`
  const desc = loja.descricao
    ? t(`ondeComprarStoreDesc.${loja.id}`, { defaultValue: loja.descricao })
    : null

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
      {desc && (
        <p className="mt-1 text-center text-xs text-earth-600">
          {desc}
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
  const { t } = useTranslation()
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
  const catTitle = item
    ? t(`home.quickAccess.${item.id}.title`, { defaultValue: item.tipoLoja })
    : ''
  const catDesc = item
    ? t(`home.quickAccess.${item.id}.desc`, { defaultValue: item.descricao })
    : ''

  const lojasRecomendadas = useMemo(() => {
    if (!item) return []
    return item.lojaIds
      .map((id) => lojasById.get(id))
      .filter(Boolean)
  }, [item, lojasById])

  const goNext = () => handleIndexChange((index + 1) % items.length)
  const goPrev = () => handleIndexChange((index - 1 + items.length) % items.length)

  useEffect(() => {
    if (items.length <= 1) return undefined
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
      setImgErro(false)
    }, 20000)
    return () => clearInterval(id)
  }, [items.length])

  const openLightbox = (src) => {
    if (!src) return
    setLightbox({ open: true, src, alt: catTitle })
  }

  if (!item) return null

  return (
    <div className="mb-10 overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm">
      <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-earth-500">
        {t('ondeComprarPage.quickTitle')}
      </h2>
      <div className="relative flex items-stretch">
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-0 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-earth-700 shadow-md transition hover:bg-white hover:text-earth-900"
          aria-label={t('ondeComprarPage.prevItem')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-0 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-earth-700 shadow-md transition hover:bg-white hover:text-earth-900"
          aria-label={t('ondeComprarPage.nextItem')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex w-full flex-col sm:flex-row">
          <div className="relative w-full shrink-0 overflow-hidden bg-earth-200 sm:w-64">
            {!imgErro ? (
              <button
                type="button"
                className="relative h-48 w-full cursor-zoom-in sm:h-56"
                onClick={() => openLightbox(imagem)}
                aria-label={t('ondeComprarPage.zoomImage', { name: catTitle })}
              >
                <img
                  src={imagem}
                  alt={catTitle}
                  className="h-full w-full object-cover"
                  onError={() => setImgErro(true)}
                />
              </button>
            ) : null}
            <div
              className={`h-full w-full items-center justify-center bg-gradient-to-br from-earth-300 to-earth-400 ${imgErro ? 'flex' : 'hidden'}`}
              aria-hidden
            >
              <span className="text-4xl font-bold text-earth-600/50">{catTitle.charAt(0)}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-earth-900">{catTitle}</h3>

            <div className="mt-3 flex flex-wrap gap-3">
              {lojasRecomendadas.map((loja) => (
                <LojaMiniCard key={loja.id} loja={loja} />
              ))}
            </div>

            <p className="mt-3 flex-1 text-sm text-earth-600">{catDesc}</p>

            <div className="mt-4 flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleIndexChange(i)}
                  className={`h-2 w-2 rounded-full transition ${
                    i === index ? 'bg-earth-900' : 'bg-earth-300 hover:bg-earth-400'
                  }`}
                  aria-label={t('ondeComprarPage.goToItem', { n: i + 1 })}
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
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const collatorLocale = siteLocale === LOCALE_EN ? 'en' : 'pt-BR'
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
      return categoryDisplayName(t, a).localeCompare(
        categoryDisplayName(t, b),
        collatorLocale,
        { sensitivity: 'base' },
      )
    })
  }, [t, collatorLocale])

  const categoriasFiltradas = useMemo(() => {
    let resultado = categoriasOrdenadas

    if (categoriaFiltro) {
      resultado = resultado.filter((cat) => cat.id === categoriaFiltro)
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase().trim()
      resultado = resultado
        .filter((cat) => {
          const catLabel = categoryDisplayName(t, cat).toLowerCase()
          const categoriaMatch =
            catLabel.includes(termo) || cat.nome.toLowerCase().includes(termo)
          const lojasMatch = cat.lojas.some((loja) => {
            const descT = storeDescText(t, loja).toLowerCase()
            return (
              loja.nome.toLowerCase().includes(termo) ||
              loja.id.toLowerCase().includes(termo) ||
              (loja.descricao && descT.includes(termo)) ||
              (loja.sites && loja.sites.some((s) => s.nome.toLowerCase().includes(termo)))
            )
          })
          return categoriaMatch || lojasMatch
        })
        .map((cat) => {
          const catLabel = categoryDisplayName(t, cat).toLowerCase()
          const categoriaMatch =
            catLabel.includes(termo) || cat.nome.toLowerCase().includes(termo)
          return {
            ...cat,
            lojas: categoriaMatch
              ? cat.lojas
              : cat.lojas.filter((loja) => {
                  const descT = storeDescText(t, loja).toLowerCase()
                  return (
                    loja.nome.toLowerCase().includes(termo) ||
                    loja.id.toLowerCase().includes(termo) ||
                    (loja.descricao && descT.includes(termo)) ||
                    (loja.sites &&
                      loja.sites.some((s) => s.nome.toLowerCase().includes(termo)))
                  )
                }),
          }
        })
    }

    return resultado
  }, [busca, categoriaFiltro, categoriasOrdenadas, t])

  return (
    <>
      <PageSeo
        routeKey="ondeComprar"
        title={t('meta.ondeComprar.title')}
        description={t('meta.ondeComprar.description')}
      />

      <section className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            {t('ondeComprarPage.title')}
          </h1>
          <p className="mt-2 text-earth-600">{t('ondeComprarPage.subtitle')}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t('ondeComprarPage.searchPh')}
              className="flex-1 rounded-lg border border-earth-300 px-4 py-3 shadow-sm placeholder:text-earth-400 focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
              aria-label={t('ondeComprarPage.searchAria')}
            />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="rounded-lg border border-earth-300 px-4 py-3 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900 sm:w-56"
              aria-label={t('ondeComprarPage.filterAria')}
            >
              <option value="">{t('ondeComprarPage.allCategories')}</option>
              {categoriasOrdenadas.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {categoryDisplayName(t, cat)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-10 flex flex-col gap-8 lg:flex-row">
            <aside className="shrink-0 lg:w-56">
              <div className="rounded-lg border border-earth-200 bg-earth-100 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
                  {t('ondeComprarPage.categoriesSidebar')}
                </h2>
                <ul className="mt-3 space-y-1">
                  {categoriasOrdenadas.map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoriaFiltro(
                            categoriaFiltro === cat.id ? '' : cat.id,
                          )
                        }
                        className={`block w-full rounded px-3 py-2 text-left text-sm transition ${
                          categoriaFiltro === cat.id
                            ? 'bg-earth-900 font-medium text-earth-50'
                            : 'text-earth-700 hover:bg-earth-200'
                        }`}
                      >
                        {categoryDisplayName(t, cat)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <QuickAccessRecommendations />
              {categoriasFiltradas.length > 0 ? (
                <div className="space-y-10">
                  {categoriasFiltradas.map((categoria) => (
                    <div key={categoria.id}>
                      <h2 className="mb-4 text-lg font-semibold text-earth-900">
                        {categoryDisplayName(t, categoria)}
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
                  {t('ondeComprarPage.empty')}
                  {busca && <> {t('ondeComprarPage.emptyForQuery', { q: busca })}</>}
                  {categoriaFiltro && <> {t('ondeComprarPage.emptyCategory')}</>}.
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
