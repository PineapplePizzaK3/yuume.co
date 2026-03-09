import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

function formatarIene(valor) {
  return `¥ ${Number(valor).toLocaleString('pt-BR')}`
}

const LINHAS_VALORES = (percentual, porItem, freteTexto, formatarIene) => [
  { label: 'Percentual sobre o valor da compra', valor: percentual === null ? 'Sob consulta' : `${percentual}%` },
  { label: 'Taxa por item', valor: porItem === null ? 'Sob consulta' : `${formatarIene(porItem)}/item` },
  { label: 'Frete internacional', valor: freteTexto },
]

function TabelaValores({ percentual, porItem, freteTexto }) {
  const linhas = LINHAS_VALORES(percentual, porItem, freteTexto, formatarIene)

  return (
    <div className="mt-6 rounded-lg border border-earth-200 overflow-hidden">
      {/* Desktop: tabela */}
      <div className="hidden sm:block">
        <table className="w-full divide-y divide-earth-200">
          <thead className="bg-earth-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                Componente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-earth-200 bg-earth-100">
            {linhas.map((linha, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm text-earth-900">
                  {linha.label}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-earth-900">
                  {linha.valor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards empilhados (label + valor por linha) */}
      <div className="sm:hidden divide-y divide-earth-200 bg-earth-100">
        {linhas.map((linha, i) => (
          <div key={i} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-sm text-earth-600">{linha.label}</span>
            <span className="text-sm font-medium text-earth-900">{linha.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Fluxo de cada serviço.
 */
const FLUXOS = [
  {
    id: 'redirecionamento',
    titulo: 'Redirecionamento',
    descricao: 'Compre em lojas japonesas e envie para nosso endereço.',
    passos: [
      'Cadastre-se e receba nosso endereço no Japão',
      'Faça suas compras nas lojas parceiras',
      'Envie os pacotes para nosso endereço',
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
 * Página Serviços - visão geral dos serviços com fluxos.
 * Sub-página de Serviços e Preços (index).
 */
function Servicos() {
  return (
    <>
      <Helmet>
        <title>Nossos serviços | Serviços e Preços | Delivery</title>
        <meta
          name="description"
          content="Conheça nossos serviços: redirecionamento, personal shopping e curadoria. Entenda o fluxo de cada modalidade."
        />
      </Helmet>

      <div className="space-y-12">
        <p className="text-earth-600">
          Escolha um dos nossos serviços e saiba passo a passo como utilizar.
          Confira os tipos de envio e tarifas em{' '}
          <Link
            to="/servicos-e-precos/fretes-prazos"
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            Fretes e Prazos
          </Link>
          , ou use o{' '}
          <Link
            to="/servicos-e-precos/simulador"
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            simulador
          </Link>{' '}
          para calcular seu pedido.
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

            {/* Valores / tabela por serviço */}
            {servico.id === 'redirecionamento' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  <strong>Como cobramos:</strong> 20% do valor da compra + {formatarIene(150)}/item + frete.
                </p>
                <TabelaValores
                  percentual={20}
                  porItem={150}
                  freteTexto="Conforme o método de envio (Japan Post)"
                />
              </>
            )}

            {servico.id === 'personal-shopping' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  <strong>Como cobramos:</strong> 25% do valor da compra + {formatarIene(150)}/item + frete.
                </p>
                <TabelaValores
                  percentual={25}
                  porItem={150}
                  freteTexto="Conforme o método de envio (Japan Post)"
                />
              </>
            )}

            {servico.id === 'curadoria' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  Valores e condições de curadoria variam conforme o item e a disponibilidade.
                </p>
                <TabelaValores
                  percentual={null}
                  porItem={null}
                  freteTexto="Conforme o método de envio (Japan Post)"
                />
              </>
            )}

            <div className="mt-6">
              <Link
                to="/servicos-e-precos/fretes-prazos"
                className="text-sm font-medium text-earth-900 hover:underline"
              >
                Ver fretes e prazos →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default Servicos
