/**
 * Terms of Service - Content in JA (default), PT-BR and EN.
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
    title: '利用規約',
    intro: '本規約は、当サービスをご利用いただく際に適用されます。ご利用により、本規約に同意いただいたものとみなします。',
    usage: ['サービスの利用', '当サービスは、日本からのリダイレクト購入、パーソナルショッピング、およびオンラインショップの運営を行うプラットフォームです。お客様は本規約に従い、適法な目的でサービスをご利用ください。'],
    account: ['アカウントの責任', 'アカウントの管理はお客様の責任です。パスワードの漏洩や不正利用を防ぐため適切に管理し、不審なアクセスがあった場合は速やかに当社へご連絡ください。'],
    prohibited: ['禁止事項', '以下の行為を禁止します：不正アクセス、法令違反、他者への迷惑行為、当社システムへの攻撃、虚偽の情報の登録、その他当社が不適切と判断する行為。'],
    payment: ['決済（Stripe）', '料金のお支払いはStripeを経由して行われます。お支払いが完了した時点で契約が成立します。返金については各サービスのポリシーに従います。'],
    liability: ['責任の制限', '当社は、法令で認められる範囲を超えて、サービスの中断、データの損失、または損害について責任を負いません。サービスの利用は「現状のまま」提供されます。'],
    changes: ['規約の変更', '当社は、必要に応じて本規約を変更することがあります。重要な変更については、当サイト上での掲示、またはメール等でお知らせします。変更後の規約は掲示後に適用されます。'],
    contactLabel: 'お問い合わせ',
    contact: (email) => `本規約に関するお問い合わせは ${email} までご連絡ください。`,
  },
  'pt-BR': {
    title: 'Termos de Uso',
    intro: 'Ao utilizar o serviço, você concorda com estes termos.',
    usage: ['Uso do serviço', 'Oferecemos redirecionamento de compras, personal shopping e loja virtual. Use o serviço de forma legal e em conformidade com estes termos.'],
    account: ['Responsabilidade da conta', 'Você é responsável por gerenciar sua conta. Proteja sua senha e avise-nos em caso de uso indevido.'],
    prohibited: ['Condutas proibidas', 'É proibido: acesso não autorizado, atos ilegais, perturbação a terceiros, ataques aos sistemas, informações falsas ou outras condutas que considerarmos inadequadas.'],
    payment: ['Pagamentos (Stripe)', 'O pagamento é feito via Stripe. O contrato é firmado na conclusão do pagamento. Reembolsos seguem a política de cada serviço.'],
    liability: ['Limitação de responsabilidade', 'Nosso compromisso se limita ao que a lei permitir. Não nos responsabilizamos por interrupções, perda de dados ou danos indiretos além do permitido.'],
    changes: ['Alteração dos termos', 'Podemos alterar estes termos quando necessário. Mudanças relevantes serão comunicadas no site ou por e-mail.'],
    contactLabel: 'Contato',
    contact: (email) => `Dúvidas sobre os termos: ${email}`,
  },
  en: {
    title: 'Terms of Service',
    intro: 'By using the service, you agree to these terms.',
    usage: ['Service usage', 'We offer purchase redirection, personal shopping, and virtual store. Use the service legally and in accordance with these terms.'],
    account: ['Account responsibility', 'You are responsible for managing your account. Protect your password and notify us of any misuse.'],
    prohibited: ['Prohibited conduct', 'Prohibited: unauthorized access, illegal acts, disturbance to others, attacks on systems, false information, or other conduct we deem inappropriate.'],
    payment: ['Payments (Stripe)', 'Payment is made via Stripe. The contract is formed upon payment completion. Refunds follow each service\'s policy.'],
    liability: ['Limitation of liability', 'We are liable only to the extent permitted by law. We are not liable for interruptions, data loss, or indirect damages beyond what is permitted.'],
    changes: ['Terms modification', 'We may modify these terms when necessary. Significant changes will be communicated on the site or by email.'],
    contactLabel: 'Contact',
    contact: (email) => `Questions about the terms: ${email}`,
  },
}

export default function TermsOfService() {
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
        <LegalSection title={c.usage[0]}>
          <p>{c.usage[1]}</p>
        </LegalSection>
        <LegalSection title={c.account[0]}>
          <p>{c.account[1]}</p>
        </LegalSection>
        <LegalSection title={c.prohibited[0]}>
          <p>{c.prohibited[1]}</p>
        </LegalSection>
        <LegalSection title={c.payment[0]}>
          <p>{c.payment[1]}</p>
        </LegalSection>
        <LegalSection title={c.liability[0]}>
          <p>{c.liability[1]}</p>
        </LegalSection>
        <LegalSection title={c.changes[0]}>
          <p>{c.changes[1]}</p>
        </LegalSection>
        <LegalSection title={c.contactLabel}>
          <p>{c.contact(SUPPORT_EMAIL)}</p>
        </LegalSection>
      </div>
    </>
  )
}
