/**
 * Terms of Service — JA / PT-BR / EN via dedicated body components.
 */
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { useLegalLanguage } from '../../contexts/LegalLanguageContext'
import { LEGAL_CONFIG } from '../../data/legalConfig'
import { TermsOfUseJaBody } from '../../legal/TermsOfUseJaBody'
import { TermsOfUseEnBody } from '../../legal/TermsOfUseEnBody'
import { TermsOfUsePtBrBody } from '../../legal/TermsOfUsePtBrBody'

const CONTENT = {
  ja: {
    title: '利用規約',
    subtitle: "Eiko's Delivery Service · 最終更新 2026年3月30日",
    content: (c) => <TermsOfUseJaBody cfg={c} />,
  },
  'pt-BR': {
    title: 'Termos de Uso e Serviços',
    subtitle: "Eiko's Delivery Service · Última atualização: 30 de março de 2026",
    content: (c) => <TermsOfUsePtBrBody cfg={c} />,
  },
  en: {
    title: 'Terms of Use and Services',
    subtitle: "Eiko's Delivery Service · Last updated March 30, 2026",
    content: (c) => <TermsOfUseEnBody cfg={c} />,
  },
}

export default function TermsOfService() {
  const { t } = useTranslation()
  const { lang } = useLegalLanguage()
  const { BUSINESS_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } = LEGAL_CONFIG
  const cfg = { BUSINESS_NAME, SUPPORT_EMAIL, SUPPORT_PHONE }
  const content = CONTENT[lang] ?? CONTENT.en

  return (
    <>
      <PageSeo routeKey="legalTerms" title={null} description={t('meta.legalTerms.description')} />
      <Helmet>
        <title>{content.title} | Legal | Delivery</title>
      </Helmet>

      <h2 className="text-2xl font-bold tracking-tight text-earth-900 sm:text-3xl">
        {content.title}
      </h2>
      {content.subtitle && (
        <p className="mt-1 text-earth-600">{content.subtitle}</p>
      )}

      <div className="mt-8 space-y-8">{content.content(cfg)}</div>
    </>
  )
}
