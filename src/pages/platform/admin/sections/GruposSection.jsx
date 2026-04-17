import { uploadProductImage } from '../../../../services/productService'
import { useAdminContext } from '../AdminContext'

export default function GruposSection() {
  const {
    activeTab,
    handleSaveGroup,
    groupForm,
    setGroupForm,
    editingGroupId,
    groupProducts,
    formatJPY,
    getProductBasePriceJpy,
    formatWeight,
    handleEditGroupProduct,
    handleDeleteGroupProduct,
    pendingGroupProducts,
    handleEditPendingGroupProduct,
    handleRemovePendingGroupProduct,
    groupProductForm,
    groupProductSubmitting,
    handleSaveGroupProduct,
    groupProductReferenceSearch,
    setGroupProductReferenceSearch,
    groupProductReferenceId,
    setGroupProductReferenceId,
    groupProductSourceUrlInput,
    setGroupProductSourceUrlInput,
    groupProductScraping,
    handleScrapeOnlineGroupProduct,
    isOnlineGroupDestination,
    filteredGroupProductReferences,
    applyReferenceToGroupProductForm,
    masterProductReferences,
    groupProductImageUploading,
    setGroupProductImageUploading,
    setMessage,
    setGroupProductForm,
    editingGroupProductId,
    editingPendingProductIndex,
    resetGroupProductForm,
    groupImageUploading,
    setGroupImageUploading,
    groupImageUploadError,
    setGroupImageUploadError,
    newGroupImageUrl,
    setNewGroupImageUrl,
    groupSubmitting,
    resetGroupForm,
    groupsLoading,
    purchaseGroups,
    handleEditGroup,
    handleDeleteGroup,
  } = useAdminContext()

  if (activeTab !== 'grupos') return null

  const groupProductGalleryUrls = (() => {
    const fromArr = Array.isArray(groupProductForm.image_urls) ? groupProductForm.image_urls.filter(Boolean) : []
    if (fromArr.length > 0) return fromArr
    return groupProductForm.image_url ? [groupProductForm.image_url] : []
  })()

  const removeGroupProductImageAt = (index) => {
    setGroupProductForm((f) => {
      const cur = (() => {
        const u = [...(f.image_urls || []).filter(Boolean)]
        if (u.length > 0) return u
        return f.image_url ? [f.image_url] : []
      })()
      if (index < 0 || index >= cur.length) return f
      cur.splice(index, 1)
      return {
        ...f,
        image_urls: cur,
        image_url: cur[0] || '',
      }
    })
  }

  const addGroupProductImageFromInput = () => {
    const raw = (groupProductForm.image_url_input || '').trim()
    if (!raw) return
    if (!/^https?:\/\//i.test(raw)) {
      setMessage('Informe uma URL completa (http:// ou https://).')
      return
    }
    setMessage('')
    setGroupProductForm((f) => {
      const cur = (() => {
        const u = [...(f.image_urls || []).filter(Boolean)]
        if (u.length > 0) return u
        return f.image_url ? [f.image_url] : []
      })()
      if (cur.includes(raw)) {
        return { ...f, image_url_input: '' }
      }
      const next = [...cur, raw]
      return {
        ...f,
        image_urls: next,
        image_url: f.image_url || next[0],
        image_url_input: '',
      }
    })
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Compras Programadas</h2>

      <form onSubmit={handleSaveGroup} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-earth-700">Nome *</label>
          <input
            required
            type="text"
            value={groupForm.name}
            onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-earth-700">Descrição</label>
          <textarea
            value={groupForm.description}
            onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-earth-700">Destino do grupo *</label>
          <select
            required
            value={groupForm.destination || ''}
            onChange={(e) => setGroupForm((f) => ({ ...f, destination: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
          >
            <option value="">Selecione</option>
            <option value="online">Online</option>
            <option value="physical">Física</option>
          </select>
          <p className="mt-1 text-xs text-earth-500">
            Define em qual subpágina o card aparecerá.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-earth-700">Frete fixo (¥) no checkout</label>
            <input
              type="number"
              min={0}
              step={1}
              value={groupForm.scheduled_shipping_fee_jpy ?? ''}
              onChange={(e) => setGroupForm((f) => ({ ...f, scheduled_shipping_fee_jpy: e.target.value }))}
              placeholder="—"
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <p className="mt-1 text-xs text-earth-500">
              Cobrado uma vez por checkout que incluir itens deste grupo (Compras Programadas). Vazio = sem frete configurado.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-700">Subtotal mínimo (¥) para frete zero</label>
            <input
              type="number"
              min={0}
              step={1}
              value={groupForm.scheduled_free_shipping_min_jpy ?? ''}
              onChange={(e) => setGroupForm((f) => ({ ...f, scheduled_free_shipping_min_jpy: e.target.value }))}
              placeholder="—"
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <p className="mt-1 text-xs text-earth-500">
              Soma em ¥ dos produtos deste grupo no carrinho; acima ou igual a este valor, o frete fixo não é cobrado. Vazio = sem isenção por piso.
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-earth-200 bg-white p-4 shadow-sm ring-1 ring-earth-900/5">
        <div className="min-w-0">
          <label className="block text-sm font-medium text-earth-700">Produtos do grupo</label>
          <p className="mt-1 text-xs text-earth-500">
            {editingGroupId
              ? 'Nome, descrição, preço, estoque e uma ou mais fotos (a primeira é a capa). Peso e link interno são opcionais.'
              : 'Adicione produtos antes de criar o grupo'}
          </p>
          {editingGroupId && groupProducts.length > 0 && (
            <ul className="mt-2 space-y-2">
              {groupProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-earth-800">
                      {p.name} — {formatJPY(getProductBasePriceJpy(p))}
                      {Number(p.weight_kg ?? 0) > 0 ? ` • ${formatWeight(p.weight_kg)}` : ''}
                      {` • Estoque: ${p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}`}
                    </span>
                    {p.admin_product_url && /^https?:\/\//i.test(String(p.admin_product_url).trim()) && (
                      <a
                        href={String(p.admin_product_url).trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-xs font-medium text-blue-700 hover:underline"
                      >
                        Link interno (admin)
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => handleEditGroupProduct(p)} className="text-sm font-medium text-earth-600 hover:text-earth-900">
                      Editar
                    </button>
                    <button type="button" onClick={() => handleDeleteGroupProduct(p.id)} className="text-sm font-medium text-red-600 hover:text-red-800">
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!editingGroupId && pendingGroupProducts.length > 0 && (
            <ul className="mt-2 space-y-2">
              {pendingGroupProducts.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-earth-800">
                      {p.name} — {formatJPY(getProductBasePriceJpy(p))}
                      {Number(p.weight_kg ?? 0) > 0 ? ` • ${formatWeight(p.weight_kg)}` : ''}
                      {` • Estoque: ${p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}`}
                    </span>
                    {p.admin_product_url && /^https?:\/\//i.test(String(p.admin_product_url).trim()) && (
                      <a
                        href={String(p.admin_product_url).trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-xs font-medium text-blue-700 hover:underline"
                      >
                        Link interno (admin)
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => handleEditPendingGroupProduct(p, i)} className="text-sm font-medium text-earth-600 hover:text-earth-900">
                      Editar
                    </button>
                    <button type="button" onClick={() => handleRemovePendingGroupProduct(i)} className="text-sm font-medium text-red-600 hover:text-red-800">
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div
            className="mt-3 min-w-0 space-y-2 rounded-lg border border-earth-200 bg-earth-100/50 p-3"
            onKeyDown={(e) => {
              if (e.defaultPrevented) return
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                if (groupProductForm.name?.trim() && !groupProductSubmitting) {
                  handleSaveGroupProduct({ ...e, preventDefault: () => {} })
                }
              }
            }}
          >
            {isOnlineGroupDestination && (
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input
                  type="url"
                  value={groupProductSourceUrlInput}
                  onChange={(e) => {
                    const next = e.target.value
                    setGroupProductSourceUrlInput(next)
                    setGroupProductForm((f) => ({ ...f, source_url: next }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleScrapeOnlineGroupProduct()
                    }
                  }}
                  placeholder="URL do produto para scrape (Online)"
                  className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                />
                <button
                  type="button"
                  onClick={() => void handleScrapeOnlineGroupProduct()}
                  disabled={groupProductScraping || !groupProductSourceUrlInput.trim()}
                  className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                >
                  {groupProductScraping ? 'Buscando...' : 'Buscar dados'}
                </button>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              <input
                type="search"
                value={groupProductReferenceSearch}
                onChange={(e) => setGroupProductReferenceSearch(e.target.value)}
                placeholder="Buscar item na Lista de Produtos..."
                className="min-w-0 w-full shrink rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900 sm:flex-1 sm:basis-[min(100%,14rem)]"
              />
              <select
                value={groupProductReferenceId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setGroupProductReferenceId(nextId)
                  const ref = filteredGroupProductReferences.find((p) => p.id === nextId)
                  if (ref) applyReferenceToGroupProductForm(ref)
                }}
                className="min-w-0 w-full max-w-full shrink rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900 sm:flex-1 sm:basis-[min(100%,14rem)]"
              >
                <option value="">Selecionar referência do catálogo</option>
                {filteredGroupProductReferences.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({String(p.id).slice(0, 8)}…)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const ref = masterProductReferences.find((p) => p.id === groupProductReferenceId)
                  if (ref) applyReferenceToGroupProductForm(ref)
                }}
                disabled={!groupProductReferenceId}
                className="w-full shrink-0 rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60 sm:w-auto sm:self-center"
              >
                Aplicar referência
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-earth-700">Nome:</span>
              <input
                type="text"
                placeholder="Nome do produto"
                value={groupProductForm.name}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, name: e.target.value }))}
                className="min-w-[140px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              <span className="text-sm font-medium text-earth-700">Preço (¥):</span>
              <input
                type="number"
                placeholder="0"
                value={groupProductForm.price}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, price: e.target.value }))}
                className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              <span className="text-sm font-medium text-earth-700">Peso (opcional):</span>
              <input
                type="number"
                step={groupProductForm.weight_unit === 'g' ? '1' : '0.001'}
                min="0"
                placeholder="—"
                value={groupProductForm.weight_kg}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, weight_kg: e.target.value }))}
                className="w-20 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              <select
                value={groupProductForm.weight_unit}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, weight_unit: e.target.value }))}
                className="rounded-lg border border-earth-300 px-2 py-2 text-sm text-earth-900"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <span className="text-sm font-medium text-earth-700">Estoque:</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ilimitado"
                value={groupProductForm.stock_quantity}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-700">Descrição do produto</label>
              <textarea
                value={groupProductForm.description ?? ''}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Detalhes visíveis para o cliente no modal do produto (opcional)"
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-700">Link do produto (somente admin)</label>
              <input
                type="url"
                value={groupProductForm.admin_product_url ?? ''}
                onChange={(e) => setGroupProductForm((f) => ({ ...f, admin_product_url: e.target.value }))}
                placeholder="https://… (não aparece para clientes)"
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              <p className="mt-1 text-xs text-earth-500">
                Referência interna para a equipe. Não é exibido na loja nem nas Compras Programadas.
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-earth-700">Fotos do produto</span>
              <p className="text-xs text-earth-500">Envie várias imagens ou adicione por URL. A primeira foto é usada como capa nos cards.</p>
              {groupProductGalleryUrls.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {groupProductGalleryUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-earth-200 bg-earth-100">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-earth-900/85 px-1 py-0.5 text-[10px] font-medium text-white">
                          Capa
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGroupProductImageAt(idx)}
                        className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs font-bold text-white hover:bg-black/75"
                        aria-label="Remover foto"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                  {groupProductImageUploading ? 'Enviando...' : 'Enviar do PC (várias)'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={groupProductImageUploading}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('image/'))
                      if (!files.length) return
                      setGroupProductImageUploading(true)
                      setMessage('')
                      try {
                        const uploaded = []
                        for (const file of files) {
                          const { data, error } = await uploadProductImage(file)
                          if (error) {
                            setMessage(error.message || 'Falha no upload')
                            break
                          }
                          if (data) uploaded.push(data)
                        }
                        if (uploaded.length) {
                          setGroupProductForm((f) => {
                            const cur = [...(f.image_urls || []).filter(Boolean)]
                            const base = cur.length ? cur : f.image_url ? [f.image_url] : []
                            const next = [...base, ...uploaded]
                            return {
                              ...f,
                              image_urls: next,
                              image_url: f.image_url || next[0] || '',
                            }
                          })
                        }
                      } finally {
                        setGroupProductImageUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-xs font-medium text-earth-600">URL da imagem</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={groupProductForm.image_url_input ?? ''}
                    onChange={(e) => setGroupProductForm((f) => ({ ...f, image_url_input: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addGroupProductImageFromInput()
                      }
                    }}
                    className="mt-0.5 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={addGroupProductImageFromInput}
                  className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
                >
                  Adicionar URL
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => handleSaveGroupProduct({ ...e, preventDefault: () => {} })}
                disabled={groupProductSubmitting || !groupProductForm.name?.trim()}
                className="rounded-lg bg-earth-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
              >
                {editingGroupProductId || editingPendingProductIndex != null ? 'Salvar' : 'Adicionar'} produto
              </button>
              {(editingGroupProductId || editingPendingProductIndex != null) && (
                <button type="button" onClick={resetGroupProductForm} className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="group_is_active"
            checked={groupForm.is_active}
            onChange={(e) => setGroupForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="rounded border-earth-300"
          />
          <label htmlFor="group_is_active" className="text-sm font-medium text-earth-700">
            Ativo (visível em Compras Programadas)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-earth-700">Fotos do grupo (obrigatório)</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
              {groupImageUploading ? 'Enviando...' : 'Enviar arquivo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={groupImageUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setGroupImageUploadError('')
                  setGroupImageUploading(true)
                  try {
                    const { data, error } = await uploadProductImage(file)
                    if (error) {
                      setGroupImageUploadError(error.message || 'Falha no upload')
                      return
                    }
                    if (data) {
                      setGroupForm((f) => ({
                        ...f,
                        image_urls: [...(f.image_urls || []), data],
                        image_url: f.image_url || data,
                      }))
                    }
                  } finally {
                    setGroupImageUploading(false)
                    e.target.value = ''
                  }
                }}
              />
            </label>

            <input
              type="url"
              value={newGroupImageUrl}
              onChange={(e) => {
                setNewGroupImageUrl(e.target.value)
                setGroupImageUploadError('')
              }}
              placeholder="Cole a URL e pressione Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const url = newGroupImageUrl?.trim()
                  if (!url) return
                  setGroupForm((f) => ({
                    ...f,
                    image_urls: [...(f.image_urls || []), url],
                    image_url: f.image_url || url,
                  }))
                  setNewGroupImageUrl('')
                }
              }}
              className="min-w-[200px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />

            <button
              type="button"
              onClick={() => {
                const url = newGroupImageUrl?.trim()
                if (!url) return
                setGroupForm((f) => ({
                  ...f,
                  image_urls: [...(f.image_urls || []), url],
                  image_url: f.image_url || url,
                }))
                setNewGroupImageUrl('')
              }}
              className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
            >
              Adicionar URL
            </button>
          </div>

          {groupImageUploadError && <p className="mt-2 text-sm text-red-600">{groupImageUploadError}</p>}

          {groupForm.image_urls?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(groupForm.image_urls || []).filter(Boolean).map((url, i) => (
                <div key={i} className="relative inline-block">
                  <img src={url} alt="" className="h-20 w-20 rounded border border-earth-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...(groupForm.image_urls || [])]
                      list.splice(i, 1)
                      setGroupForm((f) => ({
                        ...f,
                        image_urls: list,
                        image_url: list[0] || '',
                      }))
                    }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                    aria-label="Remover foto"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={groupSubmitting}
            className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {groupSubmitting ? (editingGroupId ? 'Salvando...' : 'Criando...') : (editingGroupId ? 'Salvar alterações' : 'Criar grupo de compra')}
          </button>
          <button
            type="button"
            onClick={resetGroupForm}
            disabled={groupSubmitting}
            className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="font-medium text-earth-900">Grupos cadastrados</h3>
        {groupsLoading && <p className="mt-2 text-sm text-earth-600">Carregando...</p>}
        {!groupsLoading && purchaseGroups.length === 0 && (
          <p className="mt-2 text-sm text-earth-600">Nenhum grupo ainda.</p>
        )}
        {!groupsLoading && purchaseGroups.length > 0 && (
          <ul className="mt-4 space-y-2">
            {purchaseGroups.map((g) => (
              <li
                key={g.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-earth-200 bg-white p-4"
              >
                <div className="flex items-start gap-4">
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-earth-200" />
                  )}
                  <div>
                    <p className="font-medium text-earth-900">{g.name}</p>
                    <p className="mt-1">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        g.destination === 'online'
                          ? 'bg-sky-100 text-sky-900'
                          : g.destination === 'physical'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                      }`}>
                        {g.destination === 'online'
                          ? 'Online'
                          : g.destination === 'physical'
                            ? 'Física'
                            : 'Sem destino'}
                      </span>
                    </p>
                    {g.description && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-earth-600">{g.description}</p>}
                    <p className="mt-1 text-xs text-earth-500">
                      Produtos: {g.products_count ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!g.is_active && (
                    <span className="rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-900">Inativo</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEditGroup(g)}
                    className="text-sm font-medium text-earth-600 hover:text-earth-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
