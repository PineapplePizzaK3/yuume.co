/**
 * Full Terms of Use and Services — English (legal page).
 * Last updated: March 30, 2026.
 */
import { Link } from 'react-router-dom'

function LegalSection({ title, children }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-earth-900">{title}</h3>
      <div className="mt-2 space-y-2 text-earth-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">{children}</div>
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

function Subt({ children }) {
  return <p className="font-semibold text-earth-900">{children}</p>
}

/**
 * @param {{ BUSINESS_NAME: string, SUPPORT_EMAIL: string, SUPPORT_PHONE?: string }} cfg
 */
export function TermsOfUseEnBody({ cfg }) {
  const c = cfg
  const tel = c.SUPPORT_PHONE ?? ''
  return (
    <>
      <P>
        <strong>Last updated:</strong> March 30, 2026.
      </P>

      <LegalSection title="Article 1 (Company identification and contact)">
        <P>
          <strong>{c.BUSINESS_NAME}</strong> (&quot;we&quot;, &quot;us&quot;), based in Japan, provides intermediary
          services for purchasing products in Japan and sells items through its own shop.
        </P>
        <P>
          <strong>Contact:</strong> email {c.SUPPORT_EMAIL}
          {tel ? (
            <>
              {' '}
              · phone <strong>{tel}</strong>
            </>
          ) : null}
        </P>
      </LegalSection>

      <LegalSection title="Article 2 (Acceptance of the Terms)">
        <P>
          These Terms of Use and Services (&quot;Terms&quot;) govern use of the platform and services. By creating an
          account, accepting electronically and/or using any service, you declare that you have read and agree to these
          Terms and the{' '}
          <Link to="/legal/privacy" className="font-medium text-earth-900 underline hover:no-underline">
            Privacy Policy
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection title="Article 3 (Eligibility and user account)">
        <P>To use the services, you must:</P>
        <Ul
          items={[
            'Be at least 18 years old or have valid legal capacity in your jurisdiction;',
            'Provide true, complete and up-to-date information;',
            'Keep your login credentials confidential.',
          ]}
        />
        <P>
          You are responsible for all activity on your account and must notify us immediately of any unauthorized use.
          You may request account closure when there are no outstanding obligations, according to the platform process.
        </P>
      </LegalSection>

      <LegalSection title="Article 4 (Nature of the services)">
        <P>
          Except for the <strong>Shop</strong> service, {c.BUSINESS_NAME} acts as an <strong>intermediary</strong> and is
          not the manufacturer, original seller or final carrier. For the <strong>Shop</strong>, {c.BUSINESS_NAME} sells
          the items listed from its own inventory.
        </P>
      </LegalSection>

      <LegalSection title="Article 5 (Services offered)">
        <Subt>5.1 Purchase redirection</Subt>
        <P>
          You buy directly from the supplier and ship to our address in Japan. We receive the goods, perform limited visual
          inspection and store them. The addressee must follow platform instructions — typically{' '}
          <strong>your name + account code</strong> (e.g. Lucas Silva Jr. - ED0003).
        </P>
        <P>
          You are responsible for verifying specifications (size, color, quantity, etc.) before purchase and shipment, and
          for paying Japanese stores where applicable.
        </P>

        <Subt>5.2 Assisted purchase redirection</Subt>
        <P>
          You send links and specifications; we quote and/or purchase after payment is confirmed. On high-turnover
          marketplaces, prepayment may be required. After purchase, the process continues as standard redirection.
        </P>

        <Subt>5.3 Personal shopping</Subt>
        <P>
          You describe what you want (images, description, price range). Our team researches options; after you approve
          and pay the quote, we purchase. Prices and availability may change due to stock, stores and exchange rates.
        </P>
        <P>By requesting this service, you authorize {c.BUSINESS_NAME} to purchase on your behalf after quote approval.</P>

        <Subt>5.4 Group purchases</Subt>
        <P>
          Participation in themed groups for retail chains. After payment is confirmed, the reservation is generally firm
          and cancellation may not be possible. If an item is unavailable, you will be informed and, where applicable,
          refunded for that item.
        </P>

        <Subt>5.5 Shop</Subt>
        <P>
          Products already in our inventory, ready for shipping processing after payment is confirmed. May include new
          items, collectibles or limited editions. Collectibles may show packaging wear or minor non-essential
          imperfections as described in the listing — not treated as defects if disclosed or typical for the product type.
        </P>
        <P>
          For the Shop, {c.BUSINESS_NAME} undertakes to ship the product as described, state condition when possible,
          pack appropriately for international shipping and dispatch within the stated timeframe after payment, without
          guaranteeing subjective &quot;perfect&quot; condition or compatibility of electronics outside Japan.
        </P>
      </LegalSection>

      <LegalSection title="Article 6 (Receipt inspection)">
        <P>Our inspection is visual and limited, including where possible:</P>
        <Ul
          items={[
            'Apparent match with the order;',
            'Visible damage (breakage, leaks);',
            'Apparent expiry where shown on the label.',
          ]}
        />
        <P>
          Unless you contract a specific extra service, we do not perform in-depth technical testing, expert
          authentication or guarantee of internal function.
        </P>
      </LegalSection>

      <LegalSection title="Article 7 (Receipt, opening packages and storage)">
        <P>
          After receipt in Japan, we inspect and store goods. <strong>Free storage</strong> is{' '}
          <strong>60 calendar days</strong> from receipt and registration on the platform, for{' '}
          <strong>all service types</strong> (redirection, assisted, personal shopping, groups and shop).
        </P>
        <P>
          After that, a fee of <strong>JPY 50 per item per day</strong> applies (or the rate on the public fee schedule)
          until you request shipment and complete payment required for posting.
        </P>
        <P>
          We may open outer packaging for inspection and efficient storage unless you expressly request otherwise in
          advance. We are not responsible for address errors you provided to the supplier.
        </P>
      </LegalSection>

      <LegalSection title="Article 8 (Consolidation and packaging)">
        <P>
          You may request consolidation into one or more boxes. Shipping and charges are based on final weight, volume
          and dimensions per box. Extra protection and reinforced packaging may incur additional cost per shipping options.
        </P>
      </LegalSection>

      <LegalSection title="Article 9 (Prices, fees and payment methods)">
        <P>Depending on the service, the following may apply:</P>
        <Ul
          items={[
            'Fixed fee per item or order;',
            'Percentage fee on purchase value;',
            'Storage after the free period;',
            'Extra services (photos, video, rush handling, reinforced packaging, etc.);',
            'International shipping.',
          ]}
        />
        <P>
          Details are on{' '}
          <Link to="/servicos-e-precos" className="font-medium text-earth-900 underline hover:no-underline">
            Services &amp; Pricing
          </Link>
          . Payments may be processed by third parties (e.g. Stripe); card data is not stored on our servers. Where
          available: <strong>PIX</strong>, <strong>credit card</strong> (installments when offered) and{' '}
          <strong>bank transfer</strong>. Orders are confirmed after payment is validated.
        </P>
      </LegalSection>

      <LegalSection title="Article 10 (Currency, exchange rates and billing)">
        <P>
          Our operational base currency is <strong>Japanese yen (JPY)</strong>. Settlement may occur in{' '}
          <strong>US dollars (USD)</strong> through payment providers. Amounts may be shown in{' '}
          <strong>Brazilian reais (BRL)</strong> on the platform; at charge time, conversions, spread, IOF and third-party
          fees may apply — the debited amount may differ from the displayed amount due to exchange fluctuation. We do not
          control banks&apos; or processors&apos; exchange rates.
        </P>
        <P>By paying, you acknowledge the conversion and settlement rules of the payment method used.</P>
      </LegalSection>

      <LegalSection title="Article 11 (International shipping)">
        <P>
          Shipping is calculated after you request shipment, consolidation (if any) and final weighing. Freight and
          applicable charges must be paid before posting. Indicative information:{' '}
          <Link
            to="/servicos-e-precos/fretes-prazos"
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            Shipping &amp; delivery times
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection title="Article 12 (Shipping and delivery)">
        <P>
          Shipments use partner carriers (e.g. Japan Post) as available. Delivery times depend on method, region, customs
          and local delivery — <strong>exact delivery time is not guaranteed</strong>. After posting, delivery is handled
          by the logistics chain. Goods are sent to the address on your account; keep your details up to date.
        </P>
      </LegalSection>

      <LegalSection title="Article 13 (Customs, taxes and compliance)">
        <P>
          You are responsible for import taxes, customs and postal charges at destination, required documentation and
          compliance with local laws. We do not control holds, delays, returns, seizures or additional charges imposed by
          authorities.
        </P>
        <P>
          Brazil-oriented guidance:{' '}
          <Link to="/faq/taxas-alfandegarias" className="font-medium text-earth-900 underline hover:no-underline">
            Customs charges
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection title="Article 14 (Prohibited and restricted items)">
        <P>Using the services for the following is prohibited:</P>
        <Ul
          items={[
            'Illegal products;',
            'Weapons, explosives and hazardous materials;',
            'Drugs and illicit substances;',
            'Items banned by law or carrier policies;',
            'Goods subject to embargo or export/import restrictions.',
          ]}
        />
        <P>We may refuse orders and take action for legal, operational or compliance risk.</P>
      </LegalSection>

      <LegalSection title="Article 15 (Customer responsibilities)">
        <P>By using the services, you declare that you:</P>
        <Ul
          items={[
            'Have reviewed item specifications;',
            'Understand risks of import and international transport;',
            'Accept variations in price, stock and exchange rates;',
            `Authorize ${c.BUSINESS_NAME} to purchase on your behalf where applicable.`,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 16 (Limitation of liability)">
        <P>To the fullest extent permitted by law, {c.BUSINESS_NAME} is not liable for:</P>
        <Ul
          items={[
            'Damage caused by third parties;',
            'Loss in transit after posting under the carrier\'s custody;',
            'Issues with original manufacturers or sellers;',
            'Accuracy of third-party seller information;',
            'Incorrect information you provide;',
            'Quality and authenticity when we act only as intermediary;',
            'Logistics and customs delays;',
            'Seizure or extra duties by customs.',
          ]}
        />
        <P>
          Where {c.BUSINESS_NAME} is proven liable, total compensation is limited to{' '}
          <strong>service fees paid to {c.BUSINESS_NAME}</strong> for the specific order giving rise to the claim, except
          where applicable law prohibits such limitation (fraud, gross negligence or mandatory consumer rules).
        </P>
      </LegalSection>

      <LegalSection title="Article 17 (Shipping insurance)">
        <P>Where available, you may purchase shipping insurance. Coverage, limits and exclusions follow the carrier or insurer.</P>
      </LegalSection>

      <LegalSection title="Article 18 (Cancellation, returns and refunds)">
        <P>
          We do not guarantee returns or refunds after purchase is confirmed with the supplier; cancellation depends on
          that supplier’s policy. Service fees already performed by {c.BUSINESS_NAME} are generally non-refundable. Return
          shipping and related costs are usually yours unless the law provides otherwise.
        </P>
      </LegalSection>

      <LegalSection title="Article 19 (Chargebacks and anti-fraud)">
        <P>
          We may request additional identity and payment verification. Improper chargebacks or fraud may result in account
          suspension or closure and appropriate action.
        </P>
      </LegalSection>

      <LegalSection title="Article 20 (Abandoned goods)">
        <P>
          Items without a shipment request for more than <strong>180 calendar days</strong> after receipt may be treated
          as abandoned. Notice will be sent to your registered email at least <strong>15 days</strong> in advance.
          Without response or payment by the deadline, items may be disposed of, donated or sold to recover operational
          costs, without additional compensation.
        </P>
      </LegalSection>

      <LegalSection title="Article 21 (Privacy and personal data)">
        <P>
          Data processing is described in the{' '}
          <Link to="/legal/privacy" className="font-medium text-earth-900 underline hover:no-underline">
            Privacy Policy
          </Link>
          , including sharing with payment processors, carriers and partners necessary to perform the services.
        </P>
      </LegalSection>

      <LegalSection title="Article 22 (Suspension and termination)">
        <P>
          We may suspend or close accounts for breach of these Terms, fraud, illegal use, compliance or operational risk, or
          improper chargebacks.
        </P>
      </LegalSection>

      <LegalSection title="Article 23 (Changes to the Terms)">
        <P>
          We may change these Terms at any time. The current version will be published on the site with an update date.
          Continued use after publication constitutes acceptance, except where the law requires additional consent.
        </P>
      </LegalSection>

      <LegalSection title="Article 24 (Governing law, jurisdiction and general provisions)">
        <P>
          These Terms are governed by the laws of <strong>Japan</strong>. The courts of Japan shall have jurisdiction
          over disputes, <strong>without prejudice</strong> to mandatory consumer protection rules of the consumer’s
          country of residence where required.
        </P>
        <P>If any clause is invalid, the remainder remains in force. Failure to enforce a provision is not a waiver.</P>
        <P>
          <strong>Contact:</strong> {c.SUPPORT_EMAIL}
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
