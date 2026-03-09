import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

/**
 * Página inicial dividida em seções.
 * Primeira div: apresentação da loja com frase de efeito e imagem.
 */
function Home() {
  return (
    <>
      <Helmet>
        <title>Delivery - Início | Levando o Japão até você</title>
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
            <div className="mt-8">
              <Link
                to="/contact"
                className="inline-flex rounded-lg bg-earth-900 px-6 py-3 text-base font-medium text-earth-50 transition hover:bg-earth-800"
              >
                Fale conosco
              </Link>
            </div>
          </div>

          {/* Imagem com animação de voar */}
          <div className="w-full shrink-0 lg:max-w-md">
            <img
              src="/voando.png?v=2"
              alt="Apresentação da loja"
              className="w-full animate-voar rounded-lg object-contain"
            />
          </div>
        </div>
      </section>

      {/* Seção 2: Apresentação dos serviços */}
      <section className="border-t border-earth-200 bg-earth-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-earth-900 sm:text-3xl">
            Nossos serviços
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-earth-600">
            Conheça as formas de comprar conosco
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Redirecionamento */}
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:shadow-md">
              <h3 className="text-lg font-semibold text-earth-900">
                Redirecionamento
              </h3>
              <p className="mt-2 text-earth-600">
                Compre em lojas japonesas e envie para nosso endereço. Recebemos,
                consolidamos e enviamos até você.
              </p>
              <Link
                to="/servicos-e-precos"
                className="mt-4 inline-block text-sm font-medium text-earth-900 hover:underline"
              >
                Saiba mais →
              </Link>
            </div>

            {/* Personal shopping */}
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:shadow-md">
              <h3 className="text-lg font-semibold text-earth-900">
                Personal shopping
              </h3>
              <p className="mt-2 text-earth-600">
                Nossa equipe compra para você. Envie sua lista e cuidamos de
                toda a aquisição no Japão.
              </p>
              <Link
                to="/servicos-e-precos"
                className="mt-4 inline-block text-sm font-medium text-earth-900 hover:underline"
              >
                Saiba mais →
              </Link>
            </div>

            {/* Curadoria */}
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:shadow-md sm:col-span-2 lg:col-span-1">
              <h3 className="text-lg font-semibold text-earth-900">
                Curadoria
              </h3>
              <p className="mt-2 text-earth-600">
                Seleções especiais feitas por nós. Produtos únicos e tendências
                direto do Japão.
              </p>
              <Link
                to="/servicos-e-precos"
                className="mt-4 inline-block text-sm font-medium text-earth-900 hover:underline"
              >
                Saiba mais →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 3: Guia básico */}
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
              className="group flex flex-col rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                1.
              </span>
              <h3 className="mt-2 text-lg font-semibold text-earth-900">
                Serviços
              </h3>
              <p className="mt-2 flex-1 text-earth-600">
                Entenda o passo a passo de cada serviço: redirecionamento,
                personal shopping e curadoria.
              </p>
              <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                Ver serviços →
              </span>
            </Link>

            <Link
              to="/servicos-e-precos"
              className="group flex flex-col rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                2.
              </span>
              <h3 className="mt-2 text-lg font-semibold text-earth-900">
                Preços
              </h3>
              <p className="mt-2 flex-1 text-earth-600">
                Conheça as tabelas de valores e calcule seu pedido com o
                simulador.
              </p>
              <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                Ver preços →
              </span>
            </Link>

            <Link
              to="/onde-comprar"
              className="group flex flex-col rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm transition hover:border-earth-300 hover:shadow-md"
            >
              <span className="text-2xl font-semibold text-earth-900 group-hover:text-earth-700">
                3.
              </span>
              <h3 className="mt-2 text-lg font-semibold text-earth-900">
                Onde comprar
              </h3>
              <p className="mt-2 flex-1 text-earth-600">
                Encontre lojas parceiras por categoria e comece suas compras.
              </p>
              <span className="mt-4 text-sm font-medium text-earth-900 group-hover:underline">
                Ver lojas →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

export default Home
