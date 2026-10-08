import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { findInJapanForItem } from '../../services/japanMarketService'
import { getServices, createOrder } from '../../services/orderService'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

/**
 * Contextual Japan market panel for a catalog item (flag-gated by parent).
 */
export function FindInJapanPanel({ item, wishlistItemId = null }) {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const path = useLocalizedPath()
  const navigate = useNavigate()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sourcing, setSourcing] = useState(false)
  const [message, setMessage] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  useEffect(() => {
    let active = true
    if (!item?.id) {
      setPayload(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    void findInJapanForItem(item).then((res) => {
      if (!active) return
      setPayload(res.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [item?.id, item?.name_ja, item?.number])

  const requestSourcing = async () => {
    if (!isAuthenticated || !user?.id || !item?.id || sourcing) return
    setSourcing(true)
    setMessage('')
    const services = await getServices()
    const personal = (services.data || []).find((s) => /personal\s*shopping/i.test(String(s.name || '')))
    if (!personal?.id) {
      setSourcing(false)
      setMessage(t('collector.market.noPersonalShopping', { defaultValue: 'Serviço Personal Shopping indisponível.' }))
      return
    }
    const name = localeKey === 'en' ? item.name_en || item.name_ja : item.name_ja || item.name_en
    const setCode = item.set?.set_code || ''
    const msg = [
      `Find in Japan (catálogo)`,
      name || '—',
      setCode ? `Set: ${setCode}` : null,
      item.number ? `#${item.number}` : null,
      item.rarity ? `Rarity: ${item.rarity}` : null,
      payload?.query?.query ? `Query: ${payload.query.query}` : null,
      `catalog_item_id=${item.id}`,
    ]
      .filter(Boolean)
      .join('\n')

    const { data, error } = await createOrder(user.id, {
      service_id: personal.id,
      service_name: 'Personal Shopping',
      message: msg,
      catalog_item_id: item.id,
      wishlist_item_id: wishlistItemId || null,
    })
    setSourcing(false)
    if (error) {
      setMessage(error.message || t('collector.market.sourcingError', { defaultValue: 'Não foi possível abrir o pedido.' }))
      return
    }
    navigate(path('appLounge', '?tab=pedidos'))
    if (data?.id) setMessage(t('collector.market.sourcingCreated', { defaultValue: 'Pedido de sourcing criado.' }))
  }

  if (loading) {
    return <p className="text-sm text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</p>
  }

  const snap = payload?.snapshot
  const hits = payload?.hits || []
  const linkOuts = payload?.linkOuts || []

  return (
    <div className="mt-6 rounded-xl border border-earth-200 bg-earth-50/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
        {t('collector.market.title', { defaultValue: 'Find in Japan' })}
      </h2>
      <p className="mt-1 text-sm text-earth-600">
        {t('collector.market.subtitle', {
          defaultValue: 'Estoque próprio, links externos e pedido de sourcing. Fontes API aguardam liberação (D1).',
        })}
      </p>
      {payload?.query?.query ? (
        <p className="mt-2 font-mono text-xs text-earth-500">{payload.query.query}</p>
      ) : null}

      {snap ? (
        <p className="mt-3 text-sm text-earth-800">
          {t('collector.market.snapshot', {
            defaultValue: 'Sinal recente: ¥{{price}} · {{count}} anúncios · {{source}}',
            price: snap.best_price_jpy ?? '—',
            count: snap.listing_count ?? 0,
            source: snap.source_id,
          })}
        </p>
      ) : null}

      {payload?.searchError ? <p className="mt-2 text-xs text-amber-700">{payload.searchError}</p> : null}

      {hits.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {hits.slice(0, 8).map((hit, idx) => (
            <li key={hit.id || hit.url || idx} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-earth-800">{hit.title || hit.name || '—'}</span>
              <span className="text-earth-500">
                {hit.price != null ? `¥${hit.price}` : ''}
                {hit.matchQuality ? ` · ${hit.matchQuality}` : ''}
              </span>
              {hit.url ? (
                <a href={hit.url} target="_blank" rel="noreferrer" className="text-earth-700 underline">
                  {t('collector.market.open', { defaultValue: 'Abrir' })}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-earth-600">
          {t('collector.market.noHits', { defaultValue: 'Nenhum resultado no estoque próprio no momento.' })}
        </p>
      )}

      {linkOuts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {linkOuts.map((lo) => (
            <a
              key={lo.sourceId}
              href={lo.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-xs font-medium text-earth-800 hover:bg-earth-50"
            >
              {lo.displayName}
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isAuthenticated ? (
          <button
            type="button"
            disabled={sourcing}
            onClick={requestSourcing}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
          >
            {sourcing
              ? t('collector.common.saving', { defaultValue: 'Salvando...' })
              : t('collector.market.requestSourcing', { defaultValue: 'Pedir sourcing (Personal Shopping)' })}
          </button>
        ) : (
          <Link to={path('login')} className="text-sm text-earth-700 underline">
            {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
          </Link>
        )}
        {message ? <span className="text-sm text-earth-600">{message}</span> : null}
      </div>
    </div>
  )
}
