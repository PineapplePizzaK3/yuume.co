import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { TABELA_FRETE_EMS } from '../../data/tabelaFreteEMS'
import {
  TABELA_PARCEL_AEREO,
  TABELA_PARCEL_MARITIMO,
  TABELA_EPACKET,
} from '../../data/fretesJPPost'

function formatarValor(valor) {
  return `¥ ${Number(valor).toLocaleString('pt-BR')}`
}

function TabelaFrete({ titulo, tabela, colunaPeso, unidade }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-earth-200">
      <table className="min-w-full divide-y divide-earth-200">
        <thead className="bg-earth-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
              {colunaPeso}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-earth-600">
              Tarifa
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-earth-200 bg-earth-100">
          {tabela.map((faixa, i) => (
            <tr key={i} className="hover:bg-earth-200">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-earth-900">
                até {faixa.pesoMax}{unidade}
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

const TABS = [
  { id: 'ems', label: 'EMS', badge: '30 kg' },
  { id: 'parcel', label: 'Parcel Post', badge: '30 kg' },
  { id: 'epacket', label: 'ePacket Light', badge: '2 kg' },
]

// Via marítima temporariamente indisponível
const PARCEL_MARITIMO_DISPONIVEL = false
const PARCEL_SUBTABS = [
  { id: 'aereo', label: 'Via aérea', prazo: '7–15 dias' },
  ...(PARCEL_MARITIMO_DISPONIVEL ? [{ id: 'maritimo', label: 'Via marítima', prazo: '45–90 dias' }] : []),
]

/**
 * Sub-página Fretes e Prazos - tipos de envio Japan Post com abas.
 */
function FretesEPrazos() {
  const [tabAtivo, setTabAtivo] = useState('ems')
  const [parcelSubtab, setParcelSubtab] = useState('aereo')

  const parcelTabelas = {
    aereo: TABELA_PARCEL_AEREO,
    maritimo: TABELA_PARCEL_MARITIMO,
  }

  return (
    <>
      <Helmet>
        <title>Fretes e Prazos | Serviços e Preços | Delivery</title>
        <meta
          name="description"
          content="Tipos de envio Japan Post: EMS, International Parcel Post e ePacket Light. Tabelas de preços e prazos de entrega para o Brasil."
        />
      </Helmet>

      <div className="space-y-6">
        <p className="text-earth-600">
          Utilizamos os serviços do Japan Post para envio ao Brasil. Selecione o
          tipo de envio para ver preços e prazos. O valor real do frete é informado
          após recebermos e consolidarmos os produtos. A{' '}
          <Link
            to="/servicos-e-precos"
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            taxa de serviço
          </Link>{' '}
          é calculada separadamente.
        </p>

        {/* Tabs principais */}
        <nav className="border-b border-earth-200">
          <ul className="flex gap-1 sm:gap-4">
            {TABS.map((tab) => (
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

        {/* Conteúdo EMS */}
        {tabAtivo === 'ems' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              EMS (Express Mail Service)
            </h2>
            <p className="mt-2 text-earth-600">
              Envio expresso aéreo com rastreamento. O mais rápido entre os
              serviços do Japan Post. Ideal para encomendas urgentes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-earth-900 px-3 py-1 text-xs font-medium text-earth-50">
                Até 30 kg
              </span>
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-medium text-earth-700">
                Prazo: 5–10 dias úteis
              </span>
            </div>
            <div className="mt-6">
              <TabelaFrete
                tabela={TABELA_FRETE_EMS}
                colunaPeso="Peso máximo"
                unidade="g"
              />
            </div>
          </div>
        )}

        {/* Conteúdo Parcel Post */}
        {tabAtivo === 'parcel' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              International Parcel Post (Pacote Internacional)
            </h2>
            <p className="mt-2 text-earth-600">
              Serviço para pacotes até 30 kg. Escolha a modalidade:
            </p>

            <div className="mt-6 flex flex-wrap gap-2 border-b border-earth-200 pb-4">
              {PARCEL_SUBTABS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setParcelSubtab(st.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    parcelSubtab === st.id
                      ? 'bg-earth-900 text-earth-50'
                      : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
                  }`}
                >
                  {st.label} <span className={parcelSubtab === st.id ? 'text-earth-400' : 'text-earth-600'}>({st.prazo})</span>
                </button>
              ))}
            </div>

            <TabelaFrete
              tabela={parcelTabelas[parcelSubtab]}
              colunaPeso="Peso máximo"
              unidade=" kg"
            />
          </div>
        )}

        {/* Conteúdo ePacket Light */}
        {tabAtivo === 'epacket' && (
          <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-earth-900 sm:text-2xl">
              International ePacket Light
            </h2>
            <p className="mt-2 text-earth-600">
              Pequenos pacotes (até 2 kg) com rastreamento. Via aérea, entrega na
              caixa de correio. Ideal para itens leves como roupas e
              colecionáveis.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-earth-900 px-3 py-1 text-xs font-medium text-earth-50">
                Até 2 kg
              </span>
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-medium text-earth-700">
                Prazo: 5–21 dias úteis
              </span>
            </div>
            <p className="mt-4 text-sm text-earth-600">
              Dimensões máx.: comprimento + largura + espessura = 90 cm.
            </p>
            <div className="mt-6">
              <TabelaFrete
                tabela={TABELA_EPACKET}
                colunaPeso="Peso máximo"
                unidade="g"
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-earth-200 bg-earth-100 p-4">
          <p className="text-sm text-earth-700">
            Tarifas sujeitas a alteração. O frete real é informado após a consolidação. Use o{' '}
            <Link
              to="/servicos-e-precos/simulador"
              className="font-medium text-earth-900 underline hover:no-underline"
            >
              simulador
            </Link>{' '}
            para estimar seu pedido.
          </p>
        </div>
      </div>
    </>
  )
}

export default FretesEPrazos
