import { useAdminContext } from '../AdminContext'

export default function FraudeSection() {
  const {
    activeTab,
    loadFraudQueue,
    fraudQueueLoading,
    fraudMinScore,
    setFraudMinScore,
    fraudStatusFilter,
    setFraudStatusFilter,
    fraudSearchTerm,
    setFraudSearchTerm,
    filteredFraudReferrals,
    filteredFraudAffiliateOrders,
    fraudQueue,
    handleFraudDecision,
    fraudDecisionLoadingId,
    formatMoney,
  } = useAdminContext()

  if (activeTab !== 'fraude') return null

  return (
    <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Revisão antifraude</h2>
          <p className="mt-1 text-sm text-earth-600">Casos de referral e affiliate com risco elevado para decisão manual.</p>
        </div>
        <button
          type="button"
          onClick={() => loadFraudQueue()}
          disabled={fraudQueueLoading}
          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          {fraudQueueLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {fraudQueueLoading && <p className="text-sm text-earth-600">Carregando fila de fraude...</p>}

      {!fraudQueueLoading && (
        <>
          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="text-earth-700">Score mínimo</span>
                <input type="number" min="0" step="1" value={fraudMinScore} onChange={(e) => setFraudMinScore(e.target.value)} className="mt-1 w-full rounded border border-earth-300 px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="text-earth-700">Status</span>
                <select value={fraudStatusFilter} onChange={(e) => setFraudStatusFilter(e.target.value)} className="mt-1 w-full rounded border border-earth-300 px-3 py-2">
                  <option value="all">Todos</option>
                  <option value="pending">Pending</option>
                  <option value="flagged">Flagged</option>
                  <option value="rejected">Rejected</option>
                  <option value="approved">Approved</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-earth-700">Busca (ID / flags)</span>
                <input type="search" value={fraudSearchTerm} onChange={(e) => setFraudSearchTerm(e.target.value)} placeholder="pedido, referral, user..." className="mt-1 w-full rounded border border-earth-300 px-3 py-2" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="font-medium text-earth-900">Referrals em revisão</h3>
            <p className="mt-1 text-xs text-earth-500">Exibindo {filteredFraudReferrals.length} de {(fraudQueue.referrals || []).length}</p>
            {filteredFraudReferrals.length === 0 ? (
              <p className="mt-2 text-sm text-earth-600">Nenhum referral pendente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {filteredFraudReferrals.map((row) => (
                  <li key={row.id} className="rounded border border-earth-200 bg-earth-50 p-3">
                    <p className="text-sm font-medium text-earth-900">Referral {String(row.id).slice(0, 8)}… • score {Number(row.risk_score || 0).toFixed(1)}</p>
                    <p className="mt-1 text-xs text-earth-600">{row.status} • referrer {String(row.referrer_id || '').slice(0, 8)}… • referred {String(row.referred_id || '').slice(0, 8)}…</p>
                    <p className="mt-1 break-all text-xs text-earth-500">flags: {JSON.stringify(row.fraud_flags || {})}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ['approve', 'Aprovar'],
                        ['reject', 'Rejeitar'],
                        ['flag', 'Flag'],
                        ['pending', 'Pendente'],
                      ].map(([decision, label]) => {
                        const key = `referral:${row.id}:${decision}`
                        return (
                          <button
                            key={decision}
                            type="button"
                            onClick={() => handleFraudDecision('referral', row.id, decision)}
                            disabled={fraudDecisionLoadingId === key}
                            className="rounded border border-earth-300 bg-white px-2.5 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-earth-200 bg-white p-4">
            <h3 className="font-medium text-earth-900">Affiliate orders em revisão</h3>
            <p className="mt-1 text-xs text-earth-500">Exibindo {filteredFraudAffiliateOrders.length} de {(fraudQueue.affiliate_orders || []).length}</p>
            {filteredFraudAffiliateOrders.length === 0 ? (
              <p className="mt-2 text-sm text-earth-600">Nenhum affiliate order pendente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {filteredFraudAffiliateOrders.map((row) => (
                  <li key={row.id} className="rounded border border-earth-200 bg-earth-50 p-3">
                    <p className="text-sm font-medium text-earth-900">Affiliate order {String(row.id).slice(0, 8)}… • score {Number(row.risk_score || 0).toFixed(1)}</p>
                    <p className="mt-1 text-xs text-earth-600">{row.status} • order {String(row.order_id || '').slice(0, 8)}… • comissão {formatMoney(Number(row.commission_amount || 0), 'BRL')}</p>
                    <p className="mt-1 break-all text-xs text-earth-500">flags: {JSON.stringify(row.flags || {})}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ['approve', 'Aprovar'],
                        ['reject', 'Rejeitar'],
                        ['flag', 'Flag'],
                        ['pending', 'Pendente'],
                      ].map(([decision, label]) => {
                        const key = `affiliate_order:${row.id}:${decision}`
                        return (
                          <button
                            key={decision}
                            type="button"
                            onClick={() => handleFraudDecision('affiliate_order', row.id, decision)}
                            disabled={fraudDecisionLoadingId === key}
                            className="rounded border border-earth-300 bg-white px-2.5 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
