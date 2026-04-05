import { useAdminContext } from '../AdminContext'

export default function UsuariosSection() {
  const {
    activeTab,
    usersListLoading,
    usersList,
    openUserDetail,
    PaginationControls,
    usersPage,
    usersHasMore,
    setUsersPage,
  } = useAdminContext()

  if (activeTab !== 'usuarios') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Gestão de Usuários</h2>
      <p className="mt-1 text-sm text-earth-600">
        Visualize e edite informações dos usuários, adicione saldo na carteira e gerencie pedidos.
      </p>
      {usersListLoading && <p className="mt-4 text-sm text-earth-600">Carregando usuários...</p>}
      {!usersListLoading && usersList.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Nenhum usuário cadastrado.</p>
      )}
      {!usersListLoading && usersList.length > 0 && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-earth-200 bg-white">
            <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
              <thead>
                <tr className="bg-earth-50">
                  <th className="px-4 py-3 font-medium text-earth-900">Nome</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Email</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Código</th>
                  <th className="px-4 py-3 font-medium text-earth-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-200">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-earth-50/50">
                    <td className="px-4 py-3 font-medium text-earth-900">{u.name || '—'}</td>
                    <td className="px-4 py-3 text-earth-700">{u.email || '—'}</td>
                    <td className="px-4 py-3 font-mono text-earth-600">{u.account_code || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openUserDetail(u)}
                        className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                      >
                        Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={usersPage}
            hasMore={usersHasMore}
            loading={usersListLoading}
            onPrev={() => setUsersPage((p) => Math.max(0, p - 1))}
            onNext={() => setUsersPage((p) => p + 1)}
          />
        </div>
      )}
    </section>
  )
}
