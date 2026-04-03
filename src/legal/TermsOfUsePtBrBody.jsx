/**
 * Texto integral dos Termos de Uso em PT-BR (reutilizado na página legal e no cadastro).
 */
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

/**
 * @param {{ BUSINESS_NAME: string, SUPPORT_EMAIL: string }} cfg
 * @param {boolean} [compact] — tipografia menor (ex.: caixa de rolagem no registro)
 */
export function TermsOfUsePtBrBody({ cfg, compact = false }) {
  const c = cfg
  return (
    <>
      <P>
        Estes Termos de Uso (&quot;Termos&quot;) estabelecem as condições de uso dos serviços prestados pelo{' '}
        {c.BUSINESS_NAME} (&quot;o Serviço&quot;). Ao utilizar o serviço, o usuário é considerado como tendo concordado
        com estes Termos.
      </P>

      <LegalSection title="Art. 1º (Conteúdo do serviço)" compact={compact}>
        <P>O Serviço oferece o seguinte:</P>
        <Ul
          items={[
            'Compra por procuração de produtos japoneses',
            'Serviço de personal shopping',
            'Recebimento de produtos e suporte ao envio internacional',
          ]}
        />
        <P>O Serviço presta suporte para a compra ou envio dos produtos indicados pelo usuário.</P>
      </LegalSection>

      <LegalSection title="Art. 2º (Cadastro de conta)" compact={compact}>
        <P>O usuário poderá realizar cadastro de conta para utilizar o Serviço.</P>
        <P>O usuário é responsável por fornecer informações precisas no cadastro.</P>
        <P>Caso sejam registradas informações falsas, o Serviço terá o direito de suspender ou excluir a conta.</P>
      </LegalSection>

      <LegalSection title="Art. 3º (Gestão da conta)" compact={compact}>
        <P>O usuário deve gerenciar o ID e a senha da conta por sua própria responsabilidade.</P>
        <P>Em caso de uso indevido por terceiros, entre em contato com o Serviço imediatamente.</P>
      </LegalSection>

      <LegalSection title="Art. 4º (Pagamento)" compact={compact}>
        <P>As taxas do serviço são pagas através do Stripe.</P>
        <P>O pedido é confirmado quando o pagamento for concluído.</P>
        <P>
          O processamento de pagamentos segue os padrões de segurança do Stripe; informações de cartão de crédito não
          são armazenadas em nossos servidores.
        </P>
      </LegalSection>

      <LegalSection title="Art. 5º (Taxas)" compact={compact}>
        <P>O usuário poderá arcar com os seguintes custos:</P>
        <Ul
          items={[
            'Valor das mercadorias',
            'Frete doméstico (Japão)',
            'Frete internacional',
            'Taxa de serviço',
            'Outras taxas de serviços opcionais',
          ]}
        />
        <P>Os detalhes das taxas são exibidos na página de cada serviço.</P>
      </LegalSection>

      <LegalSection title="Art. 6º (Recebimento, conferência e armazenamento)" compact={compact}>
        <P>
          Após o recebimento dos itens no Japão, o {c.BUSINESS_NAME} realiza conferência visual limitada conforme estes
          Termos e procede ao armazenamento.
        </P>
        <P>
          O armazenamento gratuito é de <strong>60 dias corridos</strong> a partir da data em que o item é recebido e
          registrado na plataforma, em <strong>qualquer modalidade de serviço</strong> (Redirecionamento de Compras,
          Redirecionamento Assistido, Personal Shopping, Grupos de Compras e Loja).
        </P>
        <P>
          Após o término desse período, será cobrada taxa de <strong>JPY 50 por item/dia</strong> (ou valor vigente na
          tabela pública da plataforma), até que o cliente solicite o envio e seja concluído o pagamento necessário para
          postagem.
        </P>
        <P>
          O {c.BUSINESS_NAME} poderá abrir embalagens externas para conferência e otimização do armazenamento, salvo
          solicitação prévia expressa do cliente em sentido contrário.
        </P>
        <P>
          O {c.BUSINESS_NAME} não se responsabiliza por erro de endereço preenchido pelo cliente junto ao fornecedor.
        </P>
      </LegalSection>

      <LegalSection title="Art. 7º (Produtos proibidos)" compact={compact}>
        <P>Os seguintes produtos não podem ser tratados:</P>
        <Ul
          items={[
            'Produtos ilegais',
            'Armas, explosivos e materiais perigosos',
            'Drogas e medicamentos ilegais',
            'Produtos que as transportadoras não podem enviar',
            'Produtos cuja importação ou exportação é proibida',
          ]}
        />
        <P>O Serviço pode recusar outros produtos que considerar inadequados.</P>
      </LegalSection>

      <LegalSection title="Art. 8º (Envio)" compact={compact}>
        <P>Os produtos são enviados para o endereço indicado pelo usuário.</P>
        <P>
          Atrasos no envio, desembaraço aduaneiro e impostos de importação dependem da transportadora e das regulamentações
          de cada país.
        </P>
        <P>O usuário é responsável por arcar com impostos de importação e tarifas.</P>
      </LegalSection>

      <LegalSection title="Art. 9º (Devolução e cancelamento)" compact={compact}>
        <P>Devido à natureza dos produtos, o cancelamento após a confirmação do pedido não é aceito em princípio.</P>
        <P>Devoluções e reembolsos são tratados conforme a política do vendedor e as circunstâncias.</P>
      </LegalSection>

      <LegalSection title="Art. 10º (Limitação de responsabilidade)" compact={compact}>
        <P>O Serviço não se responsabiliza por:</P>
        <Ul
          items={[
            'A precisão das informações sobre produtos fornecidas pelo vendedor',
            'A qualidade ou autenticidade dos produtos',
            'Atrasos na entrega ou danos durante o transporte',
            'Apreensão ou atraso de produtos pela alfândega',
          ]}
        />
        <P>A responsabilidade do Serviço limita-se ao permitido por lei.</P>
      </LegalSection>

      <LegalSection title="Art. 11º (Alterações no serviço)" compact={compact}>
        <P>O Serviço pode alterar ou interromper o conteúdo do serviço sem aviso prévio.</P>
      </LegalSection>

      <LegalSection title="Art. 12º (Alterações nos Termos)" compact={compact}>
        <P>O Serviço pode alterar estes Termos quando necessário.</P>
        <P>Os Termos alterados entram em vigor a partir da publicação no site.</P>
      </LegalSection>

      <LegalSection title="Art. 13º (Lei aplicável)" compact={compact}>
        <P>Estes Termos são interpretados conforme a lei japonesa.</P>
        <P>Disputas relacionadas ao Serviço serão submetidas exclusivamente aos tribunais do Japão.</P>
      </LegalSection>

      <LegalSection title="Contato" compact={compact}>
        <P>
          <strong>{c.BUSINESS_NAME}</strong>
          <br />
          Email: {c.SUPPORT_EMAIL}
        </P>
      </LegalSection>
    </>
  )
}
