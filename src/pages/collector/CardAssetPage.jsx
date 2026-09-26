import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { CreditsAmount } from '../../components/CreditsAmount'
import { PageSeo } from '../../components/PageSeo'
import {
  getCollectionAsset,
  isCollectorMockMode,
  requestPsaGradingCollectionAsset,
  sellBackCollectionAsset,
} from '../../services/collectorService'
import { collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function CardAssetPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const isMockMode = isCollectorMockMode()
  const { assetId } = useParams()
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void getCollectionAsset(assetId).then((res) => {
      if (!active) return
      setAsset(res?.data || null)
      if (res?.error) setError(res.error.message || t('collector.errors.assetNotFound', { defaultValue: 'Card asset nao encontrado.' }))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [assetId, t])

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</div>
  }

  if (!asset) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.errors.assetNotFound', { defaultValue: 'Card asset nao encontrado.' })}</div>
  }

  const isHeld = asset.status === 'held'
  const marketValueJpy = Number(asset.marketValueJpy || 0)
  const sellBackOfferJpy = Number(asset.sellBackOfferJpy || 0)
  const canSell = isHeld && sellBackOfferJpy > 0
  const canRequestPsa = isHeld

  const handleSellBack = async () => {
    if (!canSell || !asset?.id) return
    setError('')
    setNotice('')
    const confirmed = window.confirm(
      t('collector.asset.confirmSellBack', {
        defaultValue: 'Confirmar sell-back por {{value}} créditos?',
        value: `¥${Math.floor(sellBackOfferJpy).toLocaleString('ja-JP')}`,
      })
    )
    if (!confirmed) return
    setActionLoading('sell')
    const res = await sellBackCollectionAsset(asset.id)
    setActionLoading('')
    if (res.error) {
      setError(res.error.message || t('collector.asset.errors.sellBackFailed', { defaultValue: 'Nao foi possivel vender o card agora.' }))
      return
    }
    setNotice(
      t('collector.asset.messages.sellBackSuccess', {
        defaultValue: 'Sell-back concluido. {{value}} creditados.',
        value: `¥${Math.floor(Number(res?.data?.creditedJpy || 0)).toLocaleString('ja-JP')}`,
      })
    )
    setAsset(res?.data?.asset || asset)
  }

  const handleRequestPsa = async () => {
    if (!canRequestPsa || !asset?.id) return
    setError('')
    setNotice('')
    const confirmed = window.confirm(
      t('collector.asset.confirmPsa', {
        defaultValue: 'Enviar este card para a fila de grading PSA?',
      })
    )
    if (!confirmed) return
    setActionLoading('grade')
    const res = await requestPsaGradingCollectionAsset(asset.id)
    setActionLoading('')
    if (res.error) {
      setError(res.error.message || t('collector.asset.errors.psaRequestFailed', { defaultValue: 'Nao foi possivel solicitar grading agora.' }))
      return
    }
    setNotice(
      t('collector.asset.messages.psaRequestSuccess', {
        defaultValue: 'Solicitacao de grading PSA enviada.',
      })
    )
    setAsset(res?.data || asset)
  }

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.assetTitle', { defaultValue: 'Card Asset | Collector MVP' })} noindex={isMockMode} />
      <section className="px-4 pb-12 pt-24">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm">
            <img src={asset.card?.image || '/logo.png'} alt={asset.card?.name?.[localeKey] || asset.id} className="h-full w-full object-cover" />
          </div>
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-2xl font-semibold text-earth-900">
              {asset.card?.name?.[localeKey] || asset.card?.id}
            </h1>
            <p className="mt-2 text-sm text-earth-600">
              {asset.card?.set} • {asset.card?.number} • {asset.card?.rarity}
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-earth-200 bg-earth-50 p-4 text-sm text-earth-700">
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.origin', { defaultValue: 'Origem' })}:</span>{' '}
                {t('collector.asset.originBatch', { defaultValue: 'Abertura' })} {asset.origin?.batchId}
              </p>
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.statusLabel', { defaultValue: 'Status' })}:</span>{' '}
                {t(`collector.asset.status.${asset.status}`, { defaultValue: asset.status })}
              </p>
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.condition', { defaultValue: 'Condicao' })}:</span>{' '}
                {(asset.condition || 'nm').toUpperCase()}
              </p>
              {asset.status === 'graded' && (asset.psaGrade || asset.psaCertNumber) ? (
                <p>
                  <span className="font-semibold text-earth-900">{t('collector.asset.psaResult', { defaultValue: 'Resultado PSA' })}:</span>{' '}
                  {asset.psaGrade ? `Grade ${asset.psaGrade}` : t('collector.asset.psaGradePending', { defaultValue: 'Grade pendente' })}
                  {asset.psaCertNumber ? ` • #${asset.psaCertNumber}` : ''}
                </p>
              ) : null}
              {asset.actionNote ? (
                <p>
                  <span className="font-semibold text-earth-900">{t('collector.asset.lastAction', { defaultValue: 'Ultima acao' })}:</span>{' '}
                  {asset.actionNote}
                </p>
              ) : null}
            </div>

            <div className="mt-5 rounded-xl border border-earth-200 bg-white p-4">
              <p className="text-sm font-semibold text-earth-900">
                {t('collector.asset.marketValue', { defaultValue: 'Valor de mercado no pull' })}
              </p>
              {marketValueJpy > 0 ? (
                <CreditsAmount amount={marketValueJpy} variant="compact" showFiat />
              ) : (
                <p className="mt-1 text-xs text-earth-600">
                  {t('collector.asset.marketValueMissing', { defaultValue: 'Sem valor de mercado registrado para este card.' })}
                </p>
              )}
              <p className="mt-3 text-sm font-semibold text-earth-900">
                {t('collector.asset.sellBackOffer', { defaultValue: 'Oferta sell-back (80%)' })}
              </p>
              {sellBackOfferJpy > 0 ? (
                <CreditsAmount amount={sellBackOfferJpy} variant="compact" showFiat />
              ) : (
                <p className="mt-1 text-xs text-earth-600">
                  {t('collector.asset.sellBackUnavailable', { defaultValue: 'Sell-back indisponivel para este card.' })}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-500"
              >
                {t('collector.asset.actions.keep', { defaultValue: 'Manter' })} • {t('collector.asset.soon', { defaultValue: 'em breve' })}
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-500"
              >
                {t('collector.asset.actions.ship', { defaultValue: 'Enviar' })} • {t('collector.asset.soon', { defaultValue: 'em breve' })}
              </button>
              <button
                type="button"
                onClick={handleRequestPsa}
                disabled={!canRequestPsa || Boolean(actionLoading)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  canRequestPsa && !actionLoading
                    ? 'border-earth-300 bg-white text-earth-800 hover:bg-earth-100'
                    : 'border-earth-300 bg-white text-earth-400'
                }`}
              >
                {actionLoading === 'grade'
                  ? t('collector.asset.actions.processing', { defaultValue: 'Processando...' })
                  : t('collector.asset.actions.grade', { defaultValue: 'Graduar' })}
              </button>
              <button
                type="button"
                onClick={handleSellBack}
                disabled={!canSell || Boolean(actionLoading)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  canSell && !actionLoading
                    ? 'border-collector-600 bg-collector-100 text-collector-800 hover:bg-collector-200'
                    : 'border-earth-300 bg-white text-earth-400'
                }`}
              >
                {actionLoading === 'sell'
                  ? t('collector.asset.actions.processing', { defaultValue: 'Processando...' })
                  : t('collector.asset.actions.sell', { defaultValue: 'Vender' })}
              </button>
            </div>
            {error ? <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {notice ? <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700">{notice}</p> : null}

            <Link
              to={collectorCollectionRipPath(asset.origin?.allocationId || '', locale)}
              className="mt-5 inline-flex text-sm font-medium text-earth-700 hover:underline"
            >
              {t('collector.actions.backToBatchRecord', { defaultValue: 'Voltar para o registro da abertura' })}
            </Link>
          </article>
        </div>
      </section>
    </>
  )
}

export default CardAssetPage
