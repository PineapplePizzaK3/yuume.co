import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { MinhaYuumeTabs } from '../../components/platform/MinhaYuumeTabs'
import { MyBoxBreaksPanel } from '../../components/platform/MyBoxBreaksPanel'

export default function MyBoxBreaks() {
  const { t } = useTranslation()
  return (
    <>
      <PageSeo
        routeKey="minhaYuumeBoxBreak"
        title={t('platform.boxBreak.metaTitle', { defaultValue: 'Box Break | Minha YuumeCo' })}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.dashboard.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">
          {t('platform.boxBreak.pageIntro', {
            defaultValue: 'Acompanhe suas participações de Box Break nesta conta.',
          })}
        </p>
        <MinhaYuumeTabs active="box-break" />
        <section className="mt-6">
          <MyBoxBreaksPanel />
        </section>
      </div>
    </>
  )
}
