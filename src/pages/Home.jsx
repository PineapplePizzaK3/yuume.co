import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { RECOMENDACOES_QUICK_ACCESS } from '../data/lojasOndeComprar'
import ImageLightbox from '../components/ImageLightbox'

/** Imagens alinhadas aos cards: 1 registrar, 2 selecionar serviço, 3 finalizar pedido (mesmo tamanho via aspect-video + object-cover). */
const stepRegistrar = '/home/step-registrar.png'
const stepSelecionarServico = '/home/step-selecionar-servico.png'
const stepFinalizarPedido = '/home/step-finalizar-pedido.png'

/**
 * Página inicial dividida em seções.
 * Primeira div: apresentação da loja com frase de efeito e imagem.
 */
function Home() {
  const [catIndex, setCatIndex] = useState(0)
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' })
  const rec = RECOMENDACOES_QUICK_ACCESS[catIndex] ?? RECOMENDACOES_QUICK_ACCESS[0]
  const imagens = rec.imagens ?? [rec.imagem, rec.imagem, rec.imagem]

  const goPrev = () => setCatIndex((i) => (i <= 0 ? RECOMENDACOES_QUICK_ACCESS.length - 1 : i - 1))
  const goNext = () => setCatIndex((i) => (i >= RECOMENDACOES_QUICK_ACCESS.length - 1 ? 0 : i + 1))

  useEffect(() => {
    const interval = setInterval(() => {
      setCatIndex((i) => (i >= RECOMENDACOES_QUICK_ACCESS.length - 1 ? 0 : i + 1))
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  const openLightbox = (src, alt, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setLightbox({ open: true, src, alt })
  }

  return (
    <>
      <Helmet>
        <title>Home | Levando o Japão até você</title>
        <meta
          name="description"
          content="Delivery - Levando o Japão até o conforto da sua casa. Rápido, seguro e confiável."
        />
      </Helmet>

      {/* Seção 1: Apresentação da loja */}
      <section className="px-4 pt-24 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 lg:flex-row lg:gap-12">
          {/* Frase de efeito */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-earth-900 sm:text-5xl">
              Levando o Japão até o conforto da sua casa
            </h1>
            <p className="mt-4 text-lg text-earth-600">
              Conectamos você ao que importa. Nossa missão é levar seus pedidos
              com agilidade e cuidado até o destino.
            </p>
          </div>

          {/* Imagem com animação de voar */}
          <div className="w-full shrink-0 lg:max-w-md">
            <img
              src="/voando.png?v=2"
              alt="Apresentação da loja"
              className="w-full animate-voar rounded-lg object-contain cursor-zoom-in"
              onClick={(e) => openLightbox('/voando.png?v=2', 'Apresentação da loja', e)}
            />
          </div>
        </div>
      </section>

      {/* Seção: O que pode comprar - uma categoria em destaque, botões laterais */}
      <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-earth-900 sm:text-3xl">
            O que você pode comprar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-earth-600">
            Tipos de produtos e onde encontrá-los no Japão
          </p>

          <div className="relative mt-10 flex items-stretch gap-2 md:gap-4">
            {/* Botão voltar */}
            <button
              type="button"
              onClick={goPrev}
              aria-label="Categoria anterior"
              className="shrink-0 self-center rounded-full p-2 text-earth-600 transition hover:bg-earth-200 hover:text-earth-900 md:p-3"
            >
              <svg className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Conteúdo da categoria em destaque */}
            <Link
              to={`/onde-comprar?categoria=${rec.id}`}
              className="group flex flex-1 flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-400 hover:shadow-lg"
            >
              <div className="p-4 text-center md:p-6">
                <h3 className="text-xl font-semibold text-earth-900 md:text-2xl">{rec.tipoLoja}</h3>
                <p className="mt-2 text-sm text-earth-600 md:text-base">
                  {rec.descricao}
                </p>
                <span className="mt-4 inline-block text-sm font-medium text-earth-800 group-hover:underline">
                  Ver lojas desta categoria →
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 md:gap-2 md:p-2">
                {imagens.slice(0, 3).map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden bg-earth-200"
                  >
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full cursor-zoom-in object-cover transition group-hover:scale-105"
                      onClick={(e) => openLightbox(src, rec.tipoLoja, e)}
                      onError={(e) => {
                        e.target.onerror = null
                        e.target.style.display = 'none'
                        const fallback = e.target.nextElementSibling
                        if (fallback) fallback.classList.remove('hidden')
                      }}
                    />
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-earth-200 text-earth-500 text-xs">
                      {rec.tipoLoja}
                    </div>
                  </div>
                ))}
              </div>
            </Link>

            {/* Botão avançar */}
            <button
              type="button"
              onClick={goNext}
              aria-label="Próxima categoria"
              className="shrink-0 self-center rounded-full p-2 text-earth-600 transition hover:bg-earth-200 hover:text-earth-900 md:p-3"
            >
              <svg className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Indicadores de categoria */}
          <div className="mt-6 flex justify-center gap-2">
            {RECOMENDACOES_QUICK_ACCESS.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setCatIndex(i)}
                aria-label={`Ir para ${r.tipoLoja}`}
                className={`h-2 w-2 rounded-full transition md:h-2.5 md:w-2.5 ${
                  i === catIndex ? 'bg-earth-900' : 'bg-earth-300 hover:bg-earth-400'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Seção 2: Guia básico */}
      <section className="border-t border-earth-200 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-earth-900 sm:text-3xl">
            Por onde começar?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-earth-600">
            Guia rápido para você aproveitar nossos serviços
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Link
              to="/servicos-e-precos"
              className="group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-100 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src="/home/guia-servicos.png"
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox('/home/guia-servicos.png', 'Guia de serviços', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                  1.
                </span>
                <h3 className="mt-2 text-lg font-semibold text-earth-900">
                  Serviços
                </h3>
                <p className="mt-2 flex-1 text-earth-600">
                  Redirecionamento (📦 Padrão ou 🛍️ Assistido), personal shopping, grupo de compras e loja virtual.
                </p>
                <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                  Ver serviços →
                </span>
              </div>
            </Link>

            <Link
              to="/onde-comprar"
              className="group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-100 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src="/home/guia-onde-comprar.png"
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox('/home/guia-onde-comprar.png', 'Guia de onde comprar', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                  2.
                </span>
                <h3 className="mt-2 text-lg font-semibold text-earth-900">
                  Onde comprar
                </h3>
                <p className="mt-2 flex-1 text-earth-600">
                  Lojas japonesas para redirecionamento. Compre e envie para nosso endereço no Japão.
                </p>
                <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                  Ver lojas →
                </span>
              </div>
            </Link>

            <Link
              to="/servicos-e-precos"
              className="group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-100 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src="/home/guia-precos.png"
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox('/home/guia-precos.png', 'Guia de preços e simulador', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                  3.
                </span>
                <h3 className="mt-2 text-lg font-semibold text-earth-900">
                  Preços e simulador
                </h3>
                <p className="mt-2 flex-1 text-earth-600">
                  Taxas por itens, percentuais e frete. Use o simulador para estimar o valor do seu pedido.
                </p>
                <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                  Ver preços →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Seção 3: Como usar nossos serviços */}
      <section className="border-t border-earth-200 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-earth-900 sm:text-3xl">
            Como usar nossos serviços
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-earth-600">
            Passo a passo para começar
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <li className="flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src={stepRegistrar}
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox(stepRegistrar, 'Passo 1', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-earth-900 text-sm font-bold text-earth-50">1</span>
                <h3 className="mt-4 font-semibold text-earth-900">
                <Link to="/register" className="hover:underline">Registre-se na nossa plataforma</Link>
                </h3>
                <p className="mt-2 flex-1 text-sm text-earth-600">
                  Crie sua conta gratuitamente. Com ela você acessa Meus Produtos, carrinho, envios e todos os serviços.
                </p>
              </div>
            </li>
            <li className="flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src={stepSelecionarServico}
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox(stepSelecionarServico, 'Passo 2', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-earth-900 text-sm font-bold text-earth-50">2</span>
                <h3 className="mt-4 font-semibold text-earth-900">Escolha o serviço</h3>
                <p className="mt-2 flex-1 text-sm text-earth-600">
                  Redirecionamento Padrão ou Assistido, personal shopping, grupo de compras ou loja virtual.
                </p>
              </div>
            </li>
            <li className="flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
              <div className="aspect-video w-full bg-earth-200">
                <img
                  src={stepFinalizarPedido}
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={(e) => openLightbox(stepFinalizarPedido, 'Passo 3', e)}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-earth-900 text-sm font-bold text-earth-50">3</span>
                <h3 className="mt-4 font-semibold text-earth-900">Finalize o pedido</h3>
                <p className="mt-2 flex-1 text-sm text-earth-600">
                  Faça o pagamento (produtos e frete quando informado). Acompanhe o envio em Pedidos e receba em casa.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Dúvidas */}
      <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-earth-900 sm:text-3xl">
            Tem alguma dúvida?
          </h2>
          <div className="mt-10 flex justify-center">
            <Link
              to="/faq"
              className="group flex max-w-sm flex-col overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <div className="flex h-24 items-center justify-center bg-earth-100">
                <span className="text-4xl" aria-hidden>❓</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-semibold text-earth-900">Dúvidas</h3>
                <p className="mt-2 text-sm text-earth-600">
                  Tire suas dúvidas sobre envios, taxas, prazos e como funciona nosso serviço.
                </p>
                <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                  Ver dúvidas →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
      />
    </>
  )
}

export default Home
