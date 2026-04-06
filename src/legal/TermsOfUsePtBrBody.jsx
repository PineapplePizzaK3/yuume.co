/**
 * Texto integral dos Termos de Uso e Serviços em PT-BR (página legal e cadastro).
 * Última atualização: 30 de março de 2026.
 */
import { LocalizedLink } from '../components/LocalizedLink'

function LegalSection({ title, children, compact = false }) {
  return (
    <div>
      <h3
        className={
          compact
            ? 'text-sm font-semibold text-earth-900'
            : 'text-lg font-semibold text-earth-900'
        }
      >
        {title}
      </h3>
      <div
        className={`mt-2 space-y-2 text-earth-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 ${
          compact ? 'text-xs' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function P({ children }) {
  return <p>{children}</p>
}

function Ul({ items }) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function Subt({ children, compact }) {
  return (
    <p className={compact ? 'text-xs font-semibold text-earth-900' : 'font-semibold text-earth-900'}>{children}</p>
  )
}

/**
 * @param {{ BUSINESS_NAME: string, SUPPORT_EMAIL: string, SUPPORT_PHONE?: string }} cfg
 * @param {boolean} [compact]
 */
export function TermsOfUsePtBrBody({ cfg, compact = false }) {
  const c = cfg
  const tel = c.SUPPORT_PHONE ?? ''
  return (
    <>
      <P>
        <strong>Última atualização:</strong> 30 de março de 2026.
      </P>

      <LegalSection title="Art. 1º (Identificação da empresa e contato)" compact={compact}>
        <P>
          A <strong>{c.BUSINESS_NAME}</strong> (&quot;Eiko&quot;, &quot;nós&quot;), com sede no Japão, presta serviços de
          intermediação para aquisição de produtos no Japão e comercialização de itens em loja própria.
        </P>
        <P>
          <strong>Contato:</strong> e-mail {c.SUPPORT_EMAIL}
          {tel ? (
            <>
              {' '}
              · telefone <strong>{tel}</strong>
            </>
          ) : null}
        </P>
      </LegalSection>

      <LegalSection title="Art. 2º (Aceitação dos Termos)" compact={compact}>
        <P>
          Estes Termos de Uso e Serviços (&quot;Termos&quot;) regem o uso da plataforma e dos serviços. Ao criar conta,
          aceitar eletronicamente e/ou utilizar qualquer serviço, você declara ter lido e concordado com estes Termos e
          com a{' '}
          <LocalizedLink toRoute="legalPrivacy" className="font-medium text-earth-900 underline hover:no-underline">
            Política de Privacidade
          </LocalizedLink>
          .
        </P>
      </LegalSection>

      <LegalSection title="Art. 3º (Elegibilidade e conta do usuário)" compact={compact}>
        <P>Para utilizar os serviços, você deve:</P>
        <Ul
          items={[
            'Ter no mínimo 18 anos ou capacidade civil válida na sua jurisdição;',
            'Fornecer dados verdadeiros, completos e atualizados;',
            'Manter login e senha sob confidencialidade.',
          ]}
        />
        <P>
          Você é responsável por todas as atividades em sua conta e por comunicar imediatamente uso não autorizado. Sem
          pendências, poderá solicitar encerramento de conta conforme processo da plataforma.
        </P>
      </LegalSection>

      <LegalSection title="Art. 4º (Natureza dos serviços)" compact={compact}>
        <P>
          Exceto na modalidade <strong>Loja</strong>, {c.BUSINESS_NAME} atua como <strong>intermediadora</strong>, não
          sendo fabricante, vendedora original ou transportadora final. Na <strong>Loja</strong>, {c.BUSINESS_NAME} atua
          como vendedora dos
          itens anunciados em estoque próprio.
        </P>
      </LegalSection>

      <LegalSection title="Art. 5º (Serviços oferecidos)" compact={compact}>
        <Subt compact={compact}>5.1 Redirecionamento de Compras</Subt>
        <P>
          Você compra diretamente no fornecedor e envia ao endereço de {c.BUSINESS_NAME} no Japão. {c.BUSINESS_NAME}{' '}
          recebe, realiza conferência
          visual limitada e armazena. O destinatário da encomenda deve constar conforme instrução da plataforma — em geral{' '}
          <strong>nome + código da conta</strong> (ex.: Lucas Silva Jr. - ED0003).
        </P>
        <P>
          É sua responsabilidade conferir especificações (medidas, cor, quantidade etc.) antes da compra e do envio, e
          realizar pagamento às lojas japonesas quando aplicável.
        </P>

        <Subt compact={compact}>5.2 Redirecionamento de Compras Assistido</Subt>
        <P>
          Você envia links e especificações; {c.BUSINESS_NAME} cotiza e/ou compra após confirmação de pagamento. Em marketplaces de
          alta rotatividade, pode haver pré-pagamento para agilizar. Após a compra, o fluxo segue como no redirecionamento
          padrão.
        </P>

        <Subt compact={compact}>5.3 Personal Shopping</Subt>
        <P>
          Você informa o que deseja (imagens, descrição, faixa de preço). A equipe pesquisa opções; após aprovação e
          pagamento do orçamento, realiza a compra. Preços e disponibilidade podem variar por estoque, lojas e câmbio.
        </P>
        <P>
          Ao solicitar, você autoriza {c.BUSINESS_NAME} a comprar em seu nome após aprovação do orçamento.
        </P>

        <Subt compact={compact}>5.4 Grupos de Compras</Subt>
        <P>
          Participação em grupos por temática de rede de lojas. Após confirmação do pagamento, em geral a reserva é firme
          e pode não haver cancelamento. Em indisponibilidade de item, você será informado e, quando aplicável, haverá
          tratamento de estorno do item indisponível.
        </P>

        <Subt compact={compact}>5.5 Loja</Subt>
        <P>
          Produtos já em estoque próprio, prontos para processamento de envio após confirmação do pagamento. Podem incluir
          itens novos, colecionáveis ou edição limitada. Colecionáveis podem apresentar desgaste de embalagem ou pequenas
          imperfeições não essenciais conforme o anúncio — não são tratadas como defeito se descritas ou típicas da
          natureza do produto.
        </P>
        <P>
          Na Loja, {c.BUSINESS_NAME} compromete-se a enviar o produto conforme o anúncio, informar o estado quando possível, embalar de
          forma adequada ao envio internacional e despachar conforme prazo informado após pagamento, sem garantir
          perfeição subjetiva nem compatibilidade de eletrônicos fora do Japão.
        </P>
      </LegalSection>

      <LegalSection title="Art. 6º (Conferência de recebimento)" compact={compact}>
        <P>A conferência de {c.BUSINESS_NAME} é visual e limitada, incluindo quando possível:</P>
        <Ul
          items={[
            'Correspondência aparente com o pedido;',
            'Danos visíveis (quebras, vazamentos);',
            'Validade aparente quando informada no rótulo.',
          ]}
        />
        <P>
          Salvo contratação de serviço extra específico, não há teste técnico aprofundado, autenticação pericial nem
          garantia de funcionamento interno.
        </P>
      </LegalSection>

      <LegalSection title="Art. 7º (Recebimento, abertura de pacotes e armazenamento)" compact={compact}>
        <P>
          Após o recebimento no Japão, {c.BUSINESS_NAME} procede à conferência e ao armazenamento. O armazenamento gratuito é de{' '}
          <strong>60 dias corridos</strong> a partir do recebimento e registro na plataforma, em{' '}
          <strong>qualquer modalidade</strong> (redirecionamento, assistido, personal shopping, grupos e loja).
        </P>
        <P>
          Após esse período, incide taxa de <strong>JPY 50 por item/dia</strong> (ou valor vigente na tabela pública do
          site) até solicitação de envio e quitação necessária para postagem.
        </P>
        <P>
          {c.BUSINESS_NAME} poderá abrir embalagens externas para conferência e otimização do armazenamento, salvo
          solicitação prévia expressa em contrário. {c.BUSINESS_NAME} não se responsabiliza por erro de endereço que você
          informou ao fornecedor.
        </P>
      </LegalSection>

      <LegalSection title="Art. 8º (Consolidação de pacotes e embalagem)" compact={compact}>
        <P>
          Você pode solicitar consolidação em uma ou mais caixas. Frete e custos consideram peso, volume e dimensões
          finais por caixa. Proteção extra e embalagem reforçada podem ter custo adicional, conforme opções ao solicitar
          envio.
        </P>
      </LegalSection>

      <LegalSection title="Art. 9º (Preços, taxas e formas de pagamento)" compact={compact}>
        <P>Podem incidir, conforme o serviço:</P>
        <Ul
          items={[
            'Taxa fixa por item ou pedido;',
            'Taxa percentual sobre o valor da compra;',
            'Armazenamento após o período gratuito;',
            'Serviços extras (fotos, vídeos, urgência, embalagem reforçada etc.);',
            'Frete internacional.',
          ]}
        />
        <P>
          Detalhes em{' '}
          <LocalizedLink toRoute="servicosPrecos" className="font-medium text-earth-900 underline hover:no-underline">
            Serviços e Preços
          </LocalizedLink>
          . Pagamentos podem ser processados por terceiros (ex.: Stripe); dados de cartão não são armazenados em nossos
          servidores. Conforme disponibilidade: <strong>PIX</strong>, <strong>cartão de crédito</strong> (parcelamento
          quando oferecido) e <strong>depósito bancário</strong>. Pedidos confirmam após validação do pagamento.
        </P>
      </LegalSection>

      <LegalSection title="Art. 10º (Moeda, câmbio e cobrança)" compact={compact}>
        <P>
          A moeda base operacional é o <strong>iene (JPY)</strong>. Os pagamentos podem ser liquidados em{' '}
          <strong>dólar (USD)</strong> por provedores financeiros. Valores podem ser exibidos em <strong>real (BRL)</strong>{' '}
          na plataforma; na cobrança podem aplicar-se conversões, spread, IOF e taxas de terceiros — o valor debitado pode
          diferir do exibido por flutuação cambial. {c.BUSINESS_NAME} não controla taxas de câmbio de bancos ou
          processadores.
        </P>
        <P>Ao pagar, você declara ciência das regras de conversão e liquidação do meio de pagamento utilizado.</P>
      </LegalSection>

      <LegalSection title="Art. 11º (Frete internacional)" compact={compact}>
        <P>
          O frete é calculado após solicitação de envio, consolidação (se houver) e pesagem final. O pagamento do frete e
          encargos aplicáveis deve ocorrer antes da postagem. Valores orientativos em{' '}
          <LocalizedLink toRoute="servicosFretes" className="font-medium text-earth-900 underline hover:no-underline">
            Fretes e Prazos
          </LocalizedLink>
          .
        </P>
      </LegalSection>

      <LegalSection title="Art. 12º (Envio e entrega)" compact={compact}>
        <P>
          Envios por transportadoras parceiras (ex.: Japan Post), conforme disponibilidade. Prazos dependem do método,
          região, alfândega e transporte local — <strong>sem garantia de prazo exato</strong>. Após a postagem, a entrega
          segue sob responsabilidade da cadeia logística. Os produtos são encaminhados ao endereço informado na conta;
          mantenha seus dados atualizados.
        </P>
      </LegalSection>

      <LegalSection title="Art. 13º (Alfândega, impostos e conformidade)" compact={compact}>
        <P>
          Você é responsável por impostos de importação, taxas alfandegárias e postais no destino, documentação exigida e
          conformidade com leis locais. {c.BUSINESS_NAME} não controla retenções, atrasos, devoluções, apreensões ou
          tributação
          adicional imposta por autoridades.
        </P>
        <P>
          Orientações sobre o Brasil:{' '}
          <LocalizedLink toRoute="faqCustoms" className="font-medium text-earth-900 underline hover:no-underline">
            Taxas alfandegárias
          </LocalizedLink>
          .
        </P>
      </LegalSection>

      <LegalSection title="Art. 14º (Itens proibidos e restritos)" compact={compact}>
        <P>É proibido utilizar os serviços para:</P>
        <Ul
          items={[
            'Produtos ilegais;',
            'Armas, explosivos e materiais perigosos;',
            'Drogas e substâncias ilícitas;',
            'Itens vedados por lei ou por políticas de transportadoras;',
            'Bens sujeitos a embargo ou restrições de exportação/importação.',
          ]}
        />
        <P>{c.BUSINESS_NAME} pode recusar pedidos e adotar medidas por risco legal, operacional ou de compliance.</P>
      </LegalSection>

      <LegalSection title="Art. 15º (Responsabilidades do cliente)" compact={compact}>
        <P>Ao usar os serviços, você declara que:</P>
        <Ul
          items={[
            'Revisou especificações dos itens;',
            'Está ciente dos riscos de importação e transporte internacional;',
            'Aceita variações de preço, estoque e câmbio;',
            `Autoriza ${c.BUSINESS_NAME} a comprar em seu nome quando aplicável.`,
          ]}
        />
      </LegalSection>

      <LegalSection title="Art. 16º (Limitação de responsabilidade)" compact={compact}>
        <P>Na extensão permitida por lei, {c.BUSINESS_NAME} não responde por:</P>
        <Ul
          items={[
            'Danos causados por terceiros;',
            'Perdas no transporte após postagem sob custódia da transportadora;',
            'Problemas com fabricantes e vendedores originais;',
            'Precisão de informações de vendedores terceiros;',
            'Informações incorretas fornecidas por você;',
            'Qualidade e autenticidade quando atua apenas como intermediadora;',
            'Atrasos logísticos e alfandegários;',
            'Apreensão ou taxação pela alfândega.',
          ]}
        />
        <P>
          Quando houver responsabilidade comprovada de {c.BUSINESS_NAME}, a indenização total fica limitada ao valor das{' '}
          <strong>taxas de serviço pagas a {c.BUSINESS_NAME}</strong> no pedido específico que originou a reclamação,
          salvo quando a
          lei aplicável proibir tal limitação (dolo, culpa grave ou normas cogentes).
        </P>
      </LegalSection>

      <LegalSection title="Art. 17º (Seguro de envio)" compact={compact}>
        <P>
          Quando disponível, você pode contratar seguro de envio. Cobertura, limites e exclusões seguem transportadora ou
          seguradora.
        </P>
      </LegalSection>

      <LegalSection title="Art. 18º (Cancelamento, devoluções e reembolsos)" compact={compact}>
        <P>
          {c.BUSINESS_NAME} não garante devolução ou reembolso após compra confirmada junto ao fornecedor; cancelamento
          depende da política desse fornecedor. Taxas de serviço de {c.BUSINESS_NAME} já executadas, em regra, não são
          reembolsáveis. Custos de
          devolução e taxas correlatas tendem a ser seus, salvo disposição legal em contrário.
        </P>
      </LegalSection>

      <LegalSection title="Art. 19º (Chargeback e antifraude)" compact={compact}>
        <P>
          {c.BUSINESS_NAME} pode solicitar verificações adicionais de identidade e pagamento. Chargeback indevido ou fraude
          pode
          acarretar suspensão ou encerramento de conta e medidas cabíveis.
        </P>
      </LegalSection>

      <LegalSection title="Art. 20º (Abandono de mercadoria)" compact={compact}>
        <P>
          Itens sem solicitação de envio por mais de <strong>180 dias corridos</strong> após o recebimento podem ser
          considerados abandonados. Será enviado aviso ao e-mail cadastrado com antecedência mínima de{' '}
          <strong>15 dias</strong>. Sem manifestação ou pagamento no prazo, os itens poderão ser descartados, doados ou
          vendidos para compensação de custos operacionais, sem direito adicional a indenização.
        </P>
      </LegalSection>

      <LegalSection title="Art. 21º (Privacidade e dados pessoais)" compact={compact}>
        <P>
          O tratamento de dados segue a{' '}
          <LocalizedLink toRoute="legalPrivacy" className="font-medium text-earth-900 underline hover:no-underline">
            Política de Privacidade
          </LocalizedLink>
          , incluindo compartilhamento com processadores de pagamento, transportadoras e parceiros necessários à execução
          dos serviços.
        </P>
      </LegalSection>

      <LegalSection title="Art. 22º (Suspensão e encerramento)" compact={compact}>
        <P>
          {c.BUSINESS_NAME} pode suspender ou encerrar contas em caso de violação destes Termos, fraude, uso ilícito,
          risco de
          compliance ou operacional, ou chargeback indevido.
        </P>
      </LegalSection>

      <LegalSection title="Art. 23º (Alterações dos Termos)" compact={compact}>
        <P>
          {c.BUSINESS_NAME} pode alterar estes Termos a qualquer momento. A versão vigente será publicada no site com data
          de
          atualização. O uso continuado após a publicação implica aceitação, salvo quando a lei exigir consentimento
          adicional.
        </P>
      </LegalSection>

      <LegalSection title="Art. 24º (Lei aplicável, foro e disposições gerais)" compact={compact}>
        <P>
          Estes Termos regem-se pelas leis do <strong>Japão</strong>. Fica eleito o foro dos tribunais do Japão para
          controvérsias, <strong>sem prejuízo</strong> de normas cogentes de proteção ao consumidor do país de domicílio do
          consumidor, quando obrigatórias.
        </P>
        <P>
          Se alguma cláusula for inválida, as demais permanecem válidas. A tolerância a descumprimento não implica
          renúncia de direitos.
        </P>
        <P>
          <strong>Contato:</strong> {c.SUPPORT_EMAIL}
          {tel ? (
            <>
              {' '}
              · {tel}
            </>
          ) : null}
        </P>
      </LegalSection>
    </>
  )
}
