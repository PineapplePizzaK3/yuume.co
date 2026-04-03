import { Helmet } from 'react-helmet-async'

/**
 * Sub-página Como funciona > Taxas alfandegárias.
 * Informações sobre taxas e impostos de importação.
 */
function TaxasAlfandegarias() {
  return (
    <>
      <Helmet>
        <title>Taxas alfandegárias | Dúvidas | Delivery</title>
        <meta
          name="description"
          content="Taxas alfandegárias no Brasil: II, ICMS, Remessa Conforme. Alíquotas de 20% e 60% conforme valor e origem da compra."
        />
      </Helmet>

      <div className="pt-8 space-y-10">
        <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
          Taxas alfandegárias
        </h2>
        <p className="text-earth-600">
          Toda encomenda internacional está sujeita à tributação pela Receita Federal. Os impostos incidem sobre o valor declarado da mercadoria + frete internacional. Abaixo, um resumo das regras vigentes.
        </p>

        {/* Tributos */}
        <div>
          <h3 className="text-lg font-semibold text-earth-900">
            Impostos aplicáveis
          </h3>
          <ul className="mt-4 space-y-3 text-earth-700">
            <li>
              <strong>II (Imposto de Importação)</strong> — alíquota que varia conforme o valor e a origem da compra (veja tabela abaixo)
            </li>
            <li>
              <strong>ICMS (estadual)</strong> — geralmente entre 17% e 20%, aplicado sobre a base de cálculo que inclui o II
            </li>
            <li>
              <strong>IOF</strong> — incide sobre pagamentos internacionais em cartão de crédito (6,38% para pessoa física)
            </li>
          </ul>
        </div>

        {/* Remessa Conforme */}
        <div>
          <h3 className="text-lg font-semibold text-earth-900">
            Programa Remessa Conforme
          </h3>
          <p className="mt-2 text-earth-600">
            Desde agosto de 2024, o governo brasileiro aplica alíquotas diferentes conforme o vendedor esteja ou não no Programa Remessa Conforme. Lojas japonesas como Amazon.co.jp e Mercari podem estar ou não no programa — isso influencia o valor do imposto.
          </p>
          <div className="mt-6 overflow-hidden rounded-lg border border-earth-200">
            <table className="min-w-full divide-y divide-earth-200">
              <thead className="bg-earth-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-earth-900">Situação</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-earth-900">Alíquota do II</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-200 bg-earth-100">
                <tr>
                  <td className="px-4 py-3 text-sm text-earth-700">Compra até US$ 50* em site certificado (pessoa física)</td>
                  <td className="px-4 py-3 text-sm font-medium text-earth-900">20%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-earth-700">Compra acima de US$ 50 em site certificado</td>
                  <td className="px-4 py-3 text-sm font-medium text-earth-900">60%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-earth-700">Compra em site não certificado ou envio por PJ</td>
                  <td className="px-4 py-3 text-sm font-medium text-earth-900">60%</td>
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-earth-500 bg-earth-100">
              * Com desconto de US$ 20 sobre o valor da remessa. ICMS é cobrado em todos os casos.
            </p>
          </div>
        </div>

        {/* Isenção */}
        <div>
          <h3 className="text-lg font-semibold text-earth-900">
            Isenção de tributos
          </h3>
          <p className="mt-2 text-earth-600">
            Remessas de pessoa física para pessoa física, com valor total (produto + frete) até US$ 50 e em sites do Remessa Conforme, têm alíquota reduzida de II (20%). Não há isenção total — sempre haverá alguma tributação quando aplicável. Envios frequentes do mesmo remetente podem ser somados para fins de fiscalização.
          </p>
        </div>

        {/* Responsabilidade */}
        <div className="rounded-lg border border-earth-200 bg-earth-100 p-6">
          <h3 className="text-lg font-semibold text-earth-900">
            Quem paga os impostos?
          </h3>
          <p className="mt-2 text-earth-700">
            O destinatário é o responsável pelo pagamento dos tributos na entrega. Os Correios ou a transportadora retêm a encomenda e cobram o valor devido antes da entrega. O cálculo é feito pela Receita Federal com base na declaração aduaneira. Mantemos a declaração fiel aos itens enviados, conforme exigido por lei.
          </p>
        </div>
      </div>
    </>
  )
}

export default TaxasAlfandegarias
