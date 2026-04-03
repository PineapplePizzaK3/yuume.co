import { Link } from 'react-router-dom'

/**
 * Perguntas frequentes — texto alinhado aos serviços (redirecionamento, assistido,
 * personal shopping, grupos, loja), armazenamento, pagamentos e envio internacional.
 * `resposta` pode ser string ou ReactNode (parágrafos, listas, links).
 */
export const FAQ_ITEMS = [
  {
    id: 'servicos',
    pergunta: "Quais serviços a Eiko's Delivery Service oferece?",
    resposta: (
      <>
        <p>
          Atuamos como intermediadora na compra de produtos do Japão. Você pode usar:{' '}
          <strong>Redirecionamento de Compras</strong> (você compra e envia para nosso endereço no Japão),{' '}
          <strong>Redirecionamento Assistido</strong> (você envia links e nós cotamos/compramos após pagamento),{' '}
          <strong>Personal Shopping</strong> (pesquisa e opções com a equipe),{' '}
          <strong>Grupos de Compras</strong> (reservas por rede de lojas) e a <strong>Loja</strong> (itens já em estoque,
          prontos para envio).
        </p>
      </>
    ),
  },
  {
    id: 'redirecionamento-vs-assistido',
    pergunta: 'Qual a diferença entre Redirecionamento padrão e Redirecionamento assistido?',
    resposta: (
      <>
        <p>
          No <strong>padrão</strong>, você faz a compra e o pagamento direto na loja japonesa e só encaminha o pacote
          para o nosso endereço. Nós recebemos, conferimos o básico (integridade aparente, correspondência com o pedido
          quando possível) e armazenamos até você solicitar o envio internacional.
        </p>
        <p>
          No <strong>assistido</strong>, você nos envia os links e as especificações (cor, tamanho, quantidade etc.).
          Orçamos e, após seu pagamento, realizamos a compra por você. Depois o fluxo segue como no redirecionamento
          padrão. Em marketplaces com estoque único (ex.: Mercari, Rakuma), pode haver opção de pré-pagamento para
          agilizar.
        </p>
      </>
    ),
  },
  {
    id: 'personal-shopping',
    pergunta: 'Como funciona o Personal Shopping?',
    resposta: (
      <>
        <p>
          Você descreve o que procura (fotos, links, faixa de preço). Nossa equipe pesquisa e apresenta opções. Após sua
          aprovação e pagamento do orçamento, efetuamos a compra. Preços e disponibilidade podem mudar por estoque,
          lojas e câmbio até a confirmação do pagamento.
        </p>
      </>
    ),
  },
  {
    id: 'grupos-compras',
    pergunta: 'O que são os Grupos de compras?',
    resposta: (
      <>
        <p>
          São compras coletivas por temática de rede de lojas (ex.: Nike, Welcia, Don Quijote). Você escolhe itens
          divulgados no grupo, paga produtos e taxas de serviço conforme regras do grupo, e depois solicita o envio
          quando quiser. Em geral a reserva é firme após confirmação do pagamento; cancelamento pode não ser possível.
          Se algum item ficar indisponível, você será informado.
        </p>
      </>
    ),
  },
  {
    id: 'loja',
    pergunta: 'O que é a Loja da Eiko?',
    resposta: (
      <>
        <p>
          São produtos que já compramos e temos em estoque (novos, colecionáveis, edições limitadas etc.). Após a
          confirmação do pagamento, o item segue para envio conforme nosso processo logístico. O estado do anúncio
          descreve condição e possíveis desgastes de embalagem em itens colecionáveis.
        </p>
      </>
    ),
  },
  {
    id: 'endereco-japao',
    pergunta: 'Como devo preencher o endereço de entrega no Japão?',
    resposta: (
      <>
        <p>
          Use exatamente o endereço e as instruções exibidos na sua conta após o cadastro. No destinatário, siga o
          formato indicado na plataforma — em geral <strong>seu nome + código da conta</strong> (ex.: Maria Souza - ED0003)
          — para associarmos o pacote à sua conta com segurança.
        </p>
      </>
    ),
  },
  {
    id: 'cadastro',
    pergunta: 'Preciso me cadastrar antes de usar o serviço?',
    resposta:
      'Sim. O cadastro é necessário para receber o endereço no Japão, acompanhar pedidos e aceitar os Termos de Uso. É preciso ter pelo menos 18 anos e manter dados verdadeiros e atualizados. Use Login / Registro no menu.',
  },
  {
    id: 'armazenamento',
    pergunta: 'Por quanto tempo vocês armazenam meus produtos?',
    resposta: (
      <>
        <p>
          O armazenamento gratuito é de <strong>60 dias corridos</strong> a partir do recebimento e registro do item na
          plataforma, em <strong>todas as modalidades</strong> (redirecionamento, assistido, personal shopping, grupos e
          loja).
        </p>
        <p>
          Depois desse período, cobramos <strong>¥50 por item por dia</strong> (ou o valor vigente na tabela pública do
          site) até você solicitar o envio e quitar o necessário para postagem. Podemos abrir embalagens externas para
          conferência, salvo se você solicitar o contrário ao fazer o pedido.
        </p>
      </>
    ),
  },
  {
    id: 'consolidacao',
    pergunta: 'Posso juntar compras de várias lojas em um único envio?',
    resposta: (
      <>
        <p>
          Sim. Você pode consolidar vários pacotes em um ou mais envios. O frete internacional é calculado pelo peso e
          dimensões finais de <strong>cada caixa</strong> enviada. Para itens frágeis, há opção de proteção extra no
          fechamento do pacote, com custo adicional conforme a página de serviços extras no fluxo de envio.
        </p>
      </>
    ),
  },
  {
    id: 'quando-pago',
    pergunta: 'Quando pago produto, taxa de serviço e frete internacional?',
    resposta: (
      <>
        <p>
          Depende do serviço: no <strong>redirecionamento padrão</strong>, você paga a loja japonesa; as taxas de serviço
          da Eiko costumam ser cobradas na <strong>solicitação de envio</strong>. No <strong>assistido</strong>, o valor
          dos produtos é pago para realizarmos a compra; taxas de serviço seguem a mesma lógica do padrão no envio, salvo
          indicação contrária na plataforma.
        </p>
        <p>
          Em <strong>Personal Shopping</strong> e <strong>Grupos de compras</strong>, em geral é necessário pagar itens e
          taxas de serviço antes de efetuarmos a compra/retirada. O <strong>frete internacional</strong> é cobrado após
          você pedir envio, consolidação (se houver) e pesagem final — tudo quitado antes da postagem.
        </p>
        <p>Na <strong>Loja</strong>, após o pagamento confirmado o item fica disponível para processamento de envio.</p>
      </>
    ),
  },
  {
    id: 'moeda-cambio',
    pergunta: 'Por que o valor em reais na tela pode ser diferente do que cai no cartão ou no PIX?',
    resposta: (
      <>
        <p>
          Nossa referência operacional é o <strong>iene (JPY)</strong>. Os pagamentos podem ser processados por
          provedores que liquidam em <strong>dólar (USD)</strong>. Na interface mostramos valores em <strong>real (BRL)</strong>{' '}
          para facilitar, mas na hora da cobrança podem incidir conversões, spread, IOF e taxas do banco ou da bandeira —
          o valor debitado pode variar em relação ao exibido por causa do câmbio.
        </p>
      </>
    ),
  },
  {
    id: 'pagamento',
    pergunta: 'Quais formas de pagamento vocês aceitam?',
    resposta: (
      <>
        <p>
          Utilizamos processadores seguros (ex.: Stripe). Cartão de crédito não fica armazenado em nossos servidores.
          Conforme disponibilidade na plataforma: <strong>PIX</strong>, <strong>cartão de crédito</strong> (com
          parcelamento quando oferecido) e <strong>depósito bancário</strong>. O pedido é confirmado após validação do
          pagamento.
        </p>
      </>
    ),
  },
  {
    id: 'prazos',
    pergunta: 'Quanto tempo demora para chegar no meu país?',
    resposta: (
      <>
        <p>
          Os envios internacionais costumam usar serviços como Japan Post (EMS, ePacket, superfície etc., conforme
          disponibilidade). O prazo depende do método escolhido, da região, do fluxo aduaneiro e da transportadora local —
          <strong>não há garantia de prazo exato</strong>. Após a postagem, o rastreamento e a entrega final ficam sob a
          responsabilidade da cadeia logística até seu endereço.
        </p>
      </>
    ),
  },
  {
    id: 'alfandega',
    pergunta: 'Quem paga imposto de importação e taxas alfandegárias?',
    resposta: (
      <>
        <p>
          O <strong>destinatário</strong> é responsável por impostos, taxas alfandegárias e encargos postais no país de
          destino, além de fornecer documentos se a alfândega exigir. Não controlamos retenções, taxações extras nem
          prazos de desembaraço.
        </p>
        <p>
          Mais detalhes:{' '}
          <Link to="/faq/taxas-alfandegarias" className="font-medium text-earth-900 underline hover:no-underline">
            Taxas alfandegárias
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'rastreio',
    pergunta: 'Recebo código de rastreamento?',
    resposta:
      'Sim, quando o serviço postal ou transportadora disponibilizar código de rastreio após a postagem no Japão, você poderá acompanhar conforme as ferramentas oficiais (Correios, Japan Post ou parceiro local).',
  },
  {
    id: 'devolucao',
    pergunta: 'Posso cancelar ou devolver depois que a compra foi feita?',
    resposta: (
      <>
        <p>
          Como intermediadora, em geral <strong>não garantimos devolução ou reembolso</strong> após a compra confirmada
          junto ao fornecedor — isso depende da política da loja ou do vendedor. Taxas de serviço já executadas costumam
          não ser reembolsáveis. Em caso de devolução aceita pelo vendedor, custos de envio de volta e taxas costumam ser
          do cliente.
        </p>
      </>
    ),
  },
  {
    id: 'itens-proibidos',
    pergunta: 'O que não posso enviar ou comprar através do serviço?',
    resposta: (
      <>
        <p>
          Não aceitamos produtos ilegais, armas e explosivos, drogas ilícitas, itens proibidos por transportadoras ou por
          leis de exportação/importação. A Eiko pode recusar outros itens por risco legal ou operacional.
        </p>
        <p>
          Lista orientativa:{' '}
          <Link to="/faq/itens-proibidos" className="font-medium text-earth-900 underline hover:no-underline">
            Itens proibidos
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'seguro-embalagem',
    pergunta: 'Há seguro de envio ou embalagem especial?',
    resposta: (
      <>
        <p>
          Quando disponível no fluxo de envio, você pode contratar <strong>seguro</strong> conforme regras da
          transportadora. Para itens frágeis, oferecemos opções de <strong>embalagem reforçada</strong> com custo extra,
          descrito em serviços extras ao solicitar envio.
        </p>
      </>
    ),
  },
  {
    id: 'contato',
    pergunta: 'Como falo com o suporte?',
    resposta: (
      <>
        <p>
          Envie e-mail para <strong>support@eiko-dls.com</strong> ou use o telefone <strong>+81 90 3863-9518</strong> (Japão),
          em horário comercial. Tenha em mãos o e-mail da conta e, se houver, número do pedido.
        </p>
      </>
    ),
  },
]
