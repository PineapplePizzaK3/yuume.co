/**
 * Commercial Disclosure - Specified Commercial Transactions Act (特定商取引法に基づく表記).
 * Content in JA (default), PT-BR and EN.
 */
import { Helmet } from 'react-helmet-async'
import { useLegalLanguage } from '../../contexts/LegalLanguageContext'
import { LEGAL_CONFIG } from '../../data/legalConfig'

function LegalSection({ title, content }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-earth-900">{title}</h3>
      <p className="mt-2 text-earth-700">{content}</p>
    </div>
  )
}

const CONTENT = {
  ja: {
    title: '特定商取引法に基づく表記',
    sections: (c) => ({
      vendor: ['販売業者', c.BUSINESS_NAME],
      operator: ['運営責任者', c.BUSINESS_OWNER_JA],
      address: ['所在地', '請求があった場合、遅滞なく開示いたします'],
      phone: ['電話番号', '請求があった場合、遅滞なく開示いたします'],
      email: ['メールアドレス', c.SUPPORT_EMAIL],
      fees: ['追加手数料等の追加料金', 'サービスにより異なります。各サービスページをご確認ください。'],
      returns: ['交換および返品（返金ポリシー）', '商品の性質上、返品・交換には制限がございます。詳細はお問い合わせください。'],
      delivery: ['引渡時期', 'サービスの種類により異なります。各サービスページでご確認ください。'],
      payment: ['受け付け可能な決済手段', 'クレジットカード（Stripe経由）'],
      paymentPeriod: ['決済期間', 'ご注文確定時にお支払いいただきます。'],
      price: ['販売価格', '各サービスページに表示される価格に準じます。'],
    }),
  },
  'pt-BR': {
    title: 'Divulgação Comercial (特定商取引法に基づく表記)',
    sections: (c) => ({
      vendor: ['Vendedor', c.BUSINESS_NAME],
      operator: ['Operador responsável', c.BUSINESS_OWNER_PT],
      address: ['Endereço', 'Será divulgado sob solicitação'],
      phone: ['Telefone', 'Será divulgado sob solicitação'],
      email: ['E-mail', c.SUPPORT_EMAIL],
      fees: ['Taxas adicionais', 'Variam conforme o serviço. Consulte a página de cada serviço.'],
      returns: ['Troca e reembolso', 'Por natureza dos produtos, há restrições. Detalhes sob consulta.'],
      delivery: ['Prazo de entrega', 'Varia conforme o serviço. Consulte a página de cada serviço.'],
      payment: ['Meios de pagamento aceitos', 'Cartão de crédito (via Stripe)'],
      paymentPeriod: ['Prazo de pagamento', 'No momento da confirmação do pedido.'],
      price: ['Preço de venda', 'Conforme valores exibidos nas páginas de serviços.'],
    }),
  },
  en: {
    title: 'Commercial Disclosure (特定商取引法に基づく表記)',
    sections: (c) => ({
      vendor: ['Seller', c.BUSINESS_NAME],
      operator: ['Operating responsible', c.BUSINESS_OWNER_EN],
      address: ['Address', 'Will be disclosed upon request'],
      phone: ['Phone', 'Will be disclosed upon request'],
      email: ['Email', c.SUPPORT_EMAIL],
      fees: ['Additional fees', 'Varies by service. See each service page.'],
      returns: ['Exchange and refund', 'Product nature restricts returns. Details upon request.'],
      delivery: ['Delivery time', 'Varies by service. See each service page.'],
      payment: ['Accepted payment methods', 'Credit card (via Stripe)'],
      paymentPeriod: ['Payment period', 'At order confirmation.'],
      price: ['Selling price', 'As displayed on service pages.'],
    }),
  },
}

export default function CommercialDisclosure() {
  const { lang } = useLegalLanguage()
  const { BUSINESS_NAME, BUSINESS_OWNER_JA, BUSINESS_OWNER_PT, BUSINESS_OWNER_EN, SUPPORT_EMAIL } = LEGAL_CONFIG
  const cfg = {
    BUSINESS_NAME,
    BUSINESS_OWNER_JA,
    BUSINESS_OWNER_PT,
    BUSINESS_OWNER_EN,
    SUPPORT_EMAIL,
  }
  const content = CONTENT[lang]
  const sections = content.sections(cfg)

  return (
    <>
      <Helmet>
        <title>{content.title} | Legal | Delivery</title>
      </Helmet>

      <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
        {content.title}
      </h2>

      <div className="mt-8 space-y-6">
        <LegalSection title={sections.vendor[0]} content={sections.vendor[1]} />
        <LegalSection title={sections.operator[0]} content={sections.operator[1]} />
        <LegalSection title={sections.address[0]} content={sections.address[1]} />
        <LegalSection title={sections.phone[0]} content={sections.phone[1]} />
        <LegalSection title={sections.email[0]} content={sections.email[1]} />
        <LegalSection title={sections.fees[0]} content={sections.fees[1]} />
        <LegalSection title={sections.returns[0]} content={sections.returns[1]} />
        <LegalSection title={sections.delivery[0]} content={sections.delivery[1]} />
        <LegalSection title={sections.payment[0]} content={sections.payment[1]} />
        <LegalSection title={sections.paymentPeriod[0]} content={sections.paymentPeriod[1]} />
        <LegalSection title={sections.price[0]} content={sections.price[1]} />
      </div>
    </>
  )
}
