import { uploadProductImage } from '../../../../services/productService'
import { PRODUCT_CONDITION_OPTIONS } from '../../../../lib/productCondition'
import { useAdminContext } from '../AdminContext'
import ProductCoreFields from './ProductCoreFields'
import ProductScrapeBlock from './ProductScrapeBlock'

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
    groupProductScrapeMeta,
    groupProductScrapePreview,
    handleScrapeOnlineGroupProduct,
    applyPendingGroupProductScrape,
    discardPendingGroupProductScrape,
    isOnlineGroupDestination,
    filteredGroupProductReferences,
    applyReferenceToGroupProductForm,
    masterProductReferences,
    groupProductImageUploading,
    setGroupProductImageUploading,
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
    productCategorySuggestions,
  } = useAdminContext()

  if (activeTab !== 'grupos') return null

  const groupProductGalleryUrls = (() => {
    const fromArr = Array.isArray(groupProductForm.image_urls) ? groupProductForm.image_urls.filter(Boolean) : []
    if (fromArr.length > 0) return fromArr
    return groupProductForm.image_url ? [groupProductForm.image_url] : []
  })()

  const normalizeGroupProductGallery = (f) => {
    const u = [...(f.image_urls || []).filter(Boolean)]
    if (u.length > 0) return u
    return f.image_url ? [f.image_url] : []
  }

  const removeGroupProductImageAt = (index) => {
    setGroupProductForm((f) => {
      const cur = normalizeGroupProductGallery(f)
      if (index < 0 || index >= cur.length) return f
      cur.splice(index, 1)
      return {
        ...f,
        image_urls: cur,
        image_url: cur[0] || '',
      }
    })
  }

  const moveGroupProductImage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    setGroupProductForm((f) => {
      const cur = normalizeGroupProductGallery(f)
      if (fromIndex < 0 || fromIndex >= cur.length || toIndex < 0 || toIndex >= cur.length) return f
      const list = [...cur]
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      return {
        ...f,
        image_urls: list,
        image_url: list[0] || '',
      }
    })
  }

  const setGroupProductCover = (index) => {
    moveGroupProductImage(index, 0)
  }

  const groupProductVersionForm = {
    ...groupProductForm,
    name: groupProductForm.version_name ?? '',
  }

  const setGroupProductVersionForm = (updater) => {
    setGroupProductForm((prev) => {
      const current = { ...prev, name: prev.version_name ?? '' }
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      const nextVersionName = String(next?.name ?? '')
      return {
        ...prev,
        ...next,
        name: prev.name,
        version_name: nextVersionName,
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
                      {p.category ? ` • ${p.category}` : ''}
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
                      {p.category ? ` • ${p.category}` : ''}
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
          <div className="mt-3 min-w-0 space-y-3 rounded-lg border border-earth-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-earth-100 pb-2">
              <p className="text-sm font-semibold text-earth-800">
                {editingGroupProductId || editingPendingProductIndex != null ? 'Editar produto do grupo' : 'Novo produto do grupo'}
              </p>
              <span className="text-xs text-earth-500">Mesmo formato da Lista de Produtos</span>
            </div>
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
              <p className="mb-2 text-sm font-medium text-earth-800">Dados globais do produto pai</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-xs text-earth-700">
                  Nome do produto pai
                  <input
                    required
                    type="text"
                    value={groupProductForm.name}
                    onChange={(e) => setGroupProductForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 block w-full rounded border border-earth-300 px-2 py-1 text-sm text-earth-900"
                  />
                </label>
                <label className="text-xs text-earth-700">
                  Categoria global
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return
                        setGroupProductForm((f) => ({ ...f, category: e.target.value }))
                        e.target.value = ''
                      }}
                      className="block w-full rounded border border-earth-300 bg-white px-2 py-1 text-sm text-earth-900"
                    >
                      <option value="">Selecionar existente</option>
                      {(productCategorySuggestions || []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={groupProductForm.category ?? ''}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Ou digite nova categoria"
                      className="block w-full rounded border border-earth-300 px-2 py-1 text-sm text-earth-900"
                      autoComplete="off"
                    />
                  </div>
                </label>
                <label className="text-xs text-earth-700">
                  Condição global
                  <select
                    value={groupProductForm.item_condition}
                    onChange={(e) => setGroupProductForm((f) => ({ ...f, item_condition: e.target.value }))}
                    className="mt-1 block w-full rounded border border-earth-300 px-2 py-1 text-sm text-earth-900"
                  >
                    {PRODUCT_CONDITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-earth-700">
                  Link interno (admin)
                  <input
                    type="url"
                    value={groupProductForm.admin_product_url ?? ''}
                    onChange={(e) => setGroupProductForm((f) => ({ ...f, admin_product_url: e.target.value }))}
                    placeholder="https://... (interno)"
                    className="mt-1 block w-full rounded border border-earth-300 px-2 py-1 text-sm text-earth-900"
                  />
                </label>
              </div>
              <label className="mt-2 block text-xs text-earth-700">
                Descrição global
                <textarea
                  value={groupProductForm.description ?? ''}
                  onChange={(e) => setGroupProductForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded border border-earth-300 px-2 py-1 text-sm text-earth-900"
                />
              </label>
              <p className="mt-2 text-xs text-earth-600">
                Preço, estoque e imagens são definidos por versão abaixo.
              </p>
            </div>

            <ProductScrapeBlock
              sourceUrl={groupProductSourceUrlInput}
              setSourceUrl={(next) => {
                setGroupProductSourceUrlInput(next)
                setGroupProductForm((f) => ({ ...f, source_url: next }))
              }}
              onScrape={handleScrapeOnlineGroupProduct}
              scraping={groupProductScraping}
              scrapeMeta={groupProductScrapeMeta}
              scrapePreview={groupProductScrapePreview}
              onApplyPreview={applyPendingGroupProductScrape}
              onDiscardPreview={discardPendingGroupProductScrape}
              placeholder="URL do produto para scrape (Online)"
              previewText="Confirmação manual: o scrape encontrou dados com baixa confiança e não sobrescreveu os campos atuais."
              showWarnings
              disabled={!isOnlineGroupDestination}
            />
            <div className="rounded-lg border border-earth-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-earth-800">Versões do produto</p>
              </div>
              <div className="rounded-lg border border-earth-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-earth-800">Versão 1 • Padrão</p>
                </div>
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
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
              <ProductCoreFields
                form={groupProductVersionForm}
                setForm={setGroupProductVersionForm}
                productCategorySuggestions={productCategorySuggestions}
                images={groupProductGalleryUrls}
                imageUploading={groupProductImageUploading}
                setImageUploading={setGroupProductImageUploading}
                imageUploadError={''}
                setImageUploadError={() => {}}
                newImageUrl={groupProductForm.image_url_input ?? ''}
                setNewImageUrl={(v) => setGroupProductForm((f) => ({ ...f, image_url_input: v }))}
                addImage={(url) => {
                  const raw = String(url || '').trim()
                  if (!raw) return
                  setGroupProductForm((f) => {
                    const cur = normalizeGroupProductGallery(f)
                    if (cur.includes(raw)) return { ...f, image_url_input: '' }
                    const next = [...cur, raw]
                    return { ...f, image_urls: next, image_url: f.image_url || next[0], image_url_input: '' }
                  })
                }}
                moveImage={moveGroupProductImage}
                setCover={setGroupProductCover}
                removeImageAt={removeGroupProductImageAt}
                showCondition
                conditionOptions={PRODUCT_CONDITION_OPTIONS}
              />
            </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => handleSaveGroupProduct({ ...e, preventDefault: () => {} })}
                disabled={groupProductSubmitting || !(groupProductForm.version_name || groupProductForm.name)?.trim()}
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
