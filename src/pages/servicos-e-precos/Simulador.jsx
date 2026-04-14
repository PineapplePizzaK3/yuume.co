import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { LOCALE_EN } from '../../lib/localeRoutes'
import { formatJpyForSite } from '../../lib/moneyDisplay'
import { getFxBrlPerJpy, getFxUsdPerJpy, jpyToApproxUsd, jpyToBrl, refreshFxRate } from '../../lib/fx'
import { calcularFreteEMS } from '../../data/tabelaFreteEMS'
import { calcularFreteParcel, calcularFreteEPacket } from '../../data/fretesJPPost'
import {
  BRAZIL_STATE_UFS,
  ICMS_INTERNAL_RATE_BY_STATE_2026,
  ICMS_REFERENCE_LABEL,
} from '../../data/icmsImportRates'
import {
  SERVICE_FEE_JPY_PER_ITEM,
  computeRedirecionamentoPadraoFeeJpy,
  REDIR_ASSISTIDO_FEE_PERCENT,
} from '../../data/serviceFees'

function CollapsibleSection({ title, open, onOpenChange, className, children }) {
  return (
    <details
      className={`group rounded-lg border shadow-sm ${className}`}
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold text-earth-900">{title}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-earth-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-earth-200 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">{children}</div>
    </details>
  )
}

/**
 * Simulador de pedidos - sub-página de Serviços e Preços.
 */
function Simulador() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const numberLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'
  const monetaryLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'

  const formatarValor = (valor) => formatJpyForSite(siteLocale, valor, null)
  const formatarBrl = (valor) =>
    Number(valor || 0).toLocaleString(monetaryLocale, { style: 'currency', currency: 'BRL' })
  const formatarPercentual = (valor) =>
    `${Number(valor || 0).toLocaleString(numberLocale, { maximumFractionDigits: 2 })}%`

  useEffect(() => {
    void refreshFxRate()
  }, [])

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
  /** brasil: Japan Post internacional | jp_warehouse: nosso endereço JP (sem frete nesta etapa) | jp_temp: endereço temporário do usuário no JP */
  const [destinoEnvio, setDestinoEnvio] = useState('brasil')
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [peso, setPeso] = useState('')
  const [valor, setValor] = useState('')
  const [ufDestino, setUfDestino] = useState('SP')
  const [modeloTributario, setModeloTributario] = useState('remessa')
  const [iiPercentFormal, setIiPercentFormal] = useState('20')
  const [ipiPercentFormal, setIpiPercentFormal] = useState('0')
  const [pisPercentFormal, setPisPercentFormal] = useState('2.1')
  const [cofinsPercentFormal, setCofinsPercentFormal] = useState('9.65')
  const [openSections, setOpenSections] = useState({
    form: true,
    products: true,
    shipping: true,
    totals: true,
    customs: true,
  })

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

  const obterFreteBrasil = () => {
    if (tipoFreteEfetivo === 'ems') return calcularFreteEMS(pesoTotalGramas)
    if (tipoFreteEfetivo === 'parcel-aereo')
      return calcularFreteParcel(pesoTotalGramas, 'aereo')
    if (tipoFreteEfetivo === 'epacket') return calcularFreteEPacket(pesoTotalGramas)
    return calcularFreteEMS(pesoTotalGramas)
  }
  const freteBrasil = obterFreteBrasil()
  const freteNoTotal =
    destinoEnvio === 'brasil' ? freteBrasil : 0
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

  const totalFinal = totalProdutos + freteNoTotal + taxaServico
  const totalBaseBrl = jpyToBrl(totalFinal)
  const totalBaseUsdAprox = jpyToApproxUsd(totalFinal)
  const fxBrlPerJpy = getFxBrlPerJpy()
  const fxUsdPerJpy = getFxUsdPerJpy()
  const fxBrlPerUsd = fxUsdPerJpy > 0 ? fxBrlPerJpy / fxUsdPerJpy : 0
  const aliqIcmsPercent = ICMS_INTERNAL_RATE_BY_STATE_2026[ufDestino] ?? 17
  const aliqIcms = aliqIcmsPercent / 100

  const iiFormal = Number(iiPercentFormal.replace(',', '.')) || 0
  const ipiFormal = Number(ipiPercentFormal.replace(',', '.')) || 0
  const pisFormal = Number(pisPercentFormal.replace(',', '.')) || 0
  const cofinsFormal = Number(cofinsPercentFormal.replace(',', '.')) || 0

  let iiBrl = 0
  let ipiBrl = 0
  let pisBrl = 0
  let cofinsBrl = 0

  if (modeloTributario === 'formal') {
    iiBrl = totalBaseBrl * (iiFormal / 100)
    ipiBrl = (totalBaseBrl + iiBrl) * (ipiFormal / 100)
    pisBrl = totalBaseBrl * (pisFormal / 100)
    cofinsBrl = totalBaseBrl * (cofinsFormal / 100)
  } else {
    const deducaoUsd = totalBaseUsdAprox > 50 ? 20 : 0
    const deducaoBrl = deducaoUsd * fxBrlPerUsd
    const aliquotaIi = totalBaseUsdAprox > 50 ? 0.6 : 0.2
    iiBrl = Math.max(totalBaseBrl * aliquotaIi - deducaoBrl, 0)
  }

  const totalTributosFederaisBrl = iiBrl + ipiBrl + pisBrl + cofinsBrl
  const baseSemIcmsBrl = totalBaseBrl + totalTributosFederaisBrl
  const icmsBrl = aliqIcms > 0 ? (baseSemIcmsBrl / (1 - aliqIcms)) * aliqIcms : 0
  const totalTributosBrl = totalTributosFederaisBrl + icmsBrl
  const totalComTributosBrl = totalBaseBrl + totalTributosBrl

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

        <CollapsibleSection
          className="mt-8 border-earth-200 bg-earth-100"
          title={t('publicSimulador.addProduct')}
          open={openSections.form}
          onOpenChange={(v) => setOpenSections((o) => ({ ...o, form: v }))}
        >
          <form onSubmit={adicionarProduto} className="space-y-4">
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
            className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 transition hover:bg-earth-800 sm:w-auto sm:min-w-[140px]"
          >
            {t('publicSimulador.addBtn')}
          </button>
        </form>
        </CollapsibleSection>

        {produtos.length > 0 && (
          <div className="mt-8 space-y-6">
            <CollapsibleSection
              className="border-earth-200 bg-earth-100"
              title={t('publicSimulador.productsHeading', { count: produtos.length })}
              open={openSections.products}
              onOpenChange={(v) => setOpenSections((o) => ({ ...o, products: v }))}
            >
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
            </CollapsibleSection>

            <CollapsibleSection
              className="border-earth-200 bg-earth-50"
              title={t('publicSimulador.shippingTitle')}
              open={openSections.shipping}
              onOpenChange={(v) => setOpenSections((o) => ({ ...o, shipping: v }))}
            >
              <fieldset>
                <legend className="block text-sm font-medium text-earth-700">
                  {t('publicSimulador.destinoLabel')}
                </legend>
                <div className="mt-2 space-y-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      destinoEnvio === 'brasil' ? 'border-earth-900 bg-earth-50' : 'border-earth-200 bg-white hover:bg-earth-50/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destinoEnvio"
                      value="brasil"
                      checked={destinoEnvio === 'brasil'}
                      onChange={() => setDestinoEnvio('brasil')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-earth-900">{t('publicSimulador.destinoBrasil')}</span>
                      <span className="mt-0.5 block text-sm text-earth-600">{t('publicSimulador.destinoBrasilHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      destinoEnvio === 'jp_warehouse'
                        ? 'border-earth-900 bg-earth-50'
                        : 'border-earth-200 bg-white hover:bg-earth-50/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destinoEnvio"
                      value="jp_warehouse"
                      checked={destinoEnvio === 'jp_warehouse'}
                      onChange={() => setDestinoEnvio('jp_warehouse')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-earth-900">{t('publicSimulador.destinoJpWarehouse')}</span>
                      <span className="mt-0.5 block text-sm text-earth-600">{t('publicSimulador.destinoJpWarehouseHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      destinoEnvio === 'jp_temp'
                        ? 'border-earth-900 bg-earth-50'
                        : 'border-earth-200 bg-white hover:bg-earth-50/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destinoEnvio"
                      value="jp_temp"
                      checked={destinoEnvio === 'jp_temp'}
                      onChange={() => setDestinoEnvio('jp_temp')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-earth-900">{t('publicSimulador.destinoJpTemp')}</span>
                      <span className="mt-0.5 block text-sm text-earth-600">{t('publicSimulador.destinoJpTempHint')}</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {destinoEnvio === 'brasil' && (
                <div className="mt-5">
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
              )}

              {destinoEnvio === 'brasil' && (
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold text-earth-900">
                    {formatarValor(freteBrasil)}
                  </span>
                  <span className="text-sm text-earth-600">
                    ({freteLabel} • {pesoTotalGramas.toLocaleString(numberLocale)}g)
                  </span>
                  {prazoEntrega && (
                    <span className="text-sm text-earth-600">• {prazoEntrega}</span>
                  )}
                </div>
              )}

              {destinoEnvio === 'jp_warehouse' && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold text-earth-900">{formatarValor(0)}</span>
                    <span className="text-sm text-earth-600">{t('publicSimulador.jpWarehouseFreteNote')}</span>
                  </div>
                  <p className="mt-3 text-sm text-earth-600">{t('publicSimulador.jpWarehouseBody')}</p>
                </div>
              )}

              {destinoEnvio === 'jp_temp' && (
                <div className="mt-5">
                  <p className="text-lg font-semibold text-earth-900">{t('publicSimulador.jpTempFreteTbd')}</p>
                  <p className="mt-2 text-sm text-earth-600">{t('publicSimulador.jpTempBody')}</p>
                </div>
              )}

              {destinoEnvio === 'brasil' && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">
                    <strong>{t('publicSimulador.estimateBold')}</strong>{' '}
                    {t('publicSimulador.estimateRest')}
                  </p>
                </div>
              )}
              {destinoEnvio !== 'brasil' && (
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm text-sky-950">
                    <strong>{t('publicSimulador.jpEstimateBold')}</strong>{' '}
                    {t('publicSimulador.jpEstimateRest')}
                  </p>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              className="border-earth-200 bg-earth-100"
              title={t('publicSimulador.totalsTitle')}
              open={openSections.totals}
              onOpenChange={(v) => setOpenSections((o) => ({ ...o, totals: v }))}
            >
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
                  <span>
                    {destinoEnvio === 'brasil' && t('publicSimulador.shippingLine')}
                    {destinoEnvio === 'jp_warehouse' && t('publicSimulador.shippingLineJpWarehouse')}
                    {destinoEnvio === 'jp_temp' && t('publicSimulador.shippingLineJpTemp')}
                  </span>
                  <span className="text-right">
                    {destinoEnvio === 'brasil' && formatarValor(freteBrasil)}
                    {destinoEnvio === 'jp_warehouse' && formatarValor(0)}
                    {destinoEnvio === 'jp_temp' && (
                      <span className="font-medium text-earth-600">{t('publicSimulador.shippingAmountTbd')}</span>
                    )}
                  </span>
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
            </CollapsibleSection>

            <CollapsibleSection
              className="border-earth-200 bg-earth-50"
              title={t('publicSimulador.customsTitle')}
              open={openSections.customs}
              onOpenChange={(v) => setOpenSections((o) => ({ ...o, customs: v }))}
            >
              {destinoEnvio !== 'brasil' ? (
                <p className="text-sm text-earth-700">{t('publicSimulador.customsJapanNote')}</p>
              ) : (
                <>
              <p className="mb-5 text-sm text-earth-600">{t('publicSimulador.customsSubtitle')}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="modeloTributario"
                    className="block text-sm font-medium text-earth-700"
                  >
                    {t('publicSimulador.taxModelLabel')}
                  </label>
                  <select
                    id="modeloTributario"
                    value={modeloTributario}
                    onChange={(e) => setModeloTributario(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                  >
                    <option value="remessa">{t('publicSimulador.taxModelRemessa')}</option>
                    <option value="formal">{t('publicSimulador.taxModelFormal')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ufDestino" className="block text-sm font-medium text-earth-700">
                    {t('publicSimulador.ufLabel')}
                  </label>
                  <select
                    id="ufDestino"
                    value={ufDestino}
                    onChange={(e) => setUfDestino(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                  >
                    {BRAZIL_STATE_UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-earth-500">
                    {t('publicSimulador.icmsRefSource', { source: ICMS_REFERENCE_LABEL })}
                  </p>
                </div>
              </div>

              {modeloTributario === 'formal' && (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <label htmlFor="iiPercent" className="block text-sm font-medium text-earth-700">
                      {t('publicSimulador.iiPercent')}
                    </label>
                    <input
                      id="iiPercent"
                      type="text"
                      inputMode="decimal"
                      value={iiPercentFormal}
                      onChange={(e) => setIiPercentFormal(e.target.value.replace(/[^0-9,.]/g, ''))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="ipiPercent" className="block text-sm font-medium text-earth-700">
                      {t('publicSimulador.ipiPercent')}
                    </label>
                    <input
                      id="ipiPercent"
                      type="text"
                      inputMode="decimal"
                      value={ipiPercentFormal}
                      onChange={(e) => setIpiPercentFormal(e.target.value.replace(/[^0-9,.]/g, ''))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="pisPercent" className="block text-sm font-medium text-earth-700">
                      {t('publicSimulador.pisPercent')}
                    </label>
                    <input
                      id="pisPercent"
                      type="text"
                      inputMode="decimal"
                      value={pisPercentFormal}
                      onChange={(e) => setPisPercentFormal(e.target.value.replace(/[^0-9,.]/g, ''))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cofinsPercent"
                      className="block text-sm font-medium text-earth-700"
                    >
                      {t('publicSimulador.cofinsPercent')}
                    </label>
                    <input
                      id="cofinsPercent"
                      type="text"
                      inputMode="decimal"
                      value={cofinsPercentFormal}
                      onChange={(e) =>
                        setCofinsPercentFormal(e.target.value.replace(/[^0-9,.]/g, ''))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between text-earth-700">
                  <span>{t('publicSimulador.baseJapanLine')}</span>
                  <span>{formatarValor(totalFinal)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>{t('publicSimulador.baseBrlLine')}</span>
                  <span>{formatarBrl(totalBaseBrl)}</span>
                </div>
                <div className="flex justify-between text-earth-700">
                  <span>{t('publicSimulador.iiLine')}</span>
                  <span>{formatarBrl(iiBrl)}</span>
                </div>
                {modeloTributario === 'formal' && (
                  <>
                    <div className="flex justify-between text-earth-700">
                      <span>{t('publicSimulador.ipiLine')}</span>
                      <span>{formatarBrl(ipiBrl)}</span>
                    </div>
                    <div className="flex justify-between text-earth-700">
                      <span>{t('publicSimulador.pisLine')}</span>
                      <span>{formatarBrl(pisBrl)}</span>
                    </div>
                    <div className="flex justify-between text-earth-700">
                      <span>{t('publicSimulador.cofinsLine')}</span>
                      <span>{formatarBrl(cofinsBrl)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-earth-700">
                  <span>
                    {t('publicSimulador.icmsLine', {
                      uf: ufDestino,
                      rate: formatarPercentual(aliqIcmsPercent),
                    })}
                  </span>
                  <span>{formatarBrl(icmsBrl)}</span>
                </div>
                <div className="flex justify-between border-t border-earth-200 pt-3 font-medium text-earth-800">
                  <span>{t('publicSimulador.totalTaxesLine')}</span>
                  <span>{formatarBrl(totalTributosBrl)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-earth-900">
                  <span>{t('publicSimulador.totalWithTaxesLine')}</span>
                  <span>{formatarBrl(totalComTributosBrl)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>
                  <strong>{t('publicSimulador.taxDisclaimerBold')}</strong>{' '}
                  {t('publicSimulador.taxDisclaimerText')}
                </p>
              </div>
                </>
              )}
            </CollapsibleSection>
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
