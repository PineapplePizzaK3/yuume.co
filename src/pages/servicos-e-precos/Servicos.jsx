import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

function formatarIene(valor) {
  return `¥ ${Number(valor).toLocaleString('pt-BR')}`
}

const LINHAS_VALORES = (percentual, porItem, freteTexto, formatarIene) => [
  { label: 'Percentual sobre o valor da compra', valor: percentual === null ? 'Sob consulta' : `${percentual}%` },
  { label: 'Taxa por item', valor: porItem === null ? 'Não se aplica' : `${formatarIene(porItem)}/item` },
  { label: 'Frete internacional', valor: freteTexto },
]

/** Padrão: escada por qtd. Assistido: 15% + taxa por item igual ao padrão. */
const LINHAS_REDIRECIONAMENTO = (formatarIene) => [
  {
    componente: 'Taxa de serviço',
    padrao: `1 item ${formatarIene(1000)} · 2–4 itens ${formatarIene(750)}/item · 5+ itens ${formatarIene(500)}/item`,
    assistido: `15% sobre o valor da compra + mesma taxa por item do Redirecionamento Padrão`,
  },
  {
    componente: 'Frete internacional',
    padrao: 'Informado após consolidação (Japan Post)',
    assistido: 'Informado após consolidação (Japan Post)',
  },
]

const LINHAS_LOJA = (freteTexto) => [
  { label: 'Preço do produto', valor: 'Conforme catálogo (por item)' },
  { label: 'Frete internacional', valor: freteTexto || 'Informado após solicitar envio (Japan Post)' },
]

function TabelaValores({ percentual, porItem, freteTexto, modoRedirecionamento, modoLoja }) {
  const linhasSimples = !modoRedirecionamento && !modoLoja
    ? LINHAS_VALORES(percentual, porItem, freteTexto, formatarIene)
    : modoLoja
      ? LINHAS_LOJA(freteTexto)
      : null
  const linhasRedir = modoRedirecionamento ? LINHAS_REDIRECIONAMENTO(formatarIene) : null

  if (modoRedirecionamento && linhasRedir) {
    return (
      <div className="mt-6 rounded-lg border border-earth-200 overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full divide-y divide-earth-200 min-w-[400px]">
            <thead className="bg-earth-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  Componente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  📦 Redirecionamento Padrão
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  🛍️ Redirecionamento Assistido
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-200 bg-earth-100">
              {linhasRedir.map((linha, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm text-earth-900">{linha.componente}</td>
                  <td className="px-4 py-3 text-sm font-medium text-earth-900">{linha.padrao}</td>
                  <td className="px-4 py-3 text-sm font-medium text-earth-900">{linha.assistido}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden divide-y divide-earth-200 bg-earth-100">
          {linhasRedir.map((linha, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-4 py-3">
              <span className="text-xs font-medium text-earth-500 uppercase">{linha.componente}</span>
              <div className="space-y-0.5">
                <div className="text-sm">
                  <span className="text-earth-500">📦 Redirecionamento Padrão:</span>{' '}
                  <span className="font-medium text-earth-900">{linha.padrao}</span>
                </div>
                <div className="text-sm">
                  <span className="text-earth-500">🛍️ Redirecionamento Assistido:</span>{' '}
                  <span className="font-medium text-earth-900">{linha.assistido}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const linhas = linhasSimples
  return (
    <div className="mt-6 rounded-lg border border-earth-200 overflow-hidden">
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
                <td className="px-4 py-3 text-sm text-earth-900">{linha.label}</td>
                <td className="px-4 py-3 text-sm font-medium text-earth-900">{linha.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
 * Frete real só é conhecido após consolidação; o cliente paga e então enviamos.
 */
const FLUXOS = [
  {
    id: 'redirecionamento',
    titulo: 'Redirecionamento',
    descricao:
      'Compre em lojas japonesas e envie para nosso endereço. Dois módulos: 📦 Redirecionamento Padrão (você compra e envia) ou 🛍️ Redirecionamento Assistido (nós compramos para você, com pré-pagamento).',
    passos: [
      'Cadastre-se e receba nosso endereço no Japão',
      'Faça suas compras e envie os pacotes para nosso endereço (ou envie a lista para nós comprarmos)',
      'Recebemos e consolidamos os produtos',
      'Informamos o valor real do frete — você paga',
      'Enviamos até você',
    ],
  },
  {
    id: 'personal-shopping',
    titulo: 'Personal shopping',
    descricao: 'Serviço ideal para quem não sabe exatamente o que comprar e precisa da nossa ajuda.',
    passos: [
      'Conte o que você procura (estilo, orçamento, tamanho, referências)',
      'Sugerimos opções e ajudamos a definir a compra',
      'Após sua confirmação, realizamos as compras nas lojas',
      'Consolidamos os produtos',
      'Informamos o valor real do frete — você paga',
      'Enviamos até você',
    ],
  },
  {
    id: 'grupo-de-compras',
    titulo: 'Grupo de Compras',
    descricao: 'Seleções especiais organizadas por tema ou período. Produtos criados exclusivamente para cada grupo.',
    passos: [
      'Navegue pelos grupos de compra disponíveis',
      'Escolha os produtos que deseja no grupo',
      'Adicione ao carrinho e finalize a compra',
      'Produtos vão para Meus Produtos — solicite o envio quando quiser',
      'Pague o frete e receba em casa',
    ],
  },
  {
    id: 'loja-virtual',
    titulo: 'Loja Virtual',
    descricao: 'Catálogo fixo de produtos com preços definidos. Compre e armazene para enviar depois.',
    passos: [
      'Navegue pela loja virtual',
      'Escolha os produtos e adicione ao carrinho',
      'Finalize a compra (produtos vão para Meus Produtos)',
      'Solicite o envio quando quiser e pague o frete',
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
          content="Conheça nossos serviços: redirecionamento, personal shopping, grupo de compras e loja virtual. Entenda o fluxo e taxas de cada modalidade."
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
                  <strong>Como cobramos:</strong> Redirecionamento tem dois módulos — 📦 Redirecionamento Padrão (taxa por quantidade de itens, ver tabela) e 🛍️ Redirecionamento Assistido (15% sobre o valor da compra + taxa por item igual ao Padrão). Frete informado após consolidação.
                </p>
                <TabelaValores modoRedirecionamento />
              </>
            )}

            {servico.id === 'personal-shopping' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  <strong>Como cobramos:</strong> 25% do valor da compra + ¥250 por item + frete. Este serviço inclui ajuda para decidir o que comprar.
                </p>
                <TabelaValores
                  percentual={25}
                  porItem={250}
                  freteTexto="Informado após consolidação (Japan Post)"
                />
              </>
            )}

            {servico.id === 'grupo-de-compras' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  <strong>Como cobramos:</strong> 20% do valor da compra + ¥250 por unidade de produto + frete. Preços dos itens vêm do catálogo de cada grupo.
                </p>
                <TabelaValores
                  percentual={20}
                  porItem={250}
                  freteTexto="Informado após solicitar envio (Japan Post)"
                />
              </>
            )}

            {servico.id === 'loja-virtual' && (
              <>
                <p className="mt-6 text-sm text-earth-600">
                  <strong>Como cobramos:</strong> Preço do produto (definido por item no catálogo) + frete quando solicitar o envio. Produtos ficam em Meus Produtos até você solicitar a consolidação.
                </p>
                <TabelaValores
                  modoLoja
                  freteTexto="Informado após solicitar envio (Japan Post)"
                />
              </>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/servicos-e-precos/fretes-prazos"
                className="text-sm font-medium text-earth-900 hover:underline"
              >
                Ver fretes e prazos →
              </Link>
              {(servico.id === 'grupo-de-compras' || servico.id === 'loja-virtual') && (
                <Link
                  to={servico.id === 'grupo-de-compras' ? '/app/grupo-de-compras' : '/loja'}
                  className="text-sm font-medium text-earth-900 hover:underline"
                >
                  {servico.id === 'grupo-de-compras' ? 'Ver grupos de compra →' : 'Ir para a loja →'}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default Servicos
