import { useAdminContext } from '../AdminContext'

function parseInventoryProductLines(rawDescription) {
  const text = String(rawDescription || '').trim()
  if (!text) return []
  return text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const withPrice = part.match(/^\s*(\d+)\s*x\s+(.+?)\s*\(\s*([-0-9.]+)\s*\)\s*$/i)
      if (withPrice) {
        return {
          quantity: Math.max(1, parseInt(withPrice[1], 10) || 1),
          name: String(withPrice[2] || '').trim(),
          price: Number(withPrice[3]),
        }
      }
      const simple = part.match(/^\s*(\d+)\s*x\s+(.+?)\s*$/i)
      if (!simple) return null
      return {
        quantity: Math.max(1, parseInt(simple[1], 10) || 1),
        name: String(simple[2] || '').trim(),
        price: null,
      }
    })
    .filter((line) => line && line.name)
}

export default function ProdutosUsuariosSection() {
  const ctx = useAdminContext() || {}
  const {
    activeTab,
    loadShippingPanel,
    shippingPanelLoading,
    shippingPanel,
    adminUserFilterTerm,
    openEditInventoryModal,
    handleRemoveInventoryProductLine,
    handleDeleteUserInventory,
    submitting,
  } = ctx

  if (activeTab !== 'produtos_usuarios') return null

  const includeByUser = (row) => {
    if (!adminUserFilterTerm) return true
    const haystack = [row?.user_name, row?.user_email, row?.user_id]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    return haystack.includes(adminUserFilterTerm)
  }

  const inventoryReady = Array.isArray(shippingPanel?.inventoryReady) ? shippingPanel.inventoryReady : []
  const filteredInventoryReady = inventoryReady.filter(includeByUser)
  const groupedByUser = filteredInventoryReady.reduce((acc, item) => {
    const key = item.user_id || 'sem_usuario'
    if (!acc[key]) {
      acc[key] = {
        key,
        label: [item.user_name, item.user_email].filter(Boolean).join(' • ') || item.user_id || 'Usuário sem identificação',
        items: [],
      }
    }
    acc[key].items.push(item)
    return acc
  }, {})

  const usersGroups = Object.values(groupedByUser).sort((a, b) =>
    String(a?.label || '').localeCompare(String(b?.label || ''), 'pt-BR')
  )

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Produtos dos usuários</h2>
      <p className="mt-1 text-sm text-earth-600">
        Itens do inventário agrupados por usuário. Você pode editar o pacote completo ou remover linhas específicas da lista.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => loadShippingPanel?.()}
          disabled={shippingPanelLoading}
          className="rounded-lg border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          Atualizar
        </button>
      </div>

      {shippingPanelLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}

      {!shippingPanelLoading && usersGroups.length === 0 && (
        <p className="mt-4 text-sm text-earth-500">Nenhum produto encontrado para o filtro atual.</p>
      )}

      {!shippingPanelLoading && usersGroups.length > 0 && (
        <div className="mt-6 space-y-4">
          {usersGroups.map((group) => (
            <details key={group.key} className="rounded-lg border border-earth-200 bg-white p-4" open>
              <summary className="cursor-pointer list-none font-medium text-earth-900">
                {group.label}
                <span className="ml-2 rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-600">
                  {group.items.length} pacote(s)
                </span>
              </summary>

              <div className="mt-3 space-y-3">
                {group.items.map((inv) => {
                  const lines = parseInventoryProductLines(inv.products_description)
                  return (
                    <div key={inv.id} className="rounded border border-earth-100 bg-earth-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-earth-900">{inv.name || inv.id?.slice(0, 8)}</p>
                          <p className="text-xs text-earth-600">
                            {inv.status === 'stored' ? 'Armazenado' : 'Pronto para envio'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditInventoryModal?.(inv)}
                            className="rounded border border-earth-300 bg-white px-3 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100"
                          >
                            Editar pacote
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                'Remover este pacote do inventário do usuário? Esta ação não pode ser desfeita.'
                              )
                              if (!ok) return
                              void handleDeleteUserInventory?.(inv)
                            }}
                            disabled={submitting}
                            className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Remover pacote
                          </button>
                        </div>
                      </div>

                      {lines.length === 0 ? (
                        <p className="mt-2 text-xs text-earth-500">Sem lista de produtos detalhada.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {lines.map((line, idx) => (
                            <li
                              key={`${inv.id}-line-${idx}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded border border-earth-200 bg-white px-2 py-1 text-sm"
                            >
                              <span className="text-earth-800">
                                {line.name} {line.quantity > 1 ? `x${line.quantity}` : ''}
                                {line.price != null && Number.isFinite(line.price) ? ` (${line.price})` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm('Remover este produto da lista do usuário?')
                                  if (!ok) return
                                  void handleRemoveInventoryProductLine?.(inv, idx)
                                }}
                                disabled={submitting}
                                className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Remover produto
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
