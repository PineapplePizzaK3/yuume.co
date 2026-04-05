import { useAdminContext } from '../AdminContext'

export default function LogsSection() {
  const {
    activeTab,
    loadUserLogs,
    userLogsLoading,
    userLogs,
    loadAuthLogs,
    authLogsLoading,
    authLogs,
  } = useAdminContext()

  if (activeTab !== 'logs') return null

  return (
    <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div>
        <h2 className="text-lg font-semibold text-earth-900">Atividades dos usuários</h2>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => loadUserLogs()}
            disabled={userLogsLoading}
            className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
          >
            {userLogsLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {userLogsLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}
        {!userLogsLoading && userLogs.length === 0 && (
          <p className="mt-4 text-sm text-earth-600">Nenhum registro ainda.</p>
        )}
        {!userLogsLoading && userLogs.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-earth-200 bg-white">
            <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
              <thead>
                <tr className="bg-earth-50">
                  <th className="px-4 py-3 font-medium text-earth-900">Data</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Usuário</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Ação</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Entidade</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-200">
                {userLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-earth-50/50">
                    <td className="whitespace-nowrap px-4 py-2 text-earth-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-earth-700">{log.user_name || log.user_email || log.user_id?.slice(0, 8) || '—'}</td>
                    <td className="px-4 py-2 font-medium text-earth-900">
                      {log.action === 'order_create' ? 'Criou pedido' : log.action === 'cart_add' ? 'Adicionou ao carrinho' : log.action === 'profile_update' ? 'Atualizou perfil' : log.action || '—'}
                    </td>
                    <td className="px-4 py-2 text-earth-600">
                      {log.entity_type && log.entity_id ? (
                        <span>{log.entity_type === 'order' ? 'Pedido' : log.entity_type === 'product' ? 'Produto' : log.entity_type} · {String(log.entity_id).slice(0, 8)}…</span>
                      ) : '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-earth-600">
                      {log.details && Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-earth-900">Registro e login</h2>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => loadAuthLogs()}
            disabled={authLogsLoading}
            className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
          >
            {authLogsLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {authLogsLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}
        {!authLogsLoading && authLogs.length === 0 && (
          <p className="mt-4 text-sm text-earth-600">Nenhum registro ainda.</p>
        )}
        {!authLogsLoading && authLogs.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-earth-200 bg-white">
            <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
              <thead>
                <tr className="bg-earth-50">
                  <th className="px-4 py-3 font-medium text-earth-900">Data</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Evento</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Email / Usuário</th>
                  <th className="px-4 py-3 font-medium text-earth-900">ID usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-200">
                {authLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-earth-50/50">
                    <td className="whitespace-nowrap px-4 py-2 text-earth-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2 font-medium text-earth-900">
                      {log.action === 'user_signedup' ? 'Cadastro' : log.action === 'login' ? 'Login' : log.action || '—'}
                    </td>
                    <td className="px-4 py-2 text-earth-700">{log.email || '—'}</td>
                    <td className="px-4 py-2 text-earth-600 font-mono text-xs">{log.user_id ? String(log.user_id).slice(0, 8) + '…' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
