import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { CreditsInline } from '../../components/CreditsAmount'
import { HomeIconBadge, IconCards, IconCheckList, IconJapan, IconPlay } from '../../components/home/HomeSectionIcons'
import { getMyRipRecord, getOpeningBatch, isCollectorMockMode } from '../../services/collectorService'
import { collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

function resolveBoxProgress(batch, fallback = {}) {
  const total = Math.max(0, Number(batch?.totalPacks ?? batch?.packsPlanned ?? fallback.totalPacks ?? 0))
  const soldRaw = Math.max(0, Number(batch?.reservedPositions ?? batch?.packsOpened ?? fallback.reservedPositions ?? 0))
  const sold = total > 0 ? Math.min(total, soldRaw) : soldRaw
  const remaining = Math.max(
    0,
    Number(batch?.availablePositions ?? fallback.availablePositions ?? (total > 0 ? total - sold : 0))
  )
  const remainingPct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
  return {
    total,
    sold,
    remaining,
    remainingPct,
    soldOut: total > 0 && remaining === 0,
  }
}

function BoxBreakPurchaseThanks() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const { ripId = '' } = useParams()
  const [record, setRecord] = useState(null)
  const [batch, setBatch] = useState(null)
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
  const state = location.state || {}

  useEffect(() => {
    if (!ripId) return undefined
    let active = true
    void getMyRipRecord(ripId).then((res) => {
      if (!active) return
      setRecord(res?.data || null)
    })
    return () => {
      active = false
    }
  }, [ripId])

  useEffect(() => {
    const batchId = String(state.batchId || record?.batch?.id || '').trim()
    if (!batchId) return undefined
    let active = true
    void getOpeningBatch(batchId).then((res) => {
      if (!active) return
      setBatch(res?.data || null)
    })
    return () => {
      active = false
    }
  }, [record?.batch?.id, state.batchId])

  const productName =
    state.productName
    || record?.product?.name?.[localeKey]
    || batch?.product?.name?.[localeKey]
    || record?.product?.id
    || batch?.product?.id
    || ''
  const quantity = Math.max(1, Math.floor(Number(state.quantity || record?.quantity || record?.allocation?.quantity || 1)))
  const charged = Math.max(0, Number(state.chargedJpy || 0))
  const recordHref = ripId ? collectorCollectionRipPath(ripId, locale) : path('collectorCollection')
  const progress = useMemo(
    () => resolveBoxProgress(batch || record?.batch, state),
    [
      batch,
      record?.batch,
      state.availablePositions,
      state.reservedPositions,
      state.totalPacks,
    ]
  )

  const steps = [
    {
      n: '1',
      Icon: IconCheckList,
      title: t('collector.purchaseThanks.step1Title', { defaultValue: 'Compra confirmada' }),
      body: t('collector.purchaseThanks.step1Body', {
        defaultValue: 'Seus packs já estão reservados na sua conta. Os créditos foram debitados agora.',
      }),
    },
    {
      n: '2',
      Icon: IconJapan,
      title: t('collector.purchaseThanks.step2Title', { defaultValue: 'Separação no Japão' }),
      body: t('collector.purchaseThanks.step2Body', {
        defaultValue: 'A YuumeCo separa a caixa física correspondente à sua participação.',
      }),
    },
    {
      n: '3',
      Icon: IconPlay,
      title: t('collector.purchaseThanks.step3Title', { defaultValue: 'Abertura dos packs' }),
      body: t('collector.purchaseThanks.step3Body', {
        defaultValue: 'Quando a caixa estiver completa, os packs são abertos e o Box Break é gravado para os participantes.',
      }),
    },
    {
      n: '4',
      Icon: IconCards,
      title: t('collector.purchaseThanks.step4Title', { defaultValue: 'Resultado na coleção' }),
      body: t('collector.purchaseThanks.step4Body', {
        defaultValue: 'Você recebe a gravação e as cartas entram na sua coleção. Depois disso, pode acompanhar ou vender de volta.',
      }),
    },
  ]

  return (
    <>
      <PageSeo
        routeKey="collectorBatches"
        title={t('collector.purchaseThanks.metaTitle', { defaultValue: 'Obrigado | Box Break' })}
        noindex
      />
      <section className="px-4 pb-16 pt-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-earth-200 bg-white p-6 shadow-sm sm:p-8">
          {isMockMode ? (
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-earth-500">Demo</p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold text-earth-900">
            {t('collector.purchaseThanks.title', { defaultValue: 'Obrigado pela compra' })}
          </h1>
          <p className="mt-3 text-earth-600">
            {t('collector.purchaseThanks.lead', {
              defaultValue: 'Sua participação está confirmada. A abertura acontece quando todos os packs desta caixa forem vendidos, para que o resultado seja compartilhado entre os participantes.',
            })}
          </p>

          <div className="mt-5 rounded-xl border border-earth-200 bg-earth-50 p-4 text-sm text-earth-700">
            {productName ? (
              <p className="font-medium text-earth-900">{productName}</p>
            ) : null}
            <p className="mt-2">
              {t('collector.purchaseThanks.quantityLine', {
                defaultValue: '{{count}} pack(s)',
                count: quantity,
              })}
            </p>
            {charged > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <span>{t('collector.purchaseThanks.chargedLine', { defaultValue: 'Debitado' })}:</span>
                <CreditsInline amount={charged} className="font-semibold text-earth-900" />
              </p>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-earth-200 bg-earth-50 p-4">
            <h2 className="font-display text-lg font-semibold text-earth-900">
              {t('collector.purchaseThanks.fairTitle', { defaultValue: 'Como funciona a abertura' })}
            </h2>
            <p className="mt-2 text-sm text-earth-700">
              {t('collector.purchaseThanks.fairBody', {
                defaultValue: 'A caixa é aberta depois que todos os packs forem vendidos. Isso permite que o resultado seja o mesmo para quem participou desta caixa.',
              })}
            </p>
          </div>

          {progress.total > 0 ? (
            <div className="mt-5 rounded-xl border border-earth-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-earth-700">
                <h2 className="font-medium text-earth-800">
                  {t('collector.purchaseThanks.progressTitle', { defaultValue: 'Participações disponíveis' })}
                </h2>
                <p className="tabular-nums font-semibold text-earth-900">
                  {t('collector.purchaseThanks.progressCount', {
                    defaultValue: '{{remaining}}/{{total}}',
                    remaining: progress.remaining,
                    total: progress.total,
                  })}
                </p>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-earth-200"
                role="progressbar"
                aria-valuenow={progress.remainingPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('collector.purchaseThanks.progressTitle', { defaultValue: 'Participações disponíveis' })}
              >
                <div
                  className="h-full rounded-full bg-collector-600 transition-[width] duration-300"
                  style={{ width: `${progress.remainingPct}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-earth-600">
                {progress.soldOut
                  ? t('collector.purchaseThanks.progressSoldOut', {
                      defaultValue: 'Esta caixa já está completa. Em seguida, a abertura é feita para os participantes.',
                    })
                  : progress.remaining === 1
                    ? t('collector.purchaseThanks.progressLeftOne', {
                        defaultValue: 'Ainda resta 1 pack nesta caixa',
                      })
                    : t('collector.purchaseThanks.progressLeft', {
                        defaultValue: 'Ainda restam {{remaining}} packs nesta caixa',
                        remaining: progress.remaining,
                      })}
              </p>
            </div>
          ) : null}

          <h2 className="mt-8 font-display text-xl font-semibold text-earth-900">
            {t('collector.purchaseThanks.nextTitle', { defaultValue: 'O que acontece a seguir' })}
          </h2>
          <p className="mt-2 text-sm text-earth-600">
            {t('collector.purchaseThanks.nextLead', {
              defaultValue: 'A compra reserva os seus packs. A abertura da caixa acontece depois que ela estiver completa.',
            })}
          </p>
          <ol className="mt-5 space-y-4">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-3">
                <HomeIconBadge className="mt-0.5 shrink-0">
                  <step.Icon />
                </HomeIconBadge>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                    {t('collector.purchaseThanks.stepLabel', { defaultValue: 'Passo {{n}}', n: step.n })}
                  </p>
                  <h3 className="font-semibold text-earth-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-earth-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm text-earth-600">
            {t('collector.purchaseThanks.followHint', {
              defaultValue: 'O andamento fica em Meus Box Breaks. As cartas entram na coleção depois da abertura.',
            })}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={recordHref}
              className="rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 hover:bg-earth-800"
            >
              {t('collector.purchaseThanks.ctaRecord', { defaultValue: 'Acompanhar minha participação' })}
            </Link>
            <Link
              to={path('minhaYuumeBoxBreak')}
              className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {t('collector.purchaseThanks.ctaAccount', { defaultValue: 'Meus Box Breaks' })}
            </Link>
            <Link
              to={path('collectorBatches')}
              className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {t('collector.purchaseThanks.ctaMore', { defaultValue: 'Ver outras caixas' })}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

export default BoxBreakPurchaseThanks
