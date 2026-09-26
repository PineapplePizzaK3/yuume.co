import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listSetItems } from '../../services/catalogService'
import { bulkMarkCatalogItemsOwned } from '../../services/collectionService'
import { trackSet, updateCollectorPreferences } from '../../services/trackedSetService'

/**
 * Minimal onboarding: franchise → set → bulk-mark owned checklist cards.
 * Used from Explore; Home (Step 6) will reuse it.
 */
export function CollectorOnboarding({ franchises = [], sets = [], userId, onClose, onDone }) {
  const { t, i18n } = useTranslation()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const [step, setStep] = useState(1)
  const [franchise, setFranchise] = useState(franchises[0] || 'pokemon_tcg')
  const [setId, setSetId] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const franchiseSets = useMemo(
    () => sets.filter((s) => !franchise || s.franchise === franchise),
    [sets, franchise]
  )

  const loadChecklist = async (id) => {
    setBusy(true)
    setError('')
    const res = await listSetItems(id, { includeOutOfChecklist: false })
    setBusy(false)
    if (res.error) {
      setError(res.error.message || t('collector.errors.setsLoad', { defaultValue: 'Não foi possível carregar os itens.' }))
      return
    }
    const rows = Array.isArray(res.data) ? res.data : []
    setItems(rows)
    setSelected(new Set())
    setStep(3)
  }

  const toggle = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const finish = async () => {
    if (!setId || !userId) return
    setBusy(true)
    setError('')
    const ids = [...selected]
    const [trackRes, bulkRes, prefRes] = await Promise.all([
      trackSet(setId, true),
      ids.length ? bulkMarkCatalogItemsOwned(ids, true) : Promise.resolve({ error: null }),
      updateCollectorPreferences(userId, {
        followed_franchises: [franchise],
        followed_sets: [setId],
      }),
    ])
    setBusy(false)
    if (trackRes.error || bulkRes.error || prefRes.error) {
      setError(
        trackRes.error?.message ||
          bulkRes.error?.message ||
          prefRes.error?.message ||
          t('collector.errors.onboardingFailed', { defaultValue: 'Não foi possível salvar o onboarding.' })
      )
      return
    }
    onDone?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-earth-900/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-earth-900">
              {t('collector.onboarding.title', { defaultValue: 'Começar sua coleção' })}
            </h2>
            <p className="mt-1 text-sm text-earth-600">
              {t('collector.onboarding.subtitle', {
                defaultValue: 'Escolha um set, marque o que você já tem e acompanhe o que falta.',
              })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-earth-500 hover:text-earth-800">
            {t('collector.onboarding.close', { defaultValue: 'Fechar' })}
          </button>
        </div>

        {error ? <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {step === 1 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-earth-800">{t('collector.onboarding.pickFranchise', { defaultValue: '1. Franquia' })}</p>
            <select
              value={franchise}
              onChange={(e) => setFranchise(e.target.value)}
              className="w-full rounded border border-earth-300 px-3 py-2 text-sm"
            >
              {(franchises.length ? franchises : ['pokemon_tcg']).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
            >
              {t('collector.onboarding.next', { defaultValue: 'Continuar' })}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-earth-800">{t('collector.onboarding.pickSet', { defaultValue: '2. Set' })}</p>
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="w-full rounded border border-earth-300 px-3 py-2 text-sm"
            >
              <option value="">{t('collector.onboarding.chooseSet', { defaultValue: 'Escolha um set' })}</option>
              {franchiseSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.set_code} — {(localeKey === 'en' ? s.name_en || s.name_ja : s.name_ja || s.name_en) || s.set_code}
                  {s.status !== 'VERIFIED' ? ` (${s.status})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="rounded border border-earth-300 px-3 py-2 text-sm">
                {t('collector.onboarding.back', { defaultValue: 'Voltar' })}
              </button>
              <button
                type="button"
                disabled={!setId || busy}
                onClick={() => loadChecklist(setId)}
                className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
              >
                {busy ? t('collector.common.loading', { defaultValue: 'Carregando...' }) : t('collector.onboarding.next', { defaultValue: 'Continuar' })}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-earth-800">
                {t('collector.onboarding.markOwned', {
                  defaultValue: '3. Marque o que você já tem ({{count}})',
                  count: selected.size,
                })}
              </p>
              <button
                type="button"
                onClick={() => setSelected(new Set(items.map((item) => item.id)))}
                className="text-xs text-earth-600 hover:text-earth-900"
              >
                {t('collector.onboarding.selectAll', { defaultValue: 'Marcar todos' })}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded border border-earth-100">
              {items.map((item) => {
                const name = localeKey === 'en' ? item.name_en || item.name_ja : item.name_ja || item.name_en
                return (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 border-b border-earth-50 px-3 py-2 text-sm last:border-0">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                    <span className="w-12 font-mono text-earth-500">{item.number}</span>
                    <span className="flex-1 text-earth-900">{name || '—'}</span>
                    <span className="text-xs text-earth-500">{item.rarity || ''}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="rounded border border-earth-300 px-3 py-2 text-sm">
                {t('collector.onboarding.back', { defaultValue: 'Voltar' })}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={finish}
                className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
              >
                {busy
                  ? t('collector.common.saving', { defaultValue: 'Salvando...' })
                  : t('collector.onboarding.finish', { defaultValue: 'Salvar e acompanhar' })}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CollectorOnboarding
