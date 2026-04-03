import { isValidElement, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FAQ_ITEMS } from '../data/faq'

/** Concatena texto visível de strings, arrays e elementos React (para busca nas respostas). */
function textoParaBusca(node) {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return `${node} `
  if (Array.isArray(node)) return node.map(textoParaBusca).join('')
  if (isValidElement(node)) return textoParaBusca(node.props?.children)
  return ''
}

function normalizarBusca(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Item de dúvidas expansível (accordion).
 */
function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-earth-200 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:text-earth-900"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-earth-900">{item.pergunta}</span>
        <span
          className={`shrink-0 text-earth-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-5 pb-5 pr-8 text-earth-600 [&_p]:leading-relaxed [&_strong]:text-earth-800">
            {typeof item.resposta === 'string' ? <p>{item.resposta}</p> : item.resposta}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Página Dúvidas (perguntas frequentes).
 */
function Faq() {
  const [aberto, setAberto] = useState(null)
  const [busca, setBusca] = useState('')

  const itensFiltrados = useMemo(() => {
    const q = normalizarBusca(busca)
    if (!q) return FAQ_ITEMS
    return FAQ_ITEMS.filter((item) => {
      const resposta =
        typeof item.resposta === 'string' ? item.resposta : textoParaBusca(item.resposta)
      const haystack = normalizarBusca(`${item.pergunta} ${resposta}`)
      return haystack.includes(q)
    })
  }, [busca])

  useEffect(() => {
    if (aberto && !itensFiltrados.some((i) => i.id === aberto)) setAberto(null)
  }, [aberto, itensFiltrados])

  const toggle = (id) => setAberto((atual) => (atual === id ? null : id))

  return (
    <>
      <Helmet>
        <title>Dúvidas | Delivery</title>
        <meta
          name="description"
          content="Dúvidas sobre redirecionamento, personal shopping, grupos, loja, armazenamento, pagamento, frete e alfândega."
        />
      </Helmet>

      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
          Perguntas frequentes
        </h2>
        <p className="mt-2 text-earth-600">
          Redirecionamento, compra assistida, personal shopping, grupos, loja, armazenamento, pagamentos e envio do Japão.
        </p>

        <div className="relative mt-8">
          <label htmlFor="faq-busca" className="sr-only">
            Buscar nas dúvidas
          </label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-earth-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            id="faq-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nas dúvidas…"
            autoComplete="off"
            className={`w-full rounded-lg border border-earth-200 bg-white py-3 pl-11 text-earth-900 shadow-sm placeholder:text-earth-400 focus:border-earth-400 focus:outline-none focus:ring-2 focus:ring-earth-300 ${busca.trim() ? 'pr-24' : 'pr-4'}`}
          />
          {busca.trim() ? (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-earth-500 hover:bg-earth-100 hover:text-earth-800"
              aria-label="Limpar busca"
            >
              Limpar
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-earth-500" aria-live="polite">
          {itensFiltrados.length === FAQ_ITEMS.length
            ? `${FAQ_ITEMS.length} dúvidas`
            : `${itensFiltrados.length} de ${FAQ_ITEMS.length} dúvidas`}
        </p>

        <div className="mt-6 divide-y divide-earth-200 rounded-lg border border-earth-200 bg-earth-100 shadow-sm">
          {itensFiltrados.length === 0 ? (
            <p className="px-5 py-10 text-center text-earth-600">
              Nenhuma dúvida encontrada para &quot;{busca.trim()}&quot;. Tente outras palavras ou limpe a busca.
            </p>
          ) : (
            itensFiltrados.map((item) => (
              <FaqItem key={item.id} item={item} isOpen={aberto === item.id} onToggle={toggle} />
            ))
          )}
        </div>
      </div>
    </>
  )
}

export default Faq
