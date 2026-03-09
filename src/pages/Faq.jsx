import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FAQ_ITEMS } from '../data/faq'

/**
 * Item de FAQ expansível (accordion).
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
          <p className="px-5 pb-5 pr-8 text-earth-600">{item.resposta}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Página FAQ.
 */
function Faq() {
  const [aberto, setAberto] = useState(null)

  const toggle = (id) => setAberto((atual) => (atual === id ? null : id))

  return (
    <>
      <Helmet>
        <title>Perguntas frequentes | FAQ </title>
        <meta
          name="description"
          content="Perguntas frequentes sobre envio, prazos, pagamento, itens proibidos e mais."
        />
      </Helmet>

      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
          Perguntas frequentes
        </h2>
        <p className="mt-2 text-earth-600">
          Tire suas dúvidas sobre nossos serviços, envios e prazos.
        </p>

        <div className="mt-10 divide-y divide-earth-200 rounded-lg border border-earth-200 bg-earth-50 shadow-sm">
            {FAQ_ITEMS.map((item) => (
              <FaqItem
                key={item.id}
                item={item}
                isOpen={aberto === item.id}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
    </>
  )
}

export default Faq
