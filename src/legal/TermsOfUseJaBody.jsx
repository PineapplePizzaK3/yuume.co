/**
 * 利用規約・サービス条項（日本語・法務ページ）
 * 最終更新：2026年3月30日
 */
import { LocalizedLink } from '../components/LocalizedLink'

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
export function TermsOfUseJaBody({ cfg }) {
  const c = cfg
  const tel = c.SUPPORT_PHONE ?? ''
  return (
    <>
      <P>
        <strong>最終更新日：</strong>2026年3月30日
      </P>

      <LegalSection title="第1条（事業者の表示・連絡先）">
        <P>
          <strong>{c.BUSINESS_NAME}</strong>（以下「当サービス」）は、日本に拠点を置き、日本国内商品の購入仲介および自社在庫による販売を行います。
        </P>
        <P>
          <strong>連絡先：</strong>メール {c.SUPPORT_EMAIL}
          {tel ? (
            <>
              {' '}
              · 電話 <strong>{tel}</strong>
            </>
          ) : null}
        </P>
      </LegalSection>

      <LegalSection title="第2条（規約への同意）">
        <P>
          本利用規約およびサービス条項（以下「本規約」）は、プラットフォームおよび各サービスの利用条件を定めます。アカウント登録、電子的同意、またはサービスの利用により、ユーザーは本規約および
          <LocalizedLink toRoute="legalPrivacy" className="font-medium text-earth-900 underline hover:no-underline">
            プライバシーポリシー
          </LocalizedLink>
          に同意したものとみなされます。
        </P>
      </LegalSection>

      <LegalSection title="第3条（利用資格・アカウント）">
        <P>サービス利用にあたり、ユーザーは次を満たすものとします。</P>
        <Ul
          items={[
            '満18歳以上であること、または法域において有効な行為能力を有すること；',
            '真実かつ正確な情報を提供し、これを最新に保つこと；',
            'ログイン情報を自己責任で管理すること。',
          ]}
        />
        <P>
          アカウント上の一切の活動についてユーザーが責任を負い、不正利用があった場合は直ちに当サービスへ通知します。未処理の債務がない場合、所定の手続によりアカウント削除を請求できます。
        </P>
      </LegalSection>

      <LegalSection title="第4条（サービスの性質）">
        <P>
          <strong>ショップ販売</strong>を除き、当サービスは<strong>仲介者</strong>として行為し、製造元・元売主・最終運送事業者ではありません。
          <strong>ショップ</strong>においては、当サービスが自社在庫の商品を売主となり販売します。
        </P>
      </LegalSection>

      <LegalSection title="第5条（提供サービス）">
        <Subt>5.1 購入品転送（リダイレクション）</Subt>
        <P>
          ユーザーが販売者から直接購入し、日本国内の当サービス指定住所へ発送します。当サービスは受領後、外観に基づく限定的な確認および保管を行います。荷受人の表記はプラットフォームの指示に従い、通常は
          <strong>氏名＋アカウントコード</strong>（例：Lucas Silva Jr. - ED0003）とします。
        </P>
        <P>仕様（サイズ・色・数量等）の確認および日本国内店舗への支払は、該当する場合ユーザーの責任です。</P>

        <Subt>5.2 補助付き転送（アシステッド）</Subt>
        <P>
          ユーザーがリンクおよび仕様を送信し、当サービスが見積もり・決済確認後に代行購入します。流通の速いマーケットプレイスでは前払いを求める場合があります。購入後の流れは通常の転送と同様です。
        </P>

        <Subt>5.3 パーソナルショッピング</Subt>
        <P>
          希望内容（画像・説明・価格帯等）を送信し、当サービスが候補を提示します。見積もりの承認および支払後に購入します。在庫・店舗・為替により価格・入手可能性は変動し得ます。
        </P>
        <P>依頼により、見積承認後にユーザーに代わり購入することをユーザーが承認します。</P>

        <Subt>5.4 共同購入（グループ）</Subt>
        <P>
          特定小売チェーン等のテーマ別グループに参加します。支払確認後、原則として予約は確定しキャンセルできない場合があります。品切れの際は通知し、該当品の返金等を行う場合があります。
        </P>

        <Subt>5.5 ショップ</Subt>
        <P>
          既に当サービスが保有する在庫商品です。支払確認後、発送手配の対象となります。新品・コレクターズ等を含み、コレクターズ品は出品内容どおり梱包材の擦れや軽微な状態変化があり得ます。
        </P>
        <P>
          ショップでは、出品内容どおりの商品を送付し、可能な範囲で状態を表示し、国際発送にふさわしい梱包を行い、支払後に案内する目安内で発送します。主観的な完璧さや日本国外における電子機器の互換性は保証しません。
        </P>
      </LegalSection>

      <LegalSection title="第6条（受領時の確認）">
        <P>当サービスの確認は外観に限られたものであり、可能な範囲で次を含みます。</P>
        <Ul
          items={[
            '注文内容との表面的な一致；',
            '破損・漏れ等の外観上の損傷；',
            '表示がある場合の賞味期限・期限表示の確認。',
          ]}
        />
        <P>別途有償サービスを契約しない限り、詳細な機能試験・真贋鑑定等は行いません。</P>
      </LegalSection>

      <LegalSection title="第7条（開梱・保管）">
        <P>
          日本国内で受領後、確認および保管を行います。<strong>無料保管期間</strong>は、受領日およびプラットフォーム登録日から
          <strong>60日間</strong>です。全サービス形態（転送・補助付き・パーソナル・グループ・ショップ）に適用されます。
        </P>
        <P>
          上記期間経過後は、発送依頼および発送に必要な支払完了まで、1商品あたり1日あたり<strong>50円</strong>（またはサイト掲示の料金表）の保管料が発生します。
        </P>
        <P>
          事前に異なる申し出がない限り、確認・保管効率化のため外装箱を開封することがあります。ユーザーが販売者に誤って伝えた住所について当サービスは責任を負いません。
        </P>
      </LegalSection>

      <LegalSection title="第8条（梱包合算・梱包）">
        <P>
          複数荷物を1つまたは複数の箱に合算するよう依頼できます。国際送料等は箱ごとの最終重量・寸法・容積に基づきます。追加保護・補強梱包はオプションにより追加費用となる場合があります。
        </P>
      </LegalSection>

      <LegalSection title="第9条（料金・決済手段）">
        <P>サービスにより、次の費用が発生し得ます。</P>
        <Ul
          items={[
            '商品代金；',
            '固定または割合のサービス手数料；',
            '無料期間超過後の保管料；',
            '写真・動画・優先対応・補強梱包等のオプション；',
            '国際送料。',
          ]}
        />
        <P>
          詳細は
          <LocalizedLink toRoute="servicosPrecos" className="font-medium text-earth-900 underline hover:no-underline">
            サービス・料金
          </LocalizedLink>
          をご確認ください。決済は第三者（例：Stripe）を利用する場合があります。カード番号は当サービスのサーバーに保存しません。利用可能な場合、
          <strong>PIX</strong>、<strong>クレジットカード</strong>（分割払いが提供される場合）、
          <strong>銀行振込</strong>等があります。決済の有効化後に注文が確定します。
        </P>
      </LegalSection>

      <LegalSection title="第10条（通貨・為替・請求）">
        <P>
          運用上の基準通貨は<strong>日本円（JPY）</strong>です。決済プロバイダーにより<strong>米ドル（USD）</strong>で精算される場合があります。画面上は
          <strong>ブラジルレアル（BRL）</strong>等で表示されることがありますが、実際の請求時に為替・スプレッド・手数料等により表示額と異なる場合があります。当サービスは金融機関の為替レートを管理しません。
        </P>
        <P>支払により、利用した決済手段の換算・精算条件に同意したものとみなされます。</P>
      </LegalSection>

      <LegalSection title="第11条（国際送料）">
        <P>
          発送依頼・合算（ある場合）・最終計量後に国際送料が算定されます。発送前に送料および関連費用の支払が必要です。目安は
          <LocalizedLink
            toRoute="servicosFretes"
            className="font-medium text-earth-900 underline hover:no-underline"
          >
            送料・所要日数
          </LocalizedLink>
          をご参照ください。
        </P>
      </LegalSection>

      <LegalSection title="第12条（配送・引渡し）">
        <P>
          日本郵便等の提携運送事業者を利用します。所要日数は便種・地域・通関・現地配送に依存し、<strong>確約はできません</strong>
          。投函後の配送は物流チェーンの責任となります。登録住所へ発送するため、情報を最新に保ってください。
        </P>
      </LegalSection>

      <LegalSection title="第13条（税関・税金・コンプライアンス）">
        <P>
          輸入税・関税・現地郵便料金、当局が求める書類、現地法令の遵守はユーザーの責任です。当サービスは差止・遅延・返送・没収・追加課税等を管理できません。
        </P>
        <P>
          ブラジル向けの参考：
          <LocalizedLink toRoute="faqCustoms" className="font-medium text-earth-900 underline hover:no-underline">
            関税・税金の案内
          </LocalizedLink>
          。
        </P>
      </LegalSection>

      <LegalSection title="第14条（禁止・制限品目）">
        <P>次の取扱いは禁止します。</P>
        <Ul
          items={[
            '違法な商品；',
            '武器・爆発物・危険物；',
            '違法薬物等；',
            '法令または運送事業者規則で禁止される物品；',
            '禁輸・制裁対象等の物品。',
          ]}
        />
        <P>法令・オペレーション・コンプライアンス上の理由により、注文を拒否または対応することがあります。</P>
      </LegalSection>

      <LegalSection title="第15条（ユーザーの責任）">
        <P>ユーザーは次を表明します。</P>
        <Ul
          items={[
            '商品仕様を確認したこと；',
            '輸入および国際輸送のリスクを理解していること；',
            '価格・在庫・為替の変動を承認すること；',
            '該当する場合、当サービスによる購入代行を承認すること。',
          ]}
        />
      </LegalSection>

      <LegalSection title="第16条（責任の制限）">
        <P>法令が許す限り、当サービスは次について責任を負いません。</P>
        <Ul
          items={[
            '第三者による損害；',
            '投函後、運送事業者保管下で生じた損失；',
            '製造元・元売主との問題；',
            '第三者出品者情報の正確性；',
            'ユーザー提供情報の誤り；',
            '仲介のみの場合の品質・真贋；',
            '物流・税関の遅延；',
            '税関による没収・追加課税。',
          ]}
        />
        <P>
          当サービスに責任が認められる場合、賠償額は当該紛争に関係する注文についてユーザーが支払った
          <strong>当サービスへのサービス手数料の合計</strong>を上限とします。ただし、法令上無効とされる場合（故意・重過失、強行法規等）はこの限りではありません。
        </P>
      </LegalSection>

      <LegalSection title="第17条（輸送保険）">
        <P>提供がある場合、輸送保険に加入できます。補償内容は運送事業者または保険者の条件に従います。</P>
      </LegalSection>

      <LegalSection title="第18条（キャンセル・返品・返金）">
        <P>
          販売者との購入確定後の返品・返金は保証しません。キャンセルは販売者の方針に従います。当サービスが実行済みのサービス手数料は原則返金不可です。返送費用等は原則ユーザー負担とします（法令に別段の定めがある場合を除く）。
        </P>
      </LegalSection>

      <LegalSection title="第19条（チャージバック・不正防止）">
        <P>
          本人確認・決済確認の追加を求めることがあります。不当なチャージバックや不正行為は、アカウント停止・削除および法的措置の対象となり得ます。
        </P>
      </LegalSection>

      <LegalSection title="第20条（遺棄された荷物）">
        <P>
          受領から<strong>180日</strong>を超えて発送依頼がない荷物は遺棄とみなす場合があります。登録メールに少なくとも
          <strong>15日前</strong>に通知します。期日内に対応がない場合、廃棄・寄付・売却等によりコストを回収することがあり、これに伴う追加補償は行いません。
        </P>
      </LegalSection>

      <LegalSection title="第21条（プライバシー）">
        <P>
          個人データの取扱いは
          <LocalizedLink toRoute="legalPrivacy" className="font-medium text-earth-900 underline hover:no-underline">
            プライバシーポリシー
          </LocalizedLink>
          に従います。決済事業者・運送事業者・業務委託先との共有が含まれます。
        </P>
      </LegalSection>

      <LegalSection title="第22条（利用停止・登録抹消）">
        <P>
          本規約違反、不正、違法利用、コンプライアンス・オペレーション上のリスク、不当なチャージバック等により、アカウントを停止または削除することがあります。
        </P>
      </LegalSection>

      <LegalSection title="第23条（規約の変更）">
        <P>
          本規約は随時変更できます。変更後の内容と更新日をサイトに掲示します。掲示後の継続利用は変更後規約への同意とみなします（法令上別途同意が必要な場合を除く）。
        </P>
      </LegalSection>

      <LegalSection title="第24条（準拠法・管轄・一般条項）">
        <P>
          本規約は<strong>日本法</strong>に準拠します。紛争については<strong>日本の裁判所</strong>を管轄とします。ただし、消費者の常居所地の強行法上の保護規定が適用される場合はこれに従います。
        </P>
        <P>一部が無効でも他の条項は有効に存続します。権利不行使は放棄を意味しません。</P>
        <P>
          <strong>連絡先：</strong>
          {c.SUPPORT_EMAIL}
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
