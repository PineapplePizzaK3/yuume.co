import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { LOCALE_EN } from '../../lib/localeRoutes'
import { formatJpyForSite } from '../../lib/moneyDisplay'
import { TABELA_FRETE_EMS } from '../../data/tabelaFreteEMS'
import {
  TABELA_PARCEL_AEREO,
  TABELA_EPACKET,
} from '../../data/fretesJPPost'

/**
 * @param {object} p
 * @param {Array<{ pesoMax: number, valor: number }>} p.tabela
 * @param {string} p.colunaPeso
 * @param {string} p.colunaTarifa
 * @param {string} p.upTo
 * @param {string} p.unidade
 * @param {(n: number) => string} p.formatarValor
 */
function TabelaFrete({ tabela, colunaPeso, colunaTarifa, upTo, unidade, formatarValor }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-earth-200">
      <table className="min-w-full divide-y divide-earth-200">
        <thead className="bg-earth-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
              {colunaPeso}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
              {colunaTarifa}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-earth-200 bg-earth-100">
          {tabela.map((faixa, i) => (
            <tr key={i} className="hover:bg-earth-200">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-earth-900">
                {upTo} {faixa.pesoMax}
                {unidade}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-earth-900">
                {formatarValor(faixa.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TAB_IDS = ['ems', 'parcel', 'epacket']

// Surface Mail (via marítima) foi removido do catálogo de opções.
const PARCEL_SUBTAB_IDS = ['aereo']

/**
 * Sub-página Fretes e Prazos - tipos de envio Japan Post com abas.
 */
function FretesEPrazos() {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const siteLocale = useSiteLocale()
  const numberLocale = siteLocale === LOCALE_EN ? 'en-US' : 'pt-BR'
  const formatarValor = (valor) => formatJpyForSite(siteLocale, valor, null)

  const [tabAtivo, setTabAtivo] = useState('ems')
  const [parcelSubtab, setParcelSubtab] = useState('aereo')

  const parcelTabelas = useMemo(
    () => ({
      aereo: TABELA_PARCEL_AEREO,
    }),
    [],
  )

  const tabs = useMemo(
    () =>
      TAB_IDS.map((id) => ({
        id,
        label:
          id === 'ems'
            ? t('publicSimulador.shipEms')
            : id === 'parcel'
              ? t('publicFretes.parcelTitle')
              : t('publicSimulador.shipEpacket'),
        badge:
          id === 'ems' || id === 'parcel'
            ? t('publicFretes.badge30')
            : t('publicFretes.badge2'),
      })),
    [t],
  )

  return (
    <>
      <PageSeo
        routeKey="servicosFretes"
        title={t('meta.servicosFretes.title')}
        description={t('meta.servicosFretes.description')}
      />

      <div className="space-y-6">
        <p className="text-earth-600">
          {t('publicFretes.intro')}{' '}
          <Link
            to={lp('servicosPrecos')}
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            {t('publicFretes.introFeeLink')}
          </Link>{' '}
          {t('publicFretes.introAfter')}
        </p>

        <nav className="border-b border-earth-200">
          <ul className="flex gap-1 sm:gap-4">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => setTabAtivo(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition sm:px-4 ${
                    tabAtivo === tab.id
                      ? 'border-earth-900 text-earth-900'
                      : 'border-transparent text-earth-600 hover:border-earth-400 hover:text-earth-900'
                  }`}
                >
                  {tab.label}
                  <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-600">
                    {tab.badge}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {tabAtivo === 'ems' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              {t('publicFretes.emsTitle')}
            </h2>
            <p className="mt-2 text-earth-600">{t('publicFretes.emsBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-earth-900 px-3 py-1 text-xs font-medium text-earth-50">
                {t('publicFretes.badge30')}
              </span>
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-medium text-earth-700">
                {t('publicFretes.badge5to10')}
              </span>
            </div>
            <div className="mt-6">
              <TabelaFrete
                tabela={TABELA_FRETE_EMS}
                colunaPeso={t('publicFretes.colWeight')}
                colunaTarifa={t('publicFretes.colTariff')}
                upTo={t('publicFretes.upTo')}
                unidade="g"
                formatarValor={formatarValor}
              />
            </div>
          </div>
        )}

        {tabAtivo === 'parcel' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              {t('publicFretes.parcelTitle')}
            </h2>
            <p className="mt-2 text-earth-600">{t('publicFretes.parcelBody')}</p>

            <div className="mt-6 flex flex-wrap gap-2 border-b border-earth-200 pb-4">
              {PARCEL_SUBTAB_IDS.map((stId) => (
                <button
                  key={stId}
                  type="button"
                  onClick={() => setParcelSubtab(stId)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    parcelSubtab === stId
                      ? 'bg-earth-900 text-earth-50'
                      : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
                  }`}
                >
                  {t('publicFretes.parcelAir')}{' '}
                  <span
                    className={
                      parcelSubtab === stId ? 'text-earth-400' : 'text-earth-600'
                    }
                  >
                    ({t('publicFretes.parcelAirEta')})
                  </span>
                </button>
              ))}
            </div>

            <TabelaFrete
              tabela={parcelTabelas[parcelSubtab]}
              colunaPeso={t('publicFretes.colWeight')}
              colunaTarifa={t('publicFretes.colTariff')}
              upTo={t('publicFretes.upTo')}
              unidade=" kg"
              formatarValor={formatarValor}
            />
          </div>
        )}

        {tabAtivo === 'epacket' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              {t('publicFretes.epacketTitle')}
            </h2>
            <p className="mt-2 text-earth-600">{t('publicFretes.epacketBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-earth-900 px-3 py-1 text-xs font-medium text-earth-50">
                {t('publicFretes.badge2')}
              </span>
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-medium text-earth-700">
                {t('publicFretes.badge5to21')}
              </span>
            </div>
            <p className="mt-4 text-sm text-earth-600">{t('publicFretes.dimNote')}</p>
            <div className="mt-6">
              <TabelaFrete
                tabela={TABELA_EPACKET}
                colunaPeso={t('publicFretes.colWeight')}
                colunaTarifa={t('publicFretes.colTariff')}
                upTo={t('publicFretes.upTo')}
                unidade="g"
                formatarValor={formatarValor}
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-earth-200 bg-earth-100 p-4">
          <p className="text-sm text-earth-700">
            {t('publicFretes.footnoteBefore')}{' '}
            <Link
              to={lp('servicosSimulador')}
              className="font-medium text-earth-900 underline hover:no-underline"
            >
              {t('publicFretes.footnoteSim')}
            </Link>{' '}
            {t('publicFretes.footnoteAfter')}
          </p>
        </div>
      </div>
    </>
  )
}

export default FretesEPrazos
