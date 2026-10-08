import { useEffect, useState } from 'react'
import {
  completeLiveRipOpening,
  inspectLiveRipDemoState,
  isCollectorMockMode,
  isCollectorMockSeedEnabled,
  resetLiveRipDemoState,
  resetLiveRipOpeningReserves,
  resetLiveRipOpeningResults,
  setCollectorMockSeedEnabled,
} from '../../../../services/collectorService'

export function BoxBreakLiveControls() {
  const [state, setState] = useState(() => inspectLiveRipDemoState())
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const mockMode = isCollectorMockMode()

  const refresh = () => {
    const next = inspectLiveRipDemoState()
    setState(next)
    if (!next.boxes.some((row) => row.id === selectedId)) {
      setSelectedId(next.boxes[0]?.id || '')
    }
  }

  useEffect(() => {
    if (!mockMode) return undefined
    refresh()
    const onReset = () => refresh()
    window.addEventListener('collector-demo-reset', onReset)
    return () => window.removeEventListener('collector-demo-reset', onReset)
  }, [mockMode, selectedId])

  if (!mockMode) return null

  const selected = state.boxes.find((row) => row.id === selectedId) || null

  const run = async (action, okMessage) => {
    setBusy(true)
    setMessage('')
    const res = await action()
    setBusy(false)
    if (res?.error) {
      setMessage(res.error.message || 'Nao foi possivel aplicar o controle.')
      return
    }
    refresh()
    setMessage(okMessage)
  }

  return (
    <div className="mb-6 rounded-lg border border-collector-600 bg-white p-4">
      <h3 className="font-medium text-earth-900">Controles live (demo)</h3>
      <p className="mt-1 text-sm text-earth-600">
        Resetar cartas e aberturas sem concluir a caixa automaticamente. As reservas de packs podem ser mantidas.
      </p>
      <p className="mt-2 text-xs text-earth-500">
        {state.resultCount} abertura(s) com resultado • {state.pullCount} carta(s) • {state.assetCount} na coleção
      </p>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {state.boxes.length ? (
          state.boxes.map((box) => (
            <button
              key={box.id}
              type="button"
              onClick={() => setSelectedId(box.id)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedId === box.id ? 'border-earth-900 bg-earth-100' : 'border-earth-200 bg-white'
              }`}
            >
              <p className="font-medium text-earth-900">{box.name}</p>
              <p className="text-xs text-earth-600">
                {box.code} • {box.reserved}/{box.totalPacks} packs •{' '}
                {box.opened ? `${box.pulls} carta(s) abertas` : 'ainda sem abertura'}
              </p>
            </button>
          ))
        ) : (
          <p className="text-sm text-earth-600">Nenhuma caixa com reserva ou resultado no momento.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => {
            if (!selected) return
            if (!window.confirm(`Resetar as cartas abertas de ${selected.name}? As reservas de packs ficam.`)) return
            void run(
              () => Promise.resolve(resetLiveRipOpeningResults({ batchId: selected.id })),
              'Cartas desta caixa foram resetadas. A participação volta a aguardar a abertura.'
            )
          }}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-50"
        >
          Resetar cartas desta caixa
        </button>
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => {
            if (!selected) return
            if (!window.confirm(`Abrir agora ${selected.name} e gerar as cartas dos participantes?`)) return
            void run(
              () => completeLiveRipOpening(selected.id),
              'Abertura concluída. As cartas entraram na coleção dos participantes.'
            )
          }}
          className="rounded border border-collector-600 bg-collector-100 px-3 py-2 text-sm font-medium text-collector-800 hover:bg-collector-200 disabled:opacity-50"
        >
          Abrir esta caixa
        </button>
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => {
            if (!selected) return
            if (!window.confirm(`Apagar as reservas de packs de ${selected.name}?`)) return
            void run(async () => {
              resetLiveRipOpeningResults({ batchId: selected.id })
              return resetLiveRipOpeningReserves({ batchId: selected.id })
            }, 'Reservas desta caixa foram apagadas.')
          }}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-50"
        >
          Resetar reservas desta caixa
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm('Resetar todas as caixas, reservas e cartas tiradas?')) return
            void run(
              () => Promise.resolve(resetLiveRipDemoState({ results: true, reservations: true, mockJoins: true })),
              'Caixas, reservas e cartas tiradas foram resetadas.'
            )
          }}
          className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
        >
          Resetar todas as cartas
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const next = !isCollectorMockSeedEnabled()
            setCollectorMockSeedEnabled(next)
            refresh()
            setMessage(next
              ? 'Seed demo da coleção ligado.'
              : 'Seed demo da coleção desligado. Só entram cartas de aberturas live.')
          }}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-50"
        >
          {state.mockSeedEnabled ? 'Esconder seed demo' : 'Mostrar seed demo'}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-earth-700">{message}</p> : null}
    </div>
  )
}
