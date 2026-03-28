import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

/**
 * Fluxo de cada serviço. Textos placeholder - preencher manualmente.
 */
const FLUXOS = [
  {
    id: 'redirecionamento',
    titulo: 'Redirecionamento',
    descricao:
      'Compre em lojas japonesas com Redirecionamento Padrão (você compra e envia) ou Redirecionamento Assistido (nós compramos com pré-pagamento).',
    passos: [
      'Cadastre-se e receba nosso endereço no Japão',
      'Escolha Padrão (você compra nas lojas) ou Assistido (envie a lista para orçamento)',
      'No Padrão, envie os pacotes para nosso endereço; no Assistido, pague após o orçamento',
      'Consolidamos e enviamos até você',
    ],
  },
  {
    id: 'personal-shopping',
    titulo: 'Personal shopping',
    descricao: 'Nossa equipe compra para você.',
    passos: [
      'Envie sua lista de compras',
      'Recebemos e analisamos seu pedido',
      'Realizamos as compras nas lojas',
      'Enviamos tudo consolidado',
    ],
  },
  {
    id: 'curadoria',
    titulo: 'Curadoria',
    descricao: 'Seleções especiais feitas por nós.',
    passos: [
      'Navegue pelas nossas seleções',
      'Escolha os produtos que deseja',
      'Faça o pedido pelo nosso canal',
      'Receba em casa',
    ],
  },
]

/**
 * Página índice de Como funciona - fluxo de cada serviço.
 */
function ComoFunciona() {
  return (
    <>
      <Helmet>
        <title>Como funciona? | Serviços e Preços</title>
        <meta
          name="description"
          content="Como funciona - Entenda o fluxo de cada serviço: redirecionamento, personal shopping e curadoria."
        />
      </Helmet>

      <div className="space-y-12">
        <p className="text-earth-600">
          Escolha um dos nossos serviços e saiba passo a passo como utilizar.
          Cada fluxo foi pensado para facilitar sua experiência de compra no
          Japão.
        </p>

        {FLUXOS.map((servico) => (
          <div
            key={servico.id}
            className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              {servico.titulo}
            </h2>
            <p className="mt-2 text-earth-600">{servico.descricao}</p>

            <ol className="mt-6 space-y-4">
              {servico.passos.map((passo, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-earth-900 text-sm font-semibold text-earth-50">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-earth-700">{passo}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6">
              <Link
                to="/servicos-e-precos"
                className="text-sm font-medium text-earth-900 hover:underline"
              >
                Ver preços deste serviço →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default ComoFunciona
