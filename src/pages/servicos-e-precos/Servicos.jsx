import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { formatJpyForSite } from '../../lib/moneyDisplay'
import {
  PERSONAL_SHOPPING_FEE_PERCENT,
  SERVICE_FEE_JPY_PER_ITEM,
  GRUPO_COMPRAS_FEE_PERCENT,
} from '../../data/serviceFees'

/** @typedef {{ id: string, prefix: string, stepCount: number, pricingKey: string, variant?: 'redir', tabela?: { percentual?: number, porItem?: number | null, freteKey?: string, modoLoja?: boolean } }} ServiceFlowDef */

/** @type {ServiceFlowDef[]} */
const SERVICE_FLOWS = [
  {
    id: 'redirecionamento',
    prefix: 'flowRedir',
    stepCount: 5,
    pricingKey: 'pricingRedir',
    variant: 'redir',
  },
  {
    id: 'personal-shopping',
    prefix: 'flowPS',
    stepCount: 6,
    pricingKey: 'pricingPS',
    tabela: { percentual: PERSONAL_SHOPPING_FEE_PERCENT, porItem: null, freteKey: 'afterConsolidation' },
  },
  {
    id: 'grupo-de-compras',
    prefix: 'flowGrupo',
    stepCount: 5,
    pricingKey: 'pricingGrupo',
    tabela: { percentual: GRUPO_COMPRAS_FEE_PERCENT, porItem: SERVICE_FEE_JPY_PER_ITEM, freteKey: 'afterShipRequest' },
  },
  {
    id: 'loja-virtual',
    prefix: 'flowLoja',
    stepCount: 5,
    pricingKey: 'pricingLoja',
    tabela: { modoLoja: true, freteKey: 'afterShipRequest' },
  },
]

/**
 * @param {object} p
 * @param {import('react-i18next').TFunction} p.t
 * @param {(n: number) => string} p.formatarIene
 * @param {number | null} [p.percentual]
 * @param {number | null} [p.porItem]
 * @param {string} [p.freteTexto]
 * @param {boolean} [p.modoRedirecionamento]
 * @param {boolean} [p.modoLoja]
 */
function TabelaValores({
  t,
  formatarIene,
  percentual,
  porItem,
  freteTexto,
  modoRedirecionamento,
  modoLoja,
}) {
  const linhasSimples =
    !modoRedirecionamento && !modoLoja
      ? [
          {
            label: t('publicServicos.linePercentPurchase'),
            valor:
              percentual === null
                ? t('publicServicos.valueOnRequest')
                : `${percentual}%`,
          },
          ...(porItem == null
            ? []
            : [
                {
                  label: t('publicServicos.linePerItem'),
                  valor: `${formatarIene(porItem)}/item`,
                },
              ]),
          {
            label: t('publicServicos.lineIntlShipping'),
            valor: freteTexto ?? '',
          },
        ]
      : modoLoja
        ? [
            {
              label: t('publicServicos.productPrice'),
              valor: t('publicServicos.perCatalog'),
            },
            {
              label: t('publicServicos.lineIntlShipping'),
              valor:
                freteTexto || t('publicServicos.afterShipRequest'),
            },
          ]
        : null

  const linhasRedir = modoRedirecionamento
    ? [
        {
          componente: t('publicServicos.rowServiceFee'),
          padrao: t('publicServicos.feeRedirStandard'),
          assistido: t('publicServicos.feeRedirAssisted'),
        },
        {
          componente: t('publicServicos.lineIntlShipping'),
          padrao: t('publicServicos.afterConsolidation'),
          assistido: t('publicServicos.afterConsolidation'),
        },
      ]
    : null

  if (modoRedirecionamento && linhasRedir) {
    return (
      <div className="mt-6 rounded-lg border border-earth-200 overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full divide-y divide-earth-200 min-w-[400px]">
            <thead className="bg-earth-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  {t('publicServicos.tableComponent')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  {t('publicServicos.fwdStandardCol')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                  {t('publicServicos.fwdAssistedCol')}
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
                  <span className="text-earth-500">{t('publicServicos.fwdStandardShort')}</span>{' '}
                  <span className="font-medium text-earth-900">{linha.padrao}</span>
                </div>
                <div className="text-sm">
                  <span className="text-earth-500">{t('publicServicos.fwdAssistedShort')}</span>{' '}
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
  if (!linhas) return null
  return (
    <div className="mt-6 rounded-lg border border-earth-200 overflow-hidden">
      <div className="hidden sm:block">
        <table className="w-full divide-y divide-earth-200">
          <thead className="bg-earth-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                {t('publicServicos.tableComponent')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
                {t('publicServicos.tableValue')}
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
 * Página Serviços - visão geral dos serviços com fluxos.
 * Sub-página de Serviços e Preços (index).
 */
function Servicos() {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const siteLocale = useSiteLocale()
  const formatarIene = (valor) => formatJpyForSite(siteLocale, valor, null)

  return (
    <>
      <PageSeo
        routeKey="servicosPrecos"
        title={t('meta.servicosPrecos.title')}
        description={t('meta.servicosPrecos.description')}
      />

      <div className="space-y-12">
        <p className="text-earth-600">
          {t('publicServicos.introBefore')}{' '}
          <Link
            to={lp('servicosFretes')}
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            {t('publicServicos.introLinkFretes')}
          </Link>
          {t('publicServicos.introMiddle')}{' '}
          <Link
            to={lp('servicosSimulador')}
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            {t('publicServicos.introLinkSim')}
          </Link>{' '}
          {t('publicServicos.introAfter')}
        </p>

        {SERVICE_FLOWS.map((servico) => {
          const titulo = t(`publicServicos.${servico.prefix}Title`)
          const descricao = t(`publicServicos.${servico.prefix}Desc`)
          const passos = Array.from({ length: servico.stepCount }, (_, i) =>
            t(`publicServicos.${servico.prefix}P${i}`),
          )
          const pricing = t(`publicServicos.${servico.pricingKey}`)

          return (
            <div
              key={servico.id}
              className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">{titulo}</h2>
              <p className="mt-2 text-earth-600">{descricao}</p>

              <ol className="mt-6 space-y-4">
                {passos.map((passo, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-earth-900 text-sm font-semibold text-earth-50">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-earth-700">{passo}</span>
                  </li>
                ))}
              </ol>

              {servico.variant === 'redir' && (
                <>
                  <p className="mt-6 text-sm text-earth-600">
                    <strong>{t('publicServicos.howWeCharge')}</strong> {pricing}
                  </p>
                  <TabelaValores
                    t={t}
                    formatarIene={formatarIene}
                    modoRedirecionamento
                  />
                </>
              )}

              {servico.tabela && !servico.tabela.modoLoja && (
                <>
                  <p className="mt-6 text-sm text-earth-600">
                    <strong>{t('publicServicos.howWeCharge')}</strong> {pricing}
                  </p>
                  <TabelaValores
                    t={t}
                    formatarIene={formatarIene}
                    percentual={servico.tabela.percentual ?? null}
                    porItem={servico.tabela.porItem ?? null}
                    freteTexto={
                      servico.tabela.freteKey
                        ? t(`publicServicos.${servico.tabela.freteKey}`)
                        : undefined
                    }
                  />
                </>
              )}

              {servico.tabela?.modoLoja && (
                <>
                  <p className="mt-6 text-sm text-earth-600">
                    <strong>{t('publicServicos.howWeCharge')}</strong> {pricing}
                  </p>
                  <TabelaValores
                    t={t}
                    formatarIene={formatarIene}
                    modoLoja
                    freteTexto={
                      servico.tabela.freteKey
                        ? t(`publicServicos.${servico.tabela.freteKey}`)
                        : undefined
                    }
                  />
                </>
              )}

              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  to={lp('servicosFretes')}
                  className="text-sm font-medium text-earth-900 hover:underline"
                >
                  {t('publicServicos.linkFretes')}
                </Link>
                {(servico.id === 'grupo-de-compras' || servico.id === 'loja-virtual') && (
                  <Link
                    to={servico.id === 'grupo-de-compras' ? lp('appLoja') : lp('lojaPublic')}
                    className="text-sm font-medium text-earth-900 hover:underline"
                  >
                    {servico.id === 'grupo-de-compras'
                      ? t('publicServicos.linkGrupos')
                      : t('publicServicos.linkLoja')}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default Servicos
