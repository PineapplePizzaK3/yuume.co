/**
 * Privacy Policy - Content in JA (default), PT-BR and EN.
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
    title: 'プライバシーポリシー',
    content: (c) => (
      <>
        <P>Eiko&apos;s Delivery Service（以下「当サービス」）は、お客様の個人情報の保護を重要な責任と考えています。本プライバシーポリシーは、当サービスにおける個人情報の収集、利用、および管理について説明するものです。</P>

        <LegalSection title="1. 収集する情報">
          <P>当サービスは、以下の情報を収集する場合があります。</P>
          <Ul items={[
            '氏名',
            'メールアドレス',
            '配送先住所',
            '電話番号',
            '購入履歴および注文情報',
            'サービス利用履歴',
            'Cookieやアクセスログなどの技術情報',
          ]} />
          <P>これらの情報は、お客様が当サービスを利用する際に提供される情報、またはサービス利用時に自動的に取得される情報です。</P>
        </LegalSection>

        <LegalSection title="2. 個人情報の利用目的">
          <P>当サービスは、取得した個人情報を以下の目的で利用します。</P>
          <Ul items={[
            'サービス提供および注文処理',
            '購入代行および発送手続き',
            '本人確認およびアカウント管理',
            '決済処理および請求管理',
            'カスタマーサポート対応',
            'サービス改善および不正防止',
          ]} />
        </LegalSection>

        <LegalSection title="3. 決済処理">
          <P>当サービスの決済は Stripe を通じて処理されます。</P>
          <P>クレジットカードなどの決済情報は当サービスのサーバーには保存されず、Stripeのセキュリティ基準に従って安全に処理されます。</P>
          <P>Stripeのプライバシーポリシーについては以下をご参照ください。<br /><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. 個人情報の第三者提供">
          <P>当サービスは、以下の場合を除き、お客様の個人情報を第三者に提供しません。</P>
          <Ul items={[
            '決済処理のための決済サービスプロバイダー',
            '配送のための物流会社',
            '法令に基づく場合',
          ]} />
        </LegalSection>

        <LegalSection title="5. Cookieの使用">
          <P>当サイトでは、サービスの利便性向上およびアクセス解析のためCookieを使用する場合があります。</P>
          <P>Cookieの使用を希望しない場合は、ブラウザ設定により無効化することができます。ただし、一部の機能が利用できなくなる場合があります。</P>
        </LegalSection>

        <LegalSection title="6. 個人情報の管理">
          <P>当サービスは、個人情報の漏洩、紛失、改ざん、不正アクセスを防止するため、適切なセキュリティ対策を講じます。</P>
        </LegalSection>

        <LegalSection title="7. 個人情報の開示・訂正・削除">
          <P>お客様は、ご自身の個人情報について開示、訂正、削除を希望する場合、当サービスまでご連絡いただくことができます。</P>
        </LegalSection>

        <LegalSection title="8. プライバシーポリシーの変更">
          <P>当サービスは、法令の変更またはサービス改善のため、本ポリシーを変更する場合があります。変更後の内容は本サイト上に掲載された時点で効力を持ちます。</P>
        </LegalSection>

        <LegalSection title="9. お問い合わせ">
          <P>本ポリシーに関するお問い合わせは以下までご連絡ください。</P>
          <P><strong>{c.BUSINESS_NAME}</strong><br />Email: {c.SUPPORT_EMAIL}</P>
        </LegalSection>
      </>
    ),
  },
  'pt-BR': {
    title: 'Política de Privacidade',
    content: (c) => (
      <>
        <P>O Eiko&apos;s Delivery Service (&quot;o Serviço&quot;) considera a proteção dos dados pessoais dos clientes uma responsabilidade importante. Esta Política de Privacidade descreve a coleta, uso e gestão de informações pessoais em nosso serviço.</P>

        <LegalSection title="1. Informações coletadas">
          <P>O Serviço pode coletar as seguintes informações:</P>
          <Ul items={[
            'Nome',
            'Endereço de e-mail',
            'Endereço de entrega',
            'Número de telefone',
            'Histórico de compras e informações de pedidos',
            'Histórico de uso do serviço',
            'Informações técnicas como cookies e logs de acesso',
          ]} />
          <P>Essas informações são fornecidas pelo cliente ao utilizar o serviço ou obtidas automaticamente durante o uso.</P>
        </LegalSection>

        <LegalSection title="2. Finalidade do uso dos dados pessoais">
          <P>O Serviço utiliza os dados pessoais obtidos para os seguintes fins:</P>
          <Ul items={[
            'Prestação do serviço e processamento de pedidos',
            'Compra por procuração e procedimentos de envio',
            'Verificação de identidade e gestão de conta',
            'Processamento de pagamentos e gestão de cobrança',
            'Atendimento ao cliente',
            'Melhoria do serviço e prevenção de fraudes',
          ]} />
        </LegalSection>

        <LegalSection title="3. Processamento de pagamentos">
          <P>Os pagamentos do Serviço são processados através do Stripe.</P>
          <P>Informações de pagamento, como dados de cartão de crédito, não são armazenadas em nossos servidores e são processadas de forma segura de acordo com os padrões de segurança do Stripe.</P>
          <P>Para a política de privacidade do Stripe, consulte: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. Fornecimento a terceiros">
          <P>O Serviço não fornece dados pessoais a terceiros, exceto nos seguintes casos:</P>
          <Ul items={[
            'Provedores de serviços de pagamento para processamento de pagamentos',
            'Empresas de logística para entrega',
            'Casos previstos em lei',
          ]} />
        </LegalSection>

        <LegalSection title="5. Uso de cookies">
          <P>Este site pode usar cookies para melhorar a usabilidade do serviço e análise de acesso.</P>
          <P>É possível desativar os cookies nas configurações do navegador. No entanto, algumas funcionalidades podem deixar de funcionar.</P>
        </LegalSection>

        <LegalSection title="6. Gestão dos dados pessoais">
          <P>O Serviço adota medidas de segurança apropriadas para evitar vazamento, perda, adulteração e acesso não autorizado aos dados pessoais.</P>
        </LegalSection>

        <LegalSection title="7. Divulgação, correção e exclusão">
          <P>O cliente pode solicitar divulgação, correção ou exclusão de seus dados pessoais entrando em contato com o Serviço.</P>
        </LegalSection>

        <LegalSection title="8. Alterações na política">
          <P>O Serviço pode alterar esta política devido a mudanças na legislação ou melhorias no serviço. O conteúdo alterado entra em vigor a partir da publicação neste site.</P>
        </LegalSection>

        <LegalSection title="9. Contato">
          <P>Para questões sobre esta política, entre em contato:</P>
          <P><strong>{c.BUSINESS_NAME}</strong><br />Email: {c.SUPPORT_EMAIL}</P>
        </LegalSection>
      </>
    ),
  },
  en: {
    title: 'Privacy Policy',
    content: (c) => (
      <>
        <P>Eiko&apos;s Delivery Service (&quot;the Service&quot;) considers the protection of our customers&apos; personal information an important responsibility. This Privacy Policy describes the collection, use, and management of personal information in our service.</P>

        <LegalSection title="1. Information collected">
          <P>The Service may collect the following information:</P>
          <Ul items={[
            'Name',
            'Email address',
            'Shipping address',
            'Phone number',
            'Purchase history and order information',
            'Service usage history',
            'Technical information such as cookies and access logs',
          ]} />
          <P>This information is provided by the customer when using the service or obtained automatically during use.</P>
        </LegalSection>

        <LegalSection title="2. Purpose of use of personal information">
          <P>The Service uses the personal information obtained for the following purposes:</P>
          <Ul items={[
            'Service provision and order processing',
            'Purchasing agency and shipping procedures',
            'Identity verification and account management',
            'Payment processing and billing management',
            'Customer support',
            'Service improvement and fraud prevention',
          ]} />
        </LegalSection>

        <LegalSection title="3. Payment processing">
          <P>Payments for the Service are processed through Stripe.</P>
          <P>Payment information such as credit card details is not stored on our servers and is processed securely in accordance with Stripe&apos;s security standards.</P>
          <P>For Stripe&apos;s privacy policy, please refer to: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. Third-party disclosure">
          <P>The Service does not provide personal information to third parties, except in the following cases:</P>
          <Ul items={[
            'Payment service providers for payment processing',
            'Logistics companies for delivery',
            'Cases required by law',
          ]} />
        </LegalSection>

        <LegalSection title="5. Use of cookies">
          <P>This site may use cookies to improve service usability and for access analysis.</P>
          <P>You can disable cookies in your browser settings. However, some features may become unavailable.</P>
        </LegalSection>

        <LegalSection title="6. Management of personal information">
          <P>The Service implements appropriate security measures to prevent leakage, loss, tampering, and unauthorized access to personal information.</P>
        </LegalSection>

        <LegalSection title="7. Disclosure, correction, and deletion">
          <P>Customers may request disclosure, correction, or deletion of their personal information by contacting the Service.</P>
        </LegalSection>

        <LegalSection title="8. Changes to the policy">
          <P>The Service may change this policy due to legal changes or service improvements. The revised content takes effect upon publication on this site.</P>
        </LegalSection>

        <LegalSection title="9. Contact">
          <P>For inquiries regarding this policy, please contact:</P>
          <P><strong>{c.BUSINESS_NAME}</strong><br />Email: {c.SUPPORT_EMAIL}</P>
        </LegalSection>
      </>
    ),
  },
}

export default function PrivacyPolicy() {
  const { lang } = useLegalLanguage()
  const { BUSINESS_NAME, SUPPORT_EMAIL } = LEGAL_CONFIG
  const cfg = { BUSINESS_NAME, SUPPORT_EMAIL }
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
