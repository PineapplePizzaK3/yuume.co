/**
 * Commercial Disclosure - Specified Commercial Transactions Act (特定商取引法に基づく表記).
 * Content in JA (default), PT-BR and EN.
 */
import { Helmet } from 'react-helmet-async'
import { useLegalLanguage } from '../../contexts/LegalLanguageContext'
import { LEGAL_CONFIG } from '../../data/legalConfig'

function LegalSection({ title, children }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-earth-900">{title}</h3>
      <div className="mt-2 space-y-2 text-earth-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
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

const CONTENT = {
  ja: {
    title: '特定商取引法に基づく表記',
    content: (c) => (
      <>
        <P>本ページは、日本の特定商取引法に基づき、当サービスに関する情報を掲載しています。</P>
        <P>利用規約および関連する規約は日本語を正式な言語とし、他言語による翻訳は参考として提供されるものです。</P>

        <LegalSection title="販売業者">
          <P>{c.BUSINESS_NAME}</P>
        </LegalSection>

        <LegalSection title="運営責任者">
          <P>{c.BUSINESS_OWNER}</P>
        </LegalSection>

        <LegalSection title="所在地">
          <P>請求があった場合、遅滞なく開示いたします。</P>
        </LegalSection>

        <LegalSection title="電話番号">
          <P>請求があった場合、遅滞なく開示いたします。</P>
        </LegalSection>

        <LegalSection title="メールアドレス">
          <P>{c.SUPPORT_EMAIL}</P>
        </LegalSection>

        <LegalSection title="サービス内容">
          <P>当サービスは以下のサービスを提供します。</P>
          <Ul items={[
            '日本商品の購入代行サービス',
            'パーソナルショッピングサービス',
            '国際発送サポートサービス',
          ]} />
          <P>当サービスは、お客様に代わって商品を購入し、指定された住所へ発送するサポートを行います。</P>
        </LegalSection>

        <LegalSection title="サービス料金および送料">
          <P>お客様が支払う料金には以下が含まれる場合があります。</P>
          <Ul items={[
            '商品代金 — お客様が購入する商品の価格',
            'サービス手数料 — 購入代行およびサポートに対する手数料',
            '日本国内送料 — 販売者から当サービスの発送拠点までの送料（該当する場合）',
            '国際送料 — 当サービスからお客様の指定住所への送料',
            'その他オプションサービス料金 — 特別梱包、保険、追加サービス等（該当する場合）',
          ]} />
          <P>詳細は各サービスページをご確認ください。</P>
        </LegalSection>

        <LegalSection title="お支払い方法">
          <P>以下の支払い方法が利用可能です。</P>
          <Ul items={[
            'クレジットカード（Stripe経由）',
            '銀行振込',
            '海外決済サービス（PIX）',
          ]} />
          <P>支払いは注文確定時に処理されます。</P>
        </LegalSection>

        <LegalSection title="商品の発送">
          <P>お客様はアカウントページまたは通知メールで注文状況を確認できます。</P>
          <P>商品の発送は通常、発送依頼後3〜7営業日以内に行われます。</P>
          <P>配送時間は配送業者および配送先国により異なります。</P>
        </LegalSection>

        <LegalSection title="返品・返金ポリシー">
          <P>サービスの性質上、購入後のキャンセルは原則として受け付けておりません。</P>
          <P>ただし、以下の場合はサポートへご連絡ください。</P>
          <Ul items={[
            'サービス提供が不可能になった場合',
            '重大な問題が発生した場合',
          ]} />
          <P>状況に応じて返金または代替対応を行います。</P>
        </LegalSection>

        <LegalSection title="商品の責任について">
          <P>当サービスは購入代行サービスであり、商品自体の品質、説明、保証については販売元の責任となります。</P>
          <P>商品に関する問い合わせや保証については、販売元の条件に従います。</P>
        </LegalSection>

        <LegalSection title="その他">
          <P>本サービスの利用条件は利用規約に従います。</P>
          <P>サービスをご利用いただくことで、利用規約に同意したものとみなされます。</P>
        </LegalSection>
      </>
    ),
  },
  'pt-BR': {
    title: 'Divulgação Comercial (特定商取引法に基づく表記)',
    content: (c) => (
      <>
        <P>Esta página apresenta informações sobre o serviço, conforme a Lei Japonesa de Transações Comerciais Especificadas.</P>
        <P>Os Termos de Uso e regulamentos relacionados têm o japonês como idioma oficial; as traduções em outros idiomas são fornecidas apenas como referência.</P>

        <LegalSection title="Vendedor">
          <P>{c.BUSINESS_NAME}</P>
        </LegalSection>

        <LegalSection title="Responsável pela operação">
          <P>{c.BUSINESS_OWNER}</P>
        </LegalSection>

        <LegalSection title="Endereço">
          <P>Será divulgado mediante solicitação.</P>
        </LegalSection>

        <LegalSection title="Telefone">
          <P>Será divulgado mediante solicitação.</P>
        </LegalSection>

        <LegalSection title="E-mail">
          <P>{c.SUPPORT_EMAIL}</P>
        </LegalSection>

        <LegalSection title="Conteúdo do serviço">
          <P>O serviço oferece o seguinte:</P>
          <Ul items={[
            'Serviço de compra por procuração de produtos japoneses',
            'Serviço de personal shopping',
            'Serviço de suporte ao envio internacional',
          ]} />
          <P>O serviço compra produtos em nome do cliente e realiza o envio para o endereço indicado.</P>
        </LegalSection>

        <LegalSection title="Taxas de serviço e frete">
          <P>O valor pago pelo cliente pode incluir:</P>
          <Ul items={[
            'Valor das mercadorias — preço dos produtos adquiridos',
            'Taxa de serviço — taxa pelo serviço de compra e suporte',
            'Frete doméstico (Japão) — do vendedor até nossa base de envio (quando aplicável)',
            'Frete internacional — do nosso serviço até o endereço indicado pelo cliente',
            'Outras taxas opcionais — embalagem especial, seguro, serviços adicionais etc. (quando aplicável)',
          ]} />
          <P>Consulte a página de cada serviço para detalhes.</P>
        </LegalSection>

        <LegalSection title="Formas de pagamento">
          <P>Os seguintes métodos de pagamento estão disponíveis:</P>
          <Ul items={[
            'Cartão de crédito (via Stripe)',
            'Transferência bancária',
            'Serviços de pagamento internacionais (PIX)',
          ]} />
          <P>O pagamento é processado na confirmação do pedido.</P>
        </LegalSection>

        <LegalSection title="Envio das mercadorias">
          <P>O cliente pode acompanhar o status do pedido pela página da conta ou por e-mails de notificação.</P>
          <P>O envio das mercadorias geralmente ocorre em até 3 a 7 dias úteis após a solicitação.</P>
          <P>O prazo de entrega varia conforme a transportadora e o país de destino.</P>
        </LegalSection>

        <LegalSection title="Política de devolução e reembolso">
          <P>Devido à natureza do serviço, o cancelamento após a compra não é aceito em princípio.</P>
          <P>Entre em contato com o suporte nos seguintes casos:</P>
          <Ul items={[
            'Quando for impossível prestar o serviço',
            'Quando ocorrer um problema grave',
          ]} />
          <P>O reembolso ou medidas alternativas serão aplicados conforme o caso.</P>
        </LegalSection>

        <LegalSection title="Responsabilidade sobre as mercadorias">
          <P>O serviço atua como compra por procuração; a qualidade, descrição e garantia das mercadorias são de responsabilidade do vendedor original.</P>
          <P>Dúvidas ou garantias sobre as mercadorias seguem as condições do vendedor.</P>
        </LegalSection>

        <LegalSection title="Demais informações">
          <P>As condições de uso deste serviço seguem os Termos de Uso.</P>
          <P>Ao utilizar o serviço, considera-se que o usuário concorda com os Termos de Uso.</P>
        </LegalSection>
      </>
    ),
  },
  en: {
    title: 'Commercial Disclosure (特定商取引法に基づく表記)',
    content: (c) => (
      <>
        <P>This page provides information about the service in accordance with Japan&apos;s Specified Commercial Transactions Act.</P>
        <P>The Terms of Use and related regulations have Japanese as the official language; translations into other languages are provided for reference only.</P>

        <LegalSection title="Seller">
          <P>{c.BUSINESS_NAME}</P>
        </LegalSection>

        <LegalSection title="Operating representative">
          <P>{c.BUSINESS_OWNER}</P>
        </LegalSection>

        <LegalSection title="Address">
          <P>Will be disclosed upon request.</P>
        </LegalSection>

        <LegalSection title="Phone number">
          <P>Will be disclosed upon request.</P>
        </LegalSection>

        <LegalSection title="Email">
          <P>{c.SUPPORT_EMAIL}</P>
        </LegalSection>

        <LegalSection title="Service content">
          <P>The service provides the following:</P>
          <Ul items={[
            'Japanese product purchasing agency service',
            'Personal shopping service',
            'International shipping support service',
          ]} />
          <P>The service purchases products on behalf of the customer and supports shipping to the specified address.</P>
        </LegalSection>

        <LegalSection title="Service fees and shipping">
          <P>The amount paid by the customer may include:</P>
          <Ul items={[
            'Product price — the price of the products purchased',
            'Service fee — fee for purchasing agency and support',
            'Domestic shipping (Japan) — from seller to our shipping hub (when applicable)',
            'International shipping — from our service to the customer\'s specified address',
            'Other optional service fees — special packaging, insurance, additional services, etc. (when applicable)',
          ]} />
          <P>See each service page for details.</P>
        </LegalSection>

        <LegalSection title="Payment methods">
          <P>The following payment methods are available:</P>
          <Ul items={[
            'Credit card (via Stripe)',
            'Bank transfer',
            'International payment services (PIX)',
          ]} />
          <P>Payment is processed at order confirmation.</P>
        </LegalSection>

        <LegalSection title="Product shipping">
          <P>Customers can check order status via the account page or notification emails.</P>
          <P>Products are typically shipped within 3 to 7 business days after the shipping request.</P>
          <P>Delivery time varies by carrier and destination country.</P>
        </LegalSection>

        <LegalSection title="Return and refund policy">
          <P>Due to the nature of the service, cancellations after purchase are generally not accepted.</P>
          <P>Please contact support in the following cases:</P>
          <Ul items={[
            'When it is impossible to provide the service',
            'When a serious problem occurs',
          ]} />
          <P>Refunds or alternative measures will be taken as appropriate.</P>
        </LegalSection>

        <LegalSection title="Product liability">
          <P>The service is a purchasing agency; product quality, description, and warranty are the responsibility of the original seller.</P>
          <P>Product inquiries and warranty follow the seller\'s terms.</P>
        </LegalSection>

        <LegalSection title="Other">
          <P>The terms of use for this service follow the Terms of Use.</P>
          <P>By using the service, you are deemed to have agreed to the Terms of Use.</P>
        </LegalSection>
      </>
    ),
  },
}

export default function CommercialDisclosure() {
  const { lang } = useLegalLanguage()
  const { BUSINESS_NAME, BUSINESS_OWNER_JA, BUSINESS_OWNER_PT, BUSINESS_OWNER_EN, SUPPORT_EMAIL } = LEGAL_CONFIG
  const owner = lang === 'pt-BR' ? BUSINESS_OWNER_PT : lang === 'en' ? BUSINESS_OWNER_EN : BUSINESS_OWNER_JA
  const cfg = {
    BUSINESS_NAME,
    BUSINESS_OWNER: owner,
    SUPPORT_EMAIL,
  }
  const content = CONTENT[lang] ?? CONTENT.en

  return (
    <>
      <Helmet>
        <title>{content.title} | Legal | Delivery</title>
      </Helmet>

      <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
        {content.title}
      </h2>

      <div className="mt-8 space-y-8">
        {content.content(cfg)}
      </div>
    </>
  )
}
