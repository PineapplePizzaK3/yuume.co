/**
 * Privacy Policy - Content in JA (default), PT-BR and EN.
 */
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
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
        <P>YuumeCo（以下「当サービス」）は、お客様の個人情報の保護を重要な責任と考えています。本プライバシーポリシーは、当サービスにおける個人情報の収集、利用、および管理について説明するものです。</P>

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
          <P>当サービスの決済は、注文内容・地域・選択された支払い方法に応じて、Stripe、Parcelow、Glin、PIX（銀行送金）関連の手段を利用して処理されます。</P>
          <P>クレジットカード等の機微な決済情報は、原則として各決済事業者側で処理され、当サービス側には保存されません（決済状態や取引参照ID等の運用情報のみ保持する場合があります）。</P>
          <P>詳細は各事業者のポリシーをご確認ください。Stripe: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. 個人情報の第三者提供">
          <P>当サービスは、法令上認められる場合を除き、必要最小限の範囲でのみ外部サービスに情報を共有します。</P>
          <Ul items={[
            '認証・データ基盤（Supabase）',
            '決済処理（Stripe、Parcelow、Glin、PIX関連事業者）',
            '配送・通関対応のための物流会社等',
            'お問い合わせ送信（Web3Forms）',
            '法令・裁判所命令等に基づく開示が必要な場合',
          ]} />
        </LegalSection>

        <LegalSection title="5. Cookie・ローカルストレージの使用">
          <P>当サイトでは、ログイン状態の維持、言語選択、Cookie同意状態、UI設定等の保存のために、Cookieまたはブラウザのローカルストレージを利用する場合があります。</P>
          <P>これらを無効化すると、認証維持や一部機能が正しく動作しない可能性があります。</P>
        </LegalSection>

        <LegalSection title="6. 個人情報の管理">
          <P>当サービスは、個人情報の漏えい・紛失・改ざん・不正アクセス防止のため、アクセス制御、通信の暗号化、権限分離等の合理的な安全管理措置を実施します。</P>
        </LegalSection>

        <LegalSection title="7. 個人情報の開示・訂正・削除">
          <P>お客様は、ご自身の個人情報について開示、訂正、削除、利用停止等を希望する場合、当サービスまでご連絡いただくことができます。法令に基づき、合理的な範囲で対応します。</P>
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
        <P>A YuumeCo (&quot;o Serviço&quot;) considera a proteção dos dados pessoais dos clientes uma responsabilidade importante. Esta Política de Privacidade descreve a coleta, uso e gestão de informações pessoais em nosso serviço.</P>

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
          <P>Os pagamentos podem ser processados por diferentes meios, conforme o tipo de pedido e a opção escolhida no checkout, incluindo Stripe, Parcelow, Glin e fluxos relacionados a PIX.</P>
          <P>Dados sensíveis de pagamento (como dados completos de cartão) são, em regra, processados pelos provedores de pagamento e não armazenados diretamente pela YuumeCo, que mantém apenas dados operacionais da transação (como status e identificadores).</P>
          <P>Para a política de privacidade do Stripe, consulte: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. Compartilhamento com terceiros">
          <P>O Serviço compartilha dados apenas quando necessário para operar a plataforma e cumprir obrigações legais.</P>
          <Ul items={[
            'Infraestrutura de autenticação e banco de dados (Supabase)',
            'Provedores de pagamento (Stripe, Parcelow, Glin e operadores relacionados ao PIX)',
            'Empresas de logística e parceiros necessários ao envio/entrega',
            'Plataforma de envio de formulário de contato (Web3Forms)',
            'Situações previstas em lei, ordem judicial ou obrigação regulatória',
          ]} />
        </LegalSection>

        <LegalSection title="5. Uso de cookies e armazenamento local">
          <P>Este site pode usar cookies e armazenamento local do navegador para manter sessão autenticada, preferências de idioma, estado de consentimento e funcionamento da interface.</P>
          <P>É possível restringir esse uso nas configurações do navegador, mas isso pode impedir o funcionamento correto de recursos essenciais.</P>
        </LegalSection>

        <LegalSection title="6. Gestão e segurança dos dados pessoais">
          <P>O Serviço adota medidas técnicas e organizacionais razoáveis para reduzir riscos de vazamento, perda, alteração indevida e acesso não autorizado, incluindo controle de acesso, segregação de permissões e uso de conexões seguras.</P>
        </LegalSection>

        <LegalSection title="7. Direitos do titular (acesso, correção e exclusão)">
          <P>O cliente pode solicitar acesso, correção, atualização, anonimização, bloqueio ou exclusão de dados pessoais, quando aplicável, entrando em contato com o Serviço. As solicitações serão tratadas conforme a legislação aplicável (incluindo a LGPD, quando cabível).</P>
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
        <P>YuumeCo (&quot;the Service&quot;) considers the protection of our customers&apos; personal information an important responsibility. This Privacy Policy describes the collection, use, and management of personal information in our service.</P>

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
          <P>Payments may be processed through different providers depending on checkout selection and transaction type, including Stripe, Parcelow, Glin, and PIX-related payment flows.</P>
          <P>Sensitive payment credentials (such as full card data) are generally processed by payment providers, not stored directly on YuumeCo servers. We may retain operational payment metadata (for example, status and transaction reference IDs).</P>
          <P>For Stripe&apos;s privacy policy, please refer to: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-earth-800 underline hover:text-earth-900">https://stripe.com/privacy</a></P>
        </LegalSection>

        <LegalSection title="4. Third-party sharing">
          <P>The Service shares personal data only when necessary to operate the platform and comply with legal obligations.</P>
          <Ul items={[
            'Authentication and database infrastructure (Supabase)',
            'Payment providers (Stripe, Parcelow, Glin, and PIX-related operators)',
            'Logistics and shipping partners required for delivery',
            'Contact form processing platform (Web3Forms)',
            'Disclosures required by law, court order, or regulatory obligation',
          ]} />
        </LegalSection>

        <LegalSection title="5. Use of cookies and local storage">
          <P>This site may use cookies and browser local storage to keep authenticated sessions, language preference, consent status, and UI state required for service functionality.</P>
          <P>You may disable these mechanisms in your browser settings, but doing so can prevent essential features from working properly.</P>
        </LegalSection>

        <LegalSection title="6. Management of personal information">
          <P>The Service implements reasonable technical and organizational safeguards to reduce risks of leakage, loss, tampering, and unauthorized access, including access controls, permission segregation, and secure transport.</P>
        </LegalSection>

        <LegalSection title="7. Data subject rights (access, correction, deletion)">
          <P>Customers may request access, correction, update, restriction, or deletion of personal information, when applicable, by contacting the Service. Requests are handled in accordance with applicable privacy laws.</P>
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
  const { t } = useTranslation()
  const { lang } = useLegalLanguage()
  const { BUSINESS_NAME, SUPPORT_EMAIL } = LEGAL_CONFIG
  const cfg = { BUSINESS_NAME, SUPPORT_EMAIL }
  const content = CONTENT[lang] ?? CONTENT.en

  return (
    <>
      <PageSeo routeKey="legalPrivacy" title={null} description={t('meta.legalPrivacy.description')} />
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
