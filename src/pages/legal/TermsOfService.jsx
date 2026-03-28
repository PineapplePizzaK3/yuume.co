/**
 * Terms of Service - 利用規約. Content in JA (default), PT-BR and EN.
 */
import { Helmet } from 'react-helmet-async'
import { useLegalLanguage } from '../../contexts/LegalLanguageContext'
import { LEGAL_CONFIG } from '../../data/legalConfig'
import { TermsOfUsePtBrBody } from '../../legal/TermsOfUsePtBrBody'

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
    title: '利用規約',
    subtitle: 'Eiko\'s Delivery Service 利用規約',
    content: (c) => (
      <>
        <P>本利用規約（以下「本規約」）は、{c.BUSINESS_NAME}（以下「当サービス」）が提供するサービスの利用条件を定めるものです。ユーザーは本サービスを利用することにより、本規約に同意したものとみなされます。</P>

        <LegalSection title="第1条（サービス内容）">
          <P>当サービスは以下のサービスを提供します。</P>
          <Ul items={[
            '日本の商品購入代行',
            'パーソナルショッピングサービス',
            '商品の受取および海外発送サポート',
          ]} />
          <P>当サービスは、ユーザーが指定した商品を購入または発送するためのサポートを行います。</P>
        </LegalSection>

        <LegalSection title="第2条（アカウント登録）">
          <P>ユーザーは、本サービスの利用にあたりアカウント登録を行う場合があります。</P>
          <P>ユーザーは登録情報を正確に提供する責任を負います。</P>
          <P>虚偽の情報が登録された場合、当サービスはアカウントを停止または削除する権利を有します。</P>
        </LegalSection>

        <LegalSection title="第3条（アカウント管理）">
          <P>ユーザーはアカウントのIDおよびパスワードを自己責任で管理するものとします。</P>
          <P>第三者による不正利用が発生した場合、速やかに当サービスへ連絡してください。</P>
        </LegalSection>

        <LegalSection title="第4条（決済）">
          <P>サービス料金は Stripe を通じて支払われます。</P>
          <P>支払いが完了した時点で注文が確定します。</P>
          <P>決済処理はStripeのセキュリティ基準に従って行われ、クレジットカード情報は当サービスのサーバーには保存されません。</P>
        </LegalSection>

        <LegalSection title="第5条（料金）">
          <P>ユーザーは以下の費用を負担する場合があります。</P>
          <Ul items={[
            '商品代金',
            '日本国内送料',
            '国際送料',
            'サービス手数料',
            'その他オプションサービス費用',
          ]} />
          <P>料金の詳細は各サービスページに表示されます。</P>
        </LegalSection>

        <LegalSection title="第6条（禁止商品）">
          <P>以下の商品は取り扱うことができません。</P>
          <Ul items={[
            '違法な商品',
            '武器、爆発物、危険物',
            '麻薬および違法薬物',
            '配送業者が輸送できない商品',
            '輸出入が禁止されている商品',
          ]} />
          <P>その他、当サービスが不適切と判断した商品についても取り扱いを拒否する場合があります。</P>
        </LegalSection>

        <LegalSection title="第7条（配送）">
          <P>商品はユーザーの指定した住所へ発送されます。</P>
          <P>配送中の遅延、通関、輸入税などについては配送業者および各国の規制に依存します。</P>
          <P>ユーザーは輸入税および関税を負担する責任があります。</P>
        </LegalSection>

        <LegalSection title="第8条（返品およびキャンセル）">
          <P>商品の性質上、注文確定後のキャンセルは原則として受け付けていません。</P>
          <P>返品および返金は、販売元のポリシーおよび状況に応じて対応します。</P>
        </LegalSection>

        <LegalSection title="第9条（責任の制限）">
          <P>当サービスは以下について責任を負いません。</P>
          <Ul items={[
            '販売者が提供する商品情報の正確性',
            '商品の品質や真贋',
            '配送遅延または配送中の損傷',
            '税関による商品の没収または遅延',
          ]} />
          <P>当サービスの責任は、法律で認められる範囲内に限定されます。</P>
        </LegalSection>

        <LegalSection title="第10条（サービスの変更）">
          <P>当サービスは、事前通知なくサービス内容を変更または停止する場合があります。</P>
        </LegalSection>

        <LegalSection title="第11条（規約の変更）">
          <P>当サービスは必要に応じて本規約を変更することがあります。</P>
          <P>変更後の規約はサイトに掲載された時点で効力を持ちます。</P>
        </LegalSection>

        <LegalSection title="第12条（準拠法）">
          <P>本規約は日本法に基づいて解釈されます。</P>
          <P>本サービスに関する紛争は、日本の裁判所を専属的合意管轄とします。</P>
        </LegalSection>

        <LegalSection title="お問い合わせ">
          <P><strong>{c.BUSINESS_NAME}</strong><br />Email: {c.SUPPORT_EMAIL}</P>
        </LegalSection>
      </>
    ),
  },
  'pt-BR': {
    title: 'Termos de Uso',
    subtitle: 'Eiko\'s Delivery Service - Termos de Uso',
    content: (c) => <TermsOfUsePtBrBody cfg={c} />,
  },
  en: {
    title: 'Terms of Use',
    subtitle: 'Eiko\'s Delivery Service - Terms of Use',
    content: (c) => (
      <>
        <P>These Terms of Use (&quot;Terms&quot;) establish the conditions for use of the services provided by {c.BUSINESS_NAME} (&quot;the Service&quot;). By using the Service, the user is deemed to have agreed to these Terms.</P>

        <LegalSection title="Article 1 (Service content)">
          <P>The Service provides the following:</P>
          <Ul items={[
            'Japanese product purchasing agency',
            'Personal shopping service',
            'Product reception and international shipping support',
          ]} />
          <P>The Service provides support for purchasing or shipping products specified by the user.</P>
        </LegalSection>

        <LegalSection title="Article 2 (Account registration)">
          <P>Users may register an account to use the Service.</P>
          <P>Users are responsible for providing accurate registration information.</P>
          <P>If false information is registered, the Service has the right to suspend or delete the account.</P>
        </LegalSection>

        <LegalSection title="Article 3 (Account management)">
          <P>Users shall manage their account ID and password at their own responsibility.</P>
          <P>In case of unauthorized use by third parties, please contact the Service immediately.</P>
        </LegalSection>

        <LegalSection title="Article 4 (Payment)">
          <P>Service fees are paid through Stripe.</P>
          <P>Orders are confirmed when payment is completed.</P>
          <P>Payment processing follows Stripe&apos;s security standards; credit card information is not stored on our servers.</P>
        </LegalSection>

        <LegalSection title="Article 5 (Fees)">
          <P>Users may be responsible for the following costs:</P>
          <Ul items={[
            'Product price',
            'Domestic shipping (Japan)',
            'International shipping',
            'Service fee',
            'Other optional service costs',
          ]} />
          <P>Fee details are displayed on each service page.</P>
        </LegalSection>

        <LegalSection title="Article 6 (Prohibited products)">
          <P>The following products cannot be handled:</P>
          <Ul items={[
            'Illegal products',
            'Weapons, explosives, hazardous materials',
            'Narcotics and illegal drugs',
            'Products that carriers cannot transport',
            'Products whose import or export is prohibited',
          ]} />
          <P>The Service may refuse other products it deems inappropriate.</P>
        </LegalSection>

        <LegalSection title="Article 7 (Shipping)">
          <P>Products are shipped to the address specified by the user.</P>
          <P>Delivery delays, customs clearance, and import taxes depend on the carrier and each country&apos;s regulations.</P>
          <P>Users are responsible for import taxes and duties.</P>
        </LegalSection>

        <LegalSection title="Article 8 (Returns and cancellation)">
          <P>Due to the nature of the products, cancellations after order confirmation are generally not accepted.</P>
          <P>Returns and refunds are handled according to the seller&apos;s policy and circumstances.</P>
        </LegalSection>

        <LegalSection title="Article 9 (Limitation of liability)">
          <P>The Service is not responsible for:</P>
          <Ul items={[
            'Accuracy of product information provided by the seller',
            'Product quality or authenticity',
            'Delivery delays or damage during shipping',
            'Product seizure or delays by customs',
          ]} />
          <P>The Service&apos;s liability is limited to the extent permitted by law.</P>
        </LegalSection>

        <LegalSection title="Article 10 (Service changes)">
          <P>The Service may change or discontinue service content without prior notice.</P>
        </LegalSection>

        <LegalSection title="Article 11 (Terms changes)">
          <P>The Service may change these Terms when necessary.</P>
          <P>Revised Terms take effect upon publication on the site.</P>
        </LegalSection>

        <LegalSection title="Article 12 (Governing law)">
          <P>These Terms are interpreted in accordance with Japanese law.</P>
          <P>Disputes related to the Service shall be subject to the exclusive jurisdiction of the courts of Japan.</P>
        </LegalSection>

        <LegalSection title="Contact">
          <P><strong>{c.BUSINESS_NAME}</strong><br />Email: {c.SUPPORT_EMAIL}</P>
        </LegalSection>
      </>
    ),
  },
}

export default function TermsOfService() {
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
      {content.subtitle && (
        <p className="mt-1 text-earth-600">{content.subtitle}</p>
      )}

      <div className="mt-8 space-y-8">
        {content.content(cfg)}
      </div>
    </>
  )
}
