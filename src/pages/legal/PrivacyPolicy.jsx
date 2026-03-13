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
      <div className="mt-2 space-y-2 text-earth-700">{children}</div>
    </div>
  )
}

const CONTENT = {
  ja: {
    title: 'プライバシーポリシー',
    intro: '本プライバシーポリシーは、当サービスにおけるお客様の個人情報の取り扱いについて定めたものです。',
    dataCollection: ['データの収集', '当サービスでは、サービスの提供、改善、およびお客様サポートのために必要な情報を収集します。'],
    account: ['アカウント情報', '登録時およびアカウント管理において、メールアドレス、お名前等の情報を収集し、安全に保存します。これらの情報は、お客様のアカウント認証とサービス提供の目的でのみ使用されます。'],
    stripe: ['決済処理（Stripe）', '決済はStripeを経由して行われます。クレジットカード番号等の決済情報は当社のサーバーには保存されず、Stripeが厳格なセキュリティ基準に従って処理します。Stripeのプライバシーポリシーは https://stripe.com/privacy をご参照ください。'],
    cookies: ['Cookie', '当サイトでは、セッション管理、認証、およびサービス改善のためCookieを使用することがあります。お客様はブラウザの設定でCookieを無効にできますが、一部の機能が利用できなくなる場合があります。'],
    sharing: ['第三者との共有', '当社は、法的義務を除き、お客様の同意なく個人情報を第三者に販売・譲渡しません。決済処理のためStripeと、サービス運営のため必要な範囲でクラウドプロバイダーと共有することがあります。'],
    contactLabel: 'お問い合わせ',
    contact: (email) => `プライバシーに関するご質問は ${email} までご連絡ください。`,
  },
  'pt-BR': {
    title: 'Política de Privacidade',
    intro: 'Esta política define como tratamos seus dados pessoais em nosso serviço.',
    dataCollection: ['Coleta de dados', 'Coletamos as informações necessárias para prestar, melhorar e dar suporte ao serviço.'],
    account: ['Informações da conta', 'Coletamos e armazenamos com segurança e-mail, nome e dados de conta para autenticação e uso do serviço.'],
    stripe: ['Pagamentos (Stripe)', 'Os pagamentos são processados pelo Stripe. Dados de cartão não são armazenados em nossos servidores. O Stripe segue rígidos padrões de segurança. Veja https://stripe.com/privacy'],
    cookies: ['Cookies', 'Usamos cookies para sessão, autenticação e melhoria do serviço. Você pode desativá-los no navegador, mas algumas funções podem deixar de funcionar.'],
    sharing: ['Compartilhamento', 'Não vendemos nem transferimos seus dados a terceiros sem consentimento, exceto quando exigido por lei ou para processamento de pagamentos (Stripe) e operação do serviço.'],
    contactLabel: 'Contato',
    contact: (email) => `Dúvidas sobre privacidade: ${email}`,
  },
  en: {
    title: 'Privacy Policy',
    intro: 'This policy describes how we handle your personal data.',
    dataCollection: ['Data collection', 'We collect information necessary to provide, improve, and support the service.'],
    account: ['Account information', 'We collect and securely store email, name, and account data for authentication and service use.'],
    stripe: ['Payments (Stripe)', 'Payments are processed by Stripe. Card data is not stored on our servers. Stripe adheres to strict security standards. See https://stripe.com/privacy'],
    cookies: ['Cookies', 'We use cookies for session, authentication, and service improvement. You may disable them in your browser, but some features may stop working.'],
    sharing: ['Sharing', 'We do not sell or transfer your data to third parties without consent, except when required by law or for payment processing (Stripe) and service operation.'],
    contactLabel: 'Contact',
    contact: (email) => `Privacy questions: ${email}`,
  },
}

export default function PrivacyPolicy() {
  const { lang } = useLegalLanguage()
  const { SUPPORT_EMAIL } = LEGAL_CONFIG
  const c = CONTENT[lang]

  return (
    <>
      <Helmet>
        <title>{c.title} | Legal | Delivery</title>
      </Helmet>

      <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
        {c.title}
      </h2>

      <p className="mt-4 text-earth-600">{c.intro}</p>

      <div className="mt-8 space-y-6">
        <LegalSection title={c.dataCollection[0]}>
          <p>{c.dataCollection[1]}</p>
        </LegalSection>
        <LegalSection title={c.account[0]}>
          <p>{c.account[1]}</p>
        </LegalSection>
        <LegalSection title={c.stripe[0]}>
          <p>{c.stripe[1]}</p>
        </LegalSection>
        <LegalSection title={c.cookies[0]}>
          <p>{c.cookies[1]}</p>
        </LegalSection>
        <LegalSection title={c.sharing[0]}>
          <p>{c.sharing[1]}</p>
        </LegalSection>
        <LegalSection title={c.contactLabel}>
          <p>{c.contact(SUPPORT_EMAIL)}</p>
        </LegalSection>
      </div>
    </>
  )
}
