import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import {
  adminImportCatalogItems,
  adminRecordCatalogValidation,
  adminSaveCatalogReview,
  adminSetCatalogStatus,
  adminUpsertCatalogManifest,
  listSetItems,
  listSets,
} from '../../../../services/catalogService'
import { parseChecklistCsv, validateChecklist } from '../../../../lib/catalog/validateChecklist'

const TAB_ID = 'catalog_sets'

const SET_KINDS = ['main', 'subset', 'high_class', 'special', 'promo', 'other']

const STATUS_BADGE = {
  PENDING: 'bg-earth-100 text-earth-700',
  IMPORTED: 'bg-sky-100 text-sky-800',
  VALIDATING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
}

const EMPTY_FORM = {
  id: '',
  set_code: '',
  name_ja: '',
  name_en: '',
  release_date: '',
  set_kind: 'main',
  official_reference_url: '',
  expected_total: '',
  expected_official: '',
  rarity_counts: '',
  scope_mode: 'all_numbers',
}

function formFromSet(set) {
  if (!set) return EMPTY_FORM
  const manifest = set.official_manifest || {}
  return {
    id: set.id,
    set_code: set.set_code || '',
    name_ja: set.name_ja || '',
    name_en: set.name_en || '',
    release_date: set.release_date || '',
    set_kind: set.set_kind || 'main',
    official_reference_url: set.official_reference_url || '',
    expected_total: manifest.expected_total ?? '',
    expected_official: manifest.expected_official ?? '',
    rarity_counts: manifest.rarity_counts ? JSON.stringify(manifest.rarity_counts) : '',
    scope_mode: set.checklist_scope?.mode === 'official_only' ? 'official_only' : 'all_numbers',
  }
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] || STATUS_BADGE.PENDING}`}>
      {status}
    </span>
  )
}

export default function CatalogSetsSection() {
  const { activeTab } = useAdminContext()
  const [sets, setSets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [csvText, setCsvText] = useState('')
  const [csvPrune, setCsvPrune] = useState(false)
  const [review, setReview] = useState({ checked: {}, manifest_confirmed: false, notes: '' })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedSet = useMemo(() => sets.find((s) => s.id === selectedId) || null, [sets, selectedId])
  const report = selectedSet?.validation_report || null
  const spotCheckIds = useMemo(() => report?.spot_check?.item_ids || [], [report])
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const loadSets = useCallback(async (keepId) => {
    setLoading(true)
    const res = await listSets()
    setLoading(false)
    if (res.error) {
      setError(res.error.message || 'Não foi possível carregar os sets (migration 152 aplicada?).')
      return
    }
    setSets(res.data)
    const nextId = keepId && res.data.some((s) => s.id === keepId) ? keepId : res.data[0]?.id || ''
    setSelectedId(nextId)
  }, [])

  useEffect(() => {
    if (activeTab !== TAB_ID) return
    void loadSets()
  }, [activeTab, loadSets])

  useEffect(() => {
    if (activeTab !== TAB_ID) return
    setForm(formFromSet(selectedSet))
    const saved = selectedSet?.validation_report?.human_review
    setReview({
      checked: saved?.checked || {},
      manifest_confirmed: Boolean(saved?.manifest_confirmed),
      notes: saved?.notes || '',
    })
  }, [activeTab, selectedSet])

  useEffect(() => {
    if (activeTab !== TAB_ID || !selectedId) {
      setItems([])
      return
    }
    let active = true
    void listSetItems(selectedId).then((res) => {
      if (!active) return
      if (res.error) setError(res.error.message || 'Não foi possível carregar os itens.')
      setItems(res.data || [])
    })
    return () => {
      active = false
    }
  }, [activeTab, selectedId, selectedSet?.imported_at])

  if (activeTab !== TAB_ID) return null

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    setMessage('')
    try {
      await fn()
    } finally {
      setBusy('')
    }
  }

  const handleSaveSet = (event) => {
    event.preventDefault()
    void run('save', async () => {
      let rarityCounts
      if (form.rarity_counts.trim()) {
        try {
          rarityCounts = JSON.parse(form.rarity_counts)
        } catch {
          setError('rarity_counts precisa ser JSON, ex.: {"C": 66, "U": 62}')
          return
        }
      }
      const previous = selectedSet && form.id ? selectedSet.official_manifest || {} : {}
      const manifest = {
        ...previous,
        expected_total: form.expected_total === '' ? null : Number(form.expected_total),
        expected_official: form.expected_official === '' ? null : Number(form.expected_official),
        entered_by: 'admin',
      }
      if (rarityCounts) manifest.rarity_counts = rarityCounts
      else delete manifest.rarity_counts
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        set_code: form.set_code.trim(),
        name_ja: form.name_ja,
        name_en: form.name_en,
        release_date: form.release_date || '',
        set_kind: form.set_kind,
        official_reference_url: form.official_reference_url,
        official_manifest: manifest,
        checklist_scope: { mode: form.scope_mode, exclude_variants: true },
      }
      const res = await adminUpsertCatalogManifest(payload)
      if (res.error) {
        setError(res.error.message || 'Não foi possível salvar o set.')
        return
      }
      setMessage('Set salvo. Mudanças no manifesto invalidam validações anteriores.')
      await loadSets(res.data?.id)
    })
  }

  const csvPreview = csvText.trim() ? parseChecklistCsv(csvText) : null

  const handleImportCsv = () => {
    if (!selectedSet || !csvPreview?.items.length) return
    void run('csv', async () => {
      const res = await adminImportCatalogItems(selectedSet.id, csvPreview.items, { prune: csvPrune })
      if (res.error) {
        setError(res.error.message || 'Falha na importação.')
        return
      }
      setMessage(`Importação: ${res.data?.inserted ?? 0} novos, ${res.data?.updated ?? 0} atualizados, ${res.data?.pruned ?? 0} removidos do checklist.`)
      setCsvText('')
      await loadSets(selectedSet.id)
    })
  }

  const handleValidate = () => {
    if (!selectedSet) return
    void run('validate', async () => {
      const next = validateChecklist({
        set: selectedSet,
        manifest: selectedSet.official_manifest || {},
        scope: selectedSet.checklist_scope || {},
        items,
      })
      const res = await adminRecordCatalogValidation(selectedSet.id, next)
      if (res.error) {
        setError(res.error.message || 'Não foi possível gravar a validação.')
        return
      }
      setMessage(next.passed ? 'Validação automática passou. Faça a conferência manual.' : 'Validação encontrou erros.')
      await loadSets(selectedSet.id)
    })
  }

  const handleSaveReview = () => {
    if (!selectedSet) return
    void run('review', async () => {
      const res = await adminSaveCatalogReview(selectedSet.id, review)
      if (res.error) {
        setError(res.error.message || 'Não foi possível salvar a conferência.')
        return
      }
      setMessage('Conferência salva.')
      await loadSets(selectedSet.id)
    })
  }

  const handleStatus = (status) => {
    if (!selectedSet) return
    const note = status === 'VALIDATING' ? window.prompt('Motivo do rebaixamento (opcional):') : null
    void run('status', async () => {
      const res = await adminSetCatalogStatus(selectedSet.id, status, note)
      if (res.error) {
        setError(res.error.message || 'Não foi possível alterar o status.')
        return
      }
      setMessage(`Status: ${res.data?.status}.`)
      await loadSets(selectedSet.id)
    })
  }

  const checkedCount = spotCheckIds.filter((id) => review.checked[id]).length
  const inChecklist = items.filter((item) => item.in_checklist !== false).length

  return (
    <section className="mt-0 space-y-4 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Sets do catálogo</h2>
          <p className="mt-1 max-w-3xl text-sm text-earth-600">
            PENDING → IMPORTED → VALIDATING → VERIFIED. Só sets VERIFIED alimentam completude. Importação TCGdex via
            <code className="mx-1">npm run catalog:sets:import</code>; entrada manual via CSV abaixo. Sem imagens.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedId('')
              setForm(EMPTY_FORM)
            }}
            className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Novo set
          </button>
          <button
            type="button"
            onClick={() => loadSets(selectedId)}
            disabled={loading}
            className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {sets.length === 0 && !loading ? <p className="text-sm text-earth-600">Nenhum set cadastrado.</p> : null}
          {sets.map((set) => (
            <button
              key={set.id}
              type="button"
              onClick={() => setSelectedId(set.id)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedId === set.id ? 'border-earth-900 bg-earth-100' : 'border-earth-200 bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-earth-900">{set.set_code}</span>
                <StatusBadge status={set.status} />
              </div>
              <p className="truncate text-xs text-earth-600">{set.name_ja || set.name_en || '—'}</p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <form onSubmit={handleSaveSet} className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="font-medium text-earth-900">{form.id ? `Set ${form.set_code}` : 'Novo set'}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                ['set_code', 'Código (ex.: SV2a)'],
                ['name_ja', 'Nome (JA)'],
                ['name_en', 'Nome (EN)'],
              ].map(([key, label]) => (
                <label key={key} className="text-xs text-earth-600">
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
              ))}
              <label className="text-xs text-earth-600">
                Lançamento
                <input
                  type="date"
                  value={form.release_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, release_date: e.target.value }))}
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                />
              </label>
              <label className="text-xs text-earth-600">
                Tipo
                <select
                  value={form.set_kind}
                  onChange={(e) => setForm((prev) => ({ ...prev, set_kind: e.target.value }))}
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                >
                  {SET_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-earth-600">
                Escopo do checklist
                <select
                  value={form.scope_mode}
                  onChange={(e) => setForm((prev) => ({ ...prev, scope_mode: e.target.value }))}
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                >
                  <option value="all_numbers">Todos os números (inclui secretas)</option>
                  <option value="official_only">Só numeração oficial</option>
                </select>
              </label>
              <label className="text-xs text-earth-600 md:col-span-3">
                URL oficial de referência
                <input
                  value={form.official_reference_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, official_reference_url: e.target.value }))}
                  placeholder="Página oficial do produto (só para conferência; não copiar conteúdo)"
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                />
              </label>
              <label className="text-xs text-earth-600">
                Total esperado (com secretas)
                <input
                  type="number"
                  min="1"
                  value={form.expected_total}
                  onChange={(e) => setForm((prev) => ({ ...prev, expected_total: e.target.value }))}
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                />
              </label>
              <label className="text-xs text-earth-600">
                Numeração oficial (/N impresso)
                <input
                  type="number"
                  min="1"
                  value={form.expected_official}
                  onChange={(e) => setForm((prev) => ({ ...prev, expected_official: e.target.value }))}
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                />
              </label>
              <label className="text-xs text-earth-600">
                Contagem por raridade (JSON, opcional)
                <input
                  value={form.rarity_counts}
                  onChange={(e) => setForm((prev) => ({ ...prev, rarity_counts: e.target.value }))}
                  placeholder='{"C": 66, "U": 62}'
                  className="mt-1 w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                />
              </label>
            </div>
            {selectedSet?.official_manifest?.note ? (
              <p className="mt-2 text-xs text-amber-700">{selectedSet.official_manifest.note}</p>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={busy === 'save' || !form.set_code.trim()}
                className="rounded bg-earth-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
              >
                {busy === 'save' ? 'Salvando...' : 'Salvar set'}
              </button>
            </div>
          </form>

          {selectedSet ? (
            <>
              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-earth-900">Status</h3>
                  <StatusBadge status={selectedSet.status} />
                  <span className="text-xs text-earth-600">
                    {items.length} itens ({inChecklist} no checklist)
                    {selectedSet.import_source ? ` · fonte ${selectedSet.import_source}` : ''}
                    {selectedSet.verified_at ? ` · verificado em ${new Date(selectedSet.verified_at).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={busy === 'validate' || !items.length}
                    className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-800 hover:bg-earth-100 disabled:opacity-50"
                  >
                    {busy === 'validate' ? 'Validando...' : 'Rodar validação automática'}
                  </button>
                  {selectedSet.status === 'VALIDATING' ? (
                    <button
                      type="button"
                      onClick={() => handleStatus('VERIFIED')}
                      disabled={busy === 'status'}
                      className="rounded border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Marcar VERIFIED
                    </button>
                  ) : null}
                  {selectedSet.status === 'VERIFIED' ? (
                    <button
                      type="button"
                      onClick={() => handleStatus('VALIDATING')}
                      disabled={busy === 'status'}
                      className="rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Rebaixar para VALIDATING
                    </button>
                  ) : null}
                </div>

                {report?.issues ? (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className={report.passed ? 'text-emerald-700' : 'text-red-700'}>
                      {report.passed ? 'Validação automática OK' : 'Validação automática com erros'} ·{' '}
                      {report.counts?.in_checklist} / {report.expected?.range_max ?? '?'} ·{' '}
                      {report.generated_at ? new Date(report.generated_at).toLocaleString('pt-BR') : ''}
                    </p>
                    {report.issues.map((issue) => (
                      <p key={issue.code} className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                        {issue.severity === 'error' ? '✗' : '!'} {issue.message}
                        {issue.numbers?.length ? ` (${issue.numbers.join(', ')})` : ''}
                      </p>
                    ))}
                  </div>
                ) : report?.stale ? (
                  <p className="mt-3 text-sm text-amber-700">Manifesto alterado; rode a validação de novo.</p>
                ) : null}
                {report?.demoted ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Rebaixado em {new Date(report.demoted.at).toLocaleString('pt-BR')} ({report.demoted.reason}).
                  </p>
                ) : null}
              </div>

              {selectedSet.status === 'VALIDATING' && spotCheckIds.length ? (
                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <h3 className="font-medium text-earth-900">
                    Conferência manual ({checkedCount}/{spotCheckIds.length})
                  </h3>
                  <p className="mt-1 text-xs text-earth-600">
                    Compare cada item com a página oficial: número, nome e raridade japonesa (C, U, R, RR, AR, SR, SAR, UR, MUR). Inclui todas as secretas e 10% aleatório.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReview((prev) => ({ ...prev, checked: Object.fromEntries(spotCheckIds.map((id) => [id, true])) }))}
                      className="rounded border border-earth-300 px-2 py-1 text-xs text-earth-700 hover:bg-earth-100"
                    >
                      Marcar todos
                    </button>
                  </div>
                  <div className="mt-2 max-h-80 overflow-y-auto rounded border border-earth-100">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-earth-50 text-xs text-earth-600">
                        <tr>
                          <th className="px-2 py-1">OK</th>
                          <th className="px-2 py-1">Nº</th>
                          <th className="px-2 py-1">Nome (JA)</th>
                          <th className="px-2 py-1">Raridade JP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spotCheckIds.map((id) => {
                          const item = itemsById.get(id)
                          return (
                            <tr key={id} className="border-t border-earth-100">
                              <td className="px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={Boolean(review.checked[id])}
                                  onChange={(e) =>
                                    setReview((prev) => ({ ...prev, checked: { ...prev.checked, [id]: e.target.checked } }))
                                  }
                                />
                              </td>
                              <td className="px-2 py-1 font-mono">{item?.number || '?'}</td>
                              <td className="px-2 py-1">{item?.name_ja || '—'}</td>
                              <td className="px-2 py-1 font-mono">{item?.rarity || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-earth-800">
                    <input
                      type="checkbox"
                      checked={review.manifest_confirmed}
                      onChange={(e) => setReview((prev) => ({ ...prev, manifest_confirmed: e.target.checked }))}
                    />
                    Conferi total, numeração oficial, data de lançamento e URL contra a página oficial
                  </label>
                  <textarea
                    rows={2}
                    value={review.notes}
                    onChange={(e) => setReview((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas da conferência"
                    className="mt-2 w-full rounded border border-earth-300 px-2 py-1.5 text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveReview}
                      disabled={busy === 'review'}
                      className="rounded bg-earth-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
                    >
                      {busy === 'review' ? 'Salvando...' : 'Salvar conferência'}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <h3 className="font-medium text-earth-900">Importar CSV (entrada manual)</h3>
                <p className="mt-1 text-xs text-earth-600">
                  Colunas: <code>number,name_ja,name_en,rarity,in_checklist</code> (só <code>number</code> é obrigatória).
                  Valores vazios não apagam dados existentes. Use para preencher raridades a partir da página oficial.
                </p>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={'number,name_ja,rarity\n001,ヒビキのカイロス,C'}
                  className="mt-2 w-full rounded border border-earth-300 px-2 py-1.5 font-mono text-xs"
                />
                {csvPreview ? (
                  <div className="mt-1 text-xs">
                    <p className="text-earth-700">{csvPreview.items.length} linha(s) válidas.</p>
                    {csvPreview.errors.map((msg) => (
                      <p key={msg} className="text-red-700">{msg}</p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-earth-800">
                    <input type="checkbox" checked={csvPrune} onChange={(e) => setCsvPrune(e.target.checked)} />
                    Tirar do checklist números ausentes do CSV
                  </label>
                  <button
                    type="button"
                    onClick={handleImportCsv}
                    disabled={busy === 'csv' || !csvPreview?.items.length}
                    className="rounded bg-earth-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
                  >
                    {busy === 'csv' ? 'Importando...' : 'Importar'}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
