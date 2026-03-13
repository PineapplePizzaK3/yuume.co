import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { calcularFreteEMS } from '../../data/tabelaFreteEMS'
import { calcularFreteParcel, calcularFreteEPacket } from '../../data/fretesJPPost'

/** Taxa por item para redirecionamento: 1→900, 2→750, 3–4→600, 5+→500. */
function calcularTaxaRedirecionamento(totalItens) {
  if (totalItens <= 0) return 0
  if (totalItens === 1) return 900
  if (totalItens === 2) return 750 * 2
  if (totalItens <= 4) return 600 * totalItens
  return 500 * totalItens
}

const TAXA_POR_ITEM_PERSONAL = 150
const SERVICOS = [
  { id: 'redirecionamento', label: 'Redirecionamento', tipo: 'por-itens' },
  { id: 'personal-shopping', label: 'Personal shopping', percentual: 20 },
]
const TIPOS_FRETE = [
  { id: 'ems', label: 'EMS', prazo: '5–10 dias úteis' },
  { id: 'parcel-aereo', label: 'Parcel Post (via aérea)', prazo: '7–15 dias' },
  { id: 'parcel-maritimo', label: 'Parcel Post (via marítima)', prazo: '45–90 dias' },
  { id: 'epacket', label: 'ePacket Light (até 2 kg)', prazo: '5–21 dias úteis' },
]

/**
 * Formata valor para exibição (com separador de milhar).
 */
function formatarValor(valor, moeda = '¥') {
  return `${moeda} ${Number(valor).toLocaleString('pt-BR')}`
}

/**
 * Simulador de pedidos - sub-página de Serviços e Preços.
 */
function Simulador() {
  const [produtos, setProdutos] = useState([])
  const [servicoId, setServicoId] = useState('redirecionamento')
  const [tipoFrete, setTipoFrete] = useState('ems')
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [peso, setPeso] = useState('')
  const [valor, setValor] = useState('')

  const adicionarProduto = (e) => {
    e.preventDefault()
    const qty = Math.max(1, parseInt(quantidade, 10) || 1)
    const pesoNum = parseFloat(peso?.replace(',', '.')) || 0
    const valorNum = parseFloat(valor?.replace(',', '.')) || 0
    if (!nome.trim() || qty < 1 || pesoNum <= 0 || valorNum <= 0) return
    setProdutos([
      ...produtos,
      {
        id: crypto.randomUUID(),
        nome: nome.trim(),
        quantidade: qty,
        peso: pesoNum,
        valor: valorNum,
      },
    ])
    setNome('')
    setQuantidade('1')
    setPeso('')
    setValor('')
  }

  const removerProduto = (id) => {
    setProdutos(produtos.filter((p) => p.id !== id))
  }

  const totalProdutos = produtos.reduce(
    (acc, p) => acc + p.quantidade * p.valor,
    0
  )
  const pesoTotalGramas = produtos.reduce(
    (acc, p) => acc + p.quantidade * p.peso,
    0
  )

  const tiposFreteDisponiveis =
    pesoTotalGramas > 2000
      ? TIPOS_FRETE.filter((t) => t.id !== 'epacket')
      : TIPOS_FRETE
  const tipoFreteEfetivo = tiposFreteDisponiveis.some((t) => t.id === tipoFrete)
    ? tipoFrete
    : 'ems'

  const obterFrete = () => {
    if (tipoFreteEfetivo === 'ems') return calcularFreteEMS(pesoTotalGramas)
    if (tipoFreteEfetivo === 'parcel-aereo') return calcularFreteParcel(pesoTotalGramas, 'aereo')
    if (tipoFreteEfetivo === 'parcel-maritimo') return calcularFreteParcel(pesoTotalGramas, 'maritimo')
    if (tipoFreteEfetivo === 'epacket') return calcularFreteEPacket(pesoTotalGramas)
    return calcularFreteEMS(pesoTotalGramas)
  }
  const frete = obterFrete()
  const tipoFreteSelecionado = tiposFreteDisponiveis.find((t) => t.id === tipoFreteEfetivo)
  const freteLabel = tipoFreteSelecionado?.label ?? 'EMS'
  const prazoEntrega = tipoFreteSelecionado?.prazo ?? ''
  const totalItens = produtos.reduce((acc, p) => acc + p.quantidade, 0)
  const servico = SERVICOS.find((s) => s.id === servicoId)
  const taxaServico =
    servico?.tipo === 'por-itens'
      ? calcularTaxaRedirecionamento(totalItens)
      : totalProdutos * ((servico?.percentual ?? 20) / 100) +
        totalItens * TAXA_POR_ITEM_PERSONAL
  const totalFinal = totalProdutos + frete + taxaServico
  const labelTaxaServico =
    servico?.tipo === 'por-itens'
      ? 'Taxa de serviço (por itens)'
      : `Taxa de serviço (${servico?.percentual ?? 20}% + ¥${TAXA_POR_ITEM_PERSONAL}/item)`

  return (
    <>
      <Helmet>
        <title>Simulador de pedidos | Serviços e Preços | Delivery</title>
        <meta
          name="description"
          content="Simule o valor final do seu pedido com frete EMS e taxa de serviço."
        />
      </Helmet>

      <div className="pt-8">
        <h2 className="text-2xl font-bold text-earth-900 sm:text-3xl">
          Simulador de pedidos
        </h2>
        <p className="mt-2 text-earth-600">
          Adicione produtos para calcular o valor total. Escolha o serviço e o
          tipo de frete na seção de valores finais.
        </p>

        {/* Formulário para adicionar produto */}
        <form
          onSubmit={adicionarProduto}
          className="mt-8 rounded-lg border border-earth-200 bg-earth-100 p-4 sm:p-6"
        >
          <h3 className="mb-4 text-lg font-semibold text-earth-900">
            Adicionar produto
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-earth-700"
              >
                Nome do produto
              </label>
              <input
                type="text"
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="Ex: Tênis Nike"
              />
            </div>
            <div>
              <label
                htmlFor="quantidade"
                className="block text-sm font-medium text-earth-700"
              >
                Quantidade
              </label>
              <input
                type="number"
                id="quantidade"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                onBlur={(e) => {
                  const parsed = parseInt(e.target.value, 10)
                  if (Number.isNaN(parsed) || parsed < 1) setQuantidade('1')
                }}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
              />
            </div>
            <div>
              <label
                htmlFor="peso"
                className="block text-sm font-medium text-earth-700"
              >
                Peso (g)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="peso"
                value={peso}
                onChange={(e) => setPeso(e.target.value.replace(/[^0-9,.]/g, ''))}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="Ex: 350"
              />
            </div>
            <div>
              <label
                htmlFor="valor"
                className="block text-sm font-medium text-earth-700"
              >
                Valor (¥)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="valor"
                value={valor}
                onChange={(e) =>
                  setValor(e.target.value.replace(/[^0-9,.]/g, ''))
                }
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="Ex: 5000"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 transition hover:bg-earth-800 sm:w-auto sm:min-w-[140px]"
          >
            Adicionar produto
          </button>
        </form>

        {/* Lista de produtos */}
        {produtos.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold text-earth-900">
              Produtos ({produtos.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-earth-200">
              <table className="min-w-full divide-y divide-earth-200">
                <thead className="bg-earth-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-earth-600">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-earth-600">
                      Qtd
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase text-earth-600 sm:table-cell">
                      Peso (g)
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase text-earth-600 sm:table-cell">
                      Valor (¥)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-earth-600">
                      Subtotal
                    </th>
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-earth-200 bg-earth-100">
                  {produtos.map((p) => (
                    <tr key={p.id} className="hover:bg-earth-200">
                      <td className="px-4 py-3 text-sm text-earth-900">
                        {p.nome}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-earth-700">
                        {p.quantidade}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-sm text-earth-700 sm:table-cell">
                        {p.peso.toLocaleString('pt-BR')}g
                      </td>
                      <td className="hidden px-4 py-3 text-right text-sm text-earth-700 sm:table-cell">
                        {formatarValor(p.valor)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-earth-900">
                        {formatarValor(p.quantidade * p.valor)}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => removerProduto(p.id)}
                          className="rounded p-2 text-earth-500 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remover ${p.nome}`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumo do pedido - com escolha de serviço e frete */}
            <div className="mt-8 rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-earth-900">
                Valores finais
              </h3>

              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="servico" className="block text-sm font-medium text-earth-700">
                    Serviço
                  </label>
                  <select
                    id="servico"
                    value={servicoId}
                    onChange={(e) => setServicoId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                  >
                    {SERVICOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                        {s.percentual != null ? ` (${s.percentual}%)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tipoFrete" className="block text-sm font-medium text-earth-700">
                    Tipo de frete
                  </label>
                  <select
                    id="tipoFrete"
                    value={tipoFreteEfetivo}
                    onChange={(e) => setTipoFrete(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                  >
                    {tiposFreteDisponiveis.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-earth-700">
                  <span>Subtotal dos produtos</span>
                  <span>{formatarValor(totalProdutos)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>
                    Frete {freteLabel} ({pesoTotalGramas.toLocaleString('pt-BR')}g)
                  </span>
                  <span>{formatarValor(frete)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>{labelTaxaServico}</span>
                  <span>{formatarValor(taxaServico)}</span>
                </div>
                {prazoEntrega && (
                  <div className="text-earth-600 text-sm">
                    <span>Prazo médio de entrega: </span>
                    <span>{prazoEntrega}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-earth-200 pt-4 text-lg font-bold text-earth-900">
                  <span>Total</span>
                  <span>{formatarValor(totalFinal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {produtos.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-earth-300 bg-earth-100 p-8 text-center text-earth-600">
            Nenhum produto adicionado. Preencha o formulário acima para
            começar a simular.
          </p>
        )}
      </div>
    </>
  )
}

export default Simulador
