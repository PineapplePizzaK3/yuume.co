import { useCallback, useEffect, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import {
  MARKET_SOURCE_CAPABILITY_FLAGS,
  MARKET_SOURCE_REVIEW_STATUSES,
  MARKET_SOURCE_TYPES,
  adminListMarketSources,
  adminUpdateMarketSource,
} from '../../../../services/marketSourceService'

const FLAG_LABELS = {
  enabled: 'Ativa',
  can_search_automated: 'Busca automática',
  can_display_price: 'Exibir preço',
  can_display_images: 'Exibir imagens',
  can_link: 'Link externo',
  can_purchase_sourcing: 'Compra assistida',
  can_automate_snapshots: 'Snapshots automáticos',
  legacy_search_allowed: 'Legado: busca/scrape',
  legacy_automation_allowed: 'Legado: automação (CI)',
}

const EDITABLE_TEXT_FIELDS = ['terms_url', 'notes', 'attribution_text', 'search_url_template']

function toDraft(row) {
  const draft = {
    source_type: row.source_type,
    review_status: row.review_status,
    max_cache_hours: row.max_cache_hours ?? 0,
    rate_limit_per_min: row.rate_limit_per_min ?? '',
  }
  for (const flag of MARKET_SOURCE_CAPABILITY_FLAGS) draft[flag] = Boolean(row[flag])
  for (const field of EDITABLE_TEXT_FIELDS) draft[field] = row[field] ?? ''
  return draft
}

function buildPatch(row, draft) {
  const base = toDraft(row)
  const patch = {}
  for (const [key, value] of Object.entries(draft)) {
    if (value !== base[key]) patch[key] = value
  }
  if ('max_cache_hours' in patch) patch.max_cache_hours = Math.max(0, Number(patch.max_cache_hours) || 0)
  if ('rate_limit_per_min' in patch) {
    patch.rate_limit_per_min = patch.rate_limit_per_min === '' ? '' : String(Math.max(0, Number(patch.rate_limit_per_min) || 0))
  }
  return patch
}

const REVIEW_BADGE = {
  cleared: 'bg-emerald-100 text-emerald-800',
  in_review: 'bg-amber-100 text-amber-800',
  unreviewed: 'bg-earth-100 text-earth-700',
  rejected: 'bg-red-100 text-red-800',
}

export default function MarketSourcesSection() {
  const { activeTab } = useAdminContext()
  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await adminListMarketSources()
    if (res.error) {
      setError(res.error.message || 'Não foi possível carregar as fontes (migration 151 aplicada?).')
    }
    const list = Array.isArray(res.data) ? res.data : []
    setRows(list)
    setDrafts(Object.fromEntries(list.map((row) => [row.id, toDraft(row)])))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab !== 'market_sources') return
    void load()
  }, [activeTab, load])

  if (activeTab !== 'market_sources') return null

  const updateDraft = (id, key, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  const handleSave = async (row) => {
    const patch = buildPatch(row, drafts[row.id] || toDraft(row))
    if (!Object.keys(patch).length) {
      setMessage(`Nada para salvar em ${row.display_name}.`)
      return
    }
    setSavingId(row.id)
    setError('')
    setMessage('')
    const res = await adminUpdateMarketSource(row.id, patch)
    setSavingId('')
    if (res.error) {
      setError(res.error.message || 'Não foi possível salvar.')
      return
    }
    const updated = res.data || row
    setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    setDrafts((prev) => ({ ...prev, [row.id]: toDraft(updated) }))
    setMessage(`${row.display_name} atualizada. Edge functions aplicam em até 60s.`)
  }

  return (
    <section className="mt-0 space-y-4 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Fontes de mercado</h2>
          <p className="mt-1 max-w-3xl text-sm text-earth-600">
            Permissões por fonte. Recursos do Collector só usam fontes com revisão <strong>cleared</strong> e a
            capacidade marcada. Flags “Legado” mantêm a busca/scrape atual e os jobs de CI até uma decisão do dono
            (ver docs/sources/source-rights-audit.md).
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-earth-600">Nenhuma fonte cadastrada.</p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const draft = drafts[row.id] || toDraft(row)
          const dirty = Object.keys(buildPatch(row, draft)).length > 0
          return (
            <div key={row.id} className="rounded-lg border border-earth-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-earth-900">{row.display_name}</h3>
                <code className="text-xs text-earth-500">{row.id}</code>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${REVIEW_BADGE[row.review_status] || REVIEW_BADGE.unreviewed}`}>
                  {row.review_status}
                </span>
                {!row.enabled ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">desativada</span> : null}
                {row.terms_reviewed_at ? (
                  <span className="text-xs text-earth-500">
                    revisado {new Date(row.terms_reviewed_at).toLocaleDateString('pt-BR')}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <label className="text-xs text-earth-600">
                  Tipo
                  <select
                    value={draft.source_type}
                    onChange={(e) => updateDraft(row.id, 'source_type', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  >
                    {MARKET_SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-earth-600">
                  Revisão
                  <select
                    value={draft.review_status}
                    onChange={(e) => updateDraft(row.id, 'review_status', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  >
                    {MARKET_SOURCE_REVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-earth-600">
                  Cache máx. (horas)
                  <input
                    type="number"
                    min="0"
                    value={draft.max_cache_hours}
                    onChange={(e) => updateDraft(row.id, 'max_cache_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="text-xs text-earth-600">
                  Limite req/min
                  <input
                    type="number"
                    min="0"
                    value={draft.rate_limit_per_min}
                    onChange={(e) => updateDraft(row.id, 'rate_limit_per_min', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {MARKET_SOURCE_CAPABILITY_FLAGS.map((flag) => (
                  <label key={flag} className="flex items-center gap-1.5 text-sm text-earth-800">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[flag])}
                      onChange={(e) => updateDraft(row.id, flag, e.target.checked)}
                    />
                    {FLAG_LABELS[flag] || flag}
                  </label>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-earth-600">
                  URL dos termos
                  <input
                    value={draft.terms_url}
                    onChange={(e) => updateDraft(row.id, 'terms_url', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="text-xs text-earth-600">
                  Template de busca (link-out, usar {'{query}'})
                  <input
                    value={draft.search_url_template}
                    onChange={(e) => updateDraft(row.id, 'search_url_template', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="text-xs text-earth-600">
                  Atribuição exigida
                  <input
                    value={draft.attribution_text}
                    onChange={(e) => updateDraft(row.id, 'attribution_text', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="text-xs text-earth-600">
                  Notas da revisão
                  <textarea
                    rows={2}
                    value={draft.notes}
                    onChange={(e) => updateDraft(row.id, 'notes', e.target.value)}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave(row)}
                  disabled={!dirty || savingId === row.id}
                  className="rounded bg-earth-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
                >
                  {savingId === row.id ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
