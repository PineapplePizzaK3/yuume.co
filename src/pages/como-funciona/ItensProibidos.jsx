import { Helmet } from 'react-helmet-async'

/**
 * Sub-página Como funciona > Itens proibidos.
 * Lista de itens proibidos de serem enviados.
 * Conteúdo placeholder - textos serão preenchidos manualmente.
 */
function ItensProibidos() {
  return (
    <>
      <Helmet>
        <title>Itens proibidos | FAQ | Delivery</title>
        <meta
          name="description"
          content="Itens proibidos na importação: perfume, spray, bebidas, cigarros eletrônicos, power banks e mais. Evite apreensão na alfândega."
        />
      </Helmet>

      <div className="pt-8 space-y-10">
        <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
          Itens proibidos
        </h2>
        <p className="text-earth-600">
          Para garantir que sua encomenda chegue sem problemas, é fundamental evitar o envio de itens proibidos pela legislação brasileira ou pelas transportadoras. A Receita Federal e os Correios não aceitam determinados produtos — em caso de interceptação, o item pode ser apreendido, destruído ou encaminhado às autoridades, sem direito a reembolso.
        </p>

        {/* Proibições absolutas */}
        <div>
          <h3 className="text-lg font-semibold text-earth-900">
            Proibições absolutas (não podemos enviar)
          </h3>
          <ul className="mt-4 space-y-2 text-earth-700">
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Perfumes, sprays e cosméticos com álcool</strong> — substâncias inflamáveis, proibidas em remessas postais</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Bebidas alcoólicas</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Cigarros eletrônicos e vapes</strong> — proibidos no Brasil desde 2009</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Armas de fogo, réplicas e munições</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Produtos explosivos, inflamáveis ou radioativos</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Produtos falsificados ou pirateados</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Drogas e substâncias ilícitas</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Espécies animais e vegetais ameaçadas de extinção</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600">•</span>
              <span><strong>Power banks e baterias de lítio soltas</strong> — restrições para envio aéreo</span>
            </li>
          </ul>
        </div>

        {/* Itens com restrição */}
        <div>
          <h3 className="text-lg font-semibold text-earth-900">
            Itens com restrição (exigem autorização prévia)
          </h3>
          <p className="mt-2 text-earth-600">
            Estes itens podem ser permitidos com licença de órgãos como Anvisa, IBAMA ou Vigiagro. Entre em contato conosco antes de comprar para avaliarmos a viabilidade.
          </p>
          <ul className="mt-4 space-y-2 text-earth-700">
            <li className="flex gap-2">
              <span className="text-amber-600">•</span>
              <span><strong>Medicamentos</strong> — exigem registro ou autorização da Anvisa</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-600">•</span>
              <span><strong>Produtos de origem animal ou vegetal</strong> — Vigiagro</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-600">•</span>
              <span><strong>Cosméticos e suplementos</strong> — podem exigir anuência da Anvisa</span>
            </li>
          </ul>
        </div>

        {/* Recomendações */}
        <div className="rounded-lg border border-earth-200 bg-earth-100 p-6">
          <h3 className="text-lg font-semibold text-earth-900">
            Dica importante
          </h3>
          <p className="mt-2 text-earth-700">
            Na dúvida, consulte-nos antes de comprar. Itens como protetor solar, esmalte e tônicos capilares podem ter restrições conforme a composição. Preferimos orientar você desde o início para evitar transtornos e perdas.
          </p>
        </div>

        <div className="mt-8">
          <img
            src="/itens-proibidos.png"
            alt="Lista visual de itens proibidos: spray, perfume, fogos de artifício, protetor solar, esmalte, tônico capilar, bebidas alcoólicas, cigarros eletrônicos e power banks"
            className="w-full rounded-lg border border-earth-200"
          />
        </div>
      </div>
    </>
  )
}

export default ItensProibidos
