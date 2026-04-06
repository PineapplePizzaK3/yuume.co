import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { LOCALE_EN } from '../../lib/localeRoutes'
import { formatJpyForSite } from '../../lib/moneyDisplay'
import { calcularFreteEMS } from '../../data/tabelaFreteEMS'
import { calcularFreteParcel, calcularFreteEPacket } from '../../data/fretesJPPost'
import {
  SERVICE_FEE_JPY_PER_ITEM,
  computeRedirecionamentoPadraoFeeJpy,
  REDIR_ASSISTIDO_FEE_PERCENT,
} from '../../data/serviceFees'

/**
 * Simulador de pedidos - sub-página de Serviços e Preços.
 */
function Simulador() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const numberLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'

  const formatarValor = (valor) => formatJpyForSite(siteLocale, valor, null)

  const SERVICOS = useMemo(
    () => [
      {
        id: 'redirecionamento-padrao',
        label: t('publicSimulador.svcRedirPadrao'),
        tipo: 'redir-padrao',
      },
      {
        id: 'redirecionamento-assistido',
        label: t('publicSimulador.svcRedirAssistido'),
        tipo: 'redir-assistido',
      },
      {
        id: 'personal-shopping',
        label: t('publicSimulador.svcPS'),
        tipo: 'percentual',
        percentual: 25,
      },
      {
        id: 'grupo-compras',
        label: t('publicSimulador.svcGrupo'),
        tipo: 'percentual',
        percentual: 20,
      },
    ],
    [t],
  )

  const TIPOS_FRETE = useMemo(
    () => [
      {
        id: 'ems',
        label: t('publicSimulador.shipEms'),
        prazo: t('publicSimulador.shipEmsEta'),
      },
      {
        id: 'parcel-aereo',
        label: t('publicSimulador.shipParcel'),
        prazo: t('publicSimulador.shipParcelEta'),
      },
      {
        id: 'epacket',
        label: t('publicSimulador.shipEpacket'),
        prazo: t('publicSimulador.shipEpacketEta'),
      },
    ],
    [t],
  )

  const [produtos, setProdutos] = useState([])
  const [servicoId, setServicoId] = useState('redirecionamento-padrao')
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
    0,
  )
  const pesoTotalGramas = produtos.reduce(
    (acc, p) => acc + p.quantidade * p.peso,
    0,
  )

  const tiposFreteDisponiveis =
    pesoTotalGramas > 2000
      ? TIPOS_FRETE.filter((tf) => tf.id !== 'epacket')
      : TIPOS_FRETE
  const tipoFreteEfetivo = tiposFreteDisponiveis.some((tf) => tf.id === tipoFrete)
    ? tipoFrete
    : 'ems'

  const obterFrete = () => {
    if (tipoFreteEfetivo === 'ems') return calcularFreteEMS(pesoTotalGramas)
    if (tipoFreteEfetivo === 'parcel-aereo')
      return calcularFreteParcel(pesoTotalGramas, 'aereo')
    if (tipoFreteEfetivo === 'epacket') return calcularFreteEPacket(pesoTotalGramas)
    return calcularFreteEMS(pesoTotalGramas)
  }
  const frete = obterFrete()
  const tipoFreteSelecionado = tiposFreteDisponiveis.find(
    (tf) => tf.id === tipoFreteEfetivo,
  )
  const freteLabel = tipoFreteSelecionado?.label ?? t('publicSimulador.shipEms')
  const prazoEntrega = tipoFreteSelecionado?.prazo ?? ''
  const totalItens = produtos.reduce((acc, p) => acc + p.quantidade, 0)
  const servico = SERVICOS.find((s) => s.id === servicoId)

  let taxaServico = 0
  let labelTaxaServico = ''
  if (servico?.tipo === 'redir-padrao') {
    taxaServico = computeRedirecionamentoPadraoFeeJpy(totalItens)
    labelTaxaServico = t('publicSimulador.labelFeeRedirPadrao')
  } else if (servico?.tipo === 'redir-assistido') {
    taxaServico =
      totalProdutos * (REDIR_ASSISTIDO_FEE_PERCENT / 100) +
      computeRedirecionamentoPadraoFeeJpy(totalItens)
    labelTaxaServico = t('publicSimulador.labelFeeRedirAssistido', {
      pct: REDIR_ASSISTIDO_FEE_PERCENT,
    })
  } else if (servico?.tipo === 'percentual') {
    const pct = servico?.percentual ?? 25
    taxaServico = totalProdutos * (pct / 100) + totalItens * SERVICE_FEE_JPY_PER_ITEM
    labelTaxaServico = t('publicSimulador.labelFeePercent', {
      pct,
      perItem: SERVICE_FEE_JPY_PER_ITEM,
    })
  }

  const totalFinal = totalProdutos + frete + taxaServico

  return (
    <>
      <PageSeo
        routeKey="servicosSimulador"
        title={t('meta.simulador.title')}
        description={t('meta.simulador.description')}
      />

      <div className="pt-8">
        <h2 className="text-2xl font-bold text-earth-900 sm:text-3xl">
          {t('publicSimulador.title')}
        </h2>
        <p className="mt-2 text-earth-600">{t('publicSimulador.subtitle')}</p>

        <form
          onSubmit={adicionarProduto}
          className="mt-8 rounded-lg border border-earth-200 bg-earth-100 p-4 sm:p-6"
        >
          <h3 className="mb-4 text-lg font-semibold text-earth-900">
            {t('publicSimulador.addProduct')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-earth-700"
              >
                {t('publicSimulador.productName')}
              </label>
              <input
                type="text"
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder={t('publicSimulador.productNamePh')}
              />
            </div>
            <div>
              <label
                htmlFor="quantidade"
                className="block text-sm font-medium text-earth-700"
              >
                {t('publicSimulador.qty')}
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
                {t('publicSimulador.weightG')}
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="peso"
                value={peso}
                onChange={(e) => setPeso(e.target.value.replace(/[^0-9,.]/g, ''))}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder={t('publicSimulador.weightPh')}
              />
            </div>
            <div>
              <label
                htmlFor="valor"
                className="block text-sm font-medium text-earth-700"
              >
                {t('publicSimulador.valueYen')}
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
                placeholder={t('publicSimulador.valuePh')}
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 transition hover:bg-earth-800 sm:w-auto sm:min-w-[140px]"
          >
            {t('publicSimulador.addBtn')}
          </button>
        </form>

        {produtos.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold text-earth-900">
              {t('publicSimulador.productsHeading', { count: produtos.length })}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-earth-200">
              <table className="min-w-full divide-y divide-earth-200">
                <thead className="bg-earth-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-earth-600">
                      {t('publicSimulador.thProduct')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-earth-600">
                      {t('publicSimulador.thQty')}
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase text-earth-600 sm:table-cell">
                      {t('publicSimulador.thWeight')}
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase text-earth-600 sm:table-cell">
                      {t('publicSimulador.thValue')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-earth-600">
                      {t('publicSimulador.thSubtotal')}
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
                        {p.peso.toLocaleString(numberLocale)}g
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
                          aria-label={t('publicSimulador.removeAria', { name: p.nome })}
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

            <div className="mt-8 rounded-lg border border-earth-200 bg-earth-50 p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-earth-900">
                {t('publicSimulador.shippingTitle')}
              </h3>

              <div>
                <label htmlFor="tipoFrete" className="block text-sm font-medium text-earth-700">
                  {t('publicSimulador.shippingType')}
                </label>
                <select
                  id="tipoFrete"
                  value={tipoFreteEfetivo}
                  onChange={(e) => setTipoFrete(e.target.value)}
                  className="mt-1 block w-full max-w-xs rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                >
                  {tiposFreteDisponiveis.map((tf) => (
                    <option key={tf.id} value={tf.id}>
                      {tf.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-earth-900">
                  {formatarValor(frete)}
                </span>
                <span className="text-sm text-earth-600">
                  ({freteLabel} • {pesoTotalGramas.toLocaleString(numberLocale)}g)
                </span>
                {prazoEntrega && (
                  <span className="text-sm text-earth-600">• {prazoEntrega}</span>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  <strong>{t('publicSimulador.estimateBold')}</strong>{' '}
                  {t('publicSimulador.estimateRest')}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-earth-900">
                {t('publicSimulador.totalsTitle')}
              </h3>

              <div className="mb-6">
                <label htmlFor="servico" className="block text-sm font-medium text-earth-700">
                  {t('publicSimulador.serviceLabel')}
                </label>
                <select
                  id="servico"
                  value={servicoId}
                  onChange={(e) => setServicoId(e.target.value)}
                  className="mt-1 block w-full max-w-xs rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                >
                  {SERVICOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.percentual != null ? ` (${s.percentual}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-earth-700">
                  <span>{t('publicSimulador.subtotalProducts')}</span>
                  <span>{formatarValor(totalProdutos)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>{t('publicSimulador.shippingLine')}</span>
                  <span>{formatarValor(frete)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>{labelTaxaServico}</span>
                  <span>{formatarValor(taxaServico)}</span>
                </div>
                <div className="flex justify-between border-t border-earth-200 pt-4 text-lg font-bold text-earth-900">
                  <span>{t('publicSimulador.total')}</span>
                  <span>{formatarValor(totalFinal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {produtos.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-earth-300 bg-earth-100 p-8 text-center text-earth-600">
            {t('publicSimulador.empty')}
          </p>
        )}
      </div>
    </>
  )
}

export default Simulador
