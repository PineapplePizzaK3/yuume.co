import { PRODUCT_CONDITION_OPTIONS } from '../../../../lib/productCondition'
import { uploadProductImage } from '../../../../services/productService'
import { useAdminContext } from '../AdminContext'

export default function CatalogoProdutosSection() {
  const {
    activeTab,
    resetForm,
    setCatalogCreateOpen,
    loadProducts,
    catalogSearch,
    setCatalogSearch,
    catalogStatusFilter,
    setCatalogStatusFilter,
    catalogCreateOpen,
    handleSave,
    form,
    setForm,
    imageUploading,
    setImageUploadError,
    setImageUploading,
    addProductImage,
    newImageUrl,
    setNewImageUrl,
    imageUploadError,
    moveProductImage,
    setProductCover,
    removeProductImageAt,
    submitting,
    editingId,
    catalogProducts,
    products,
    loading,
    getProductBasePriceJpy,
    formatJPY,
    getProductConditionMeta,
    handleEdit,
    handleDuplicate,
    duplicatingId,
    handleDelete,
    PaginationControls,
    productsPage,
    productsHasMore,
    setProductsPage,
  } = useAdminContext()

  if (activeTab !== 'catalogo_produtos') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Lista de Produtos (catálogo único)</h2>
          <p className="mt-1 text-sm text-earth-600">
            Base central de produtos usada em loja, grupos de compra, pedidos e invoices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm()
              setCatalogCreateOpen(true)
            }}
            className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
          >
            Adicionar produto na lista
          </button>
          <button
            type="button"
            onClick={() => loadProducts()}
            className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Atualizar lista
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          placeholder="Buscar por nome, id, descricao..."
          className="min-w-[220px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
        />
        <select
          value={catalogStatusFilter}
          onChange={(e) => setCatalogStatusFilter(e.target.value)}
          className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {catalogCreateOpen && (
        <form
          onSubmit={handleSave}
          className="mt-4 space-y-3 rounded-lg border border-earth-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-earth-700">Nome *</span>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="min-w-[180px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <span className="text-sm font-medium text-earth-700">Preço (¥) *</span>
            <input
              required
              type="number"
              step="1"
              min="0"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <span className="text-sm font-medium text-earth-700">Peso (opcional)</span>
            <input
              type="number"
              step={form.weight_unit === 'g' ? '1' : '0.001'}
              min="0"
              value={form.weight_kg}
              onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
              className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <select
              value={form.weight_unit}
              onChange={(e) => setForm((f) => ({ ...f, weight_unit: e.target.value }))}
              className="rounded-lg border border-earth-300 px-2 py-2 text-earth-900"
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-earth-700">Estoque</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock_quantity}
              onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              placeholder="Ilimitado"
              className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <span className="text-sm font-medium text-earth-700">Condicao</span>
            <select
              value={form.item_condition}
              onChange={(e) => setForm((f) => ({ ...f, item_condition: e.target.value }))}
              className="rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            >
              {PRODUCT_CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-earth-700">Imagens do produto</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                {imageUploading ? 'Enviando...' : 'Enviar arquivo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={imageUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImageUploadError('')
                    setImageUploading(true)
                    try {
                      const { data, error } = await uploadProductImage(file)
                      if (error) {
                        setImageUploadError(error.message || 'Falha no upload')
                        return
                      }
                      if (data) {
                        addProductImage(data)
                      }
                    } finally {
                      setImageUploading(false)
                      e.target.value = ''
                    }
                  }}
                />
              </label>

              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => {
                  setNewImageUrl(e.target.value)
                  setImageUploadError('')
                }}
                placeholder="Cole a URL e pressione Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const url = newImageUrl?.trim()
                    if (!url) return
                    addProductImage(url)
                    setNewImageUrl('')
                  }
                }}
                className="min-w-[220px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />

              <button
                type="button"
                onClick={() => {
                  const url = newImageUrl?.trim()
                  if (!url) return
                  addProductImage(url)
                  setNewImageUrl('')
                }}
                className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
              >
                Adicionar URL
              </button>
            </div>

            {imageUploadError && <p className="mt-2 text-sm text-red-600">{imageUploadError}</p>}

            {form.image_urls?.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-earth-600">
                  Arraste para reordenar. A primeira imagem e a capa do produto.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(form.image_urls || []).filter(Boolean).map((url, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const from = parseInt(e.dataTransfer.getData('text/plain'), 10)
                        if (Number.isInteger(from)) moveProductImage(from, i)
                      }}
                      className="group relative inline-block cursor-grab active:cursor-grabbing"
                    >
                      <img src={url} alt="" className="h-20 w-20 rounded border border-earth-200 object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-earth-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Capa
                        </span>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setProductCover(i)}
                          className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-earth-800 hover:bg-white"
                        >
                          Definir capa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeProductImageAt(i)}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                        aria-label="Remover foto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <span className="pt-2 text-sm font-medium text-earth-700">Descrição</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="min-w-[240px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="catalog_is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-earth-300"
            />
            <label htmlFor="catalog_is_active" className="text-sm font-medium text-earth-700">
              Ativo (visível na loja)
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : (editingId ? 'Atualizar produto' : 'Criar produto')}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm()
                setCatalogCreateOpen(false)
              }}
              className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
            >
              Fechar
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 text-xs text-earth-600">
        Exibindo {catalogProducts.length} de {products.length} produtos.
      </div>

      {loading && <p className="mt-4 text-sm text-earth-600">Carregando catálogo...</p>}
      {!loading && catalogProducts.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Nenhum produto encontrado com os filtros atuais.</p>
      )}

      {!loading && catalogProducts.length > 0 && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-earth-200 bg-white">
            <table className="min-w-full divide-y divide-earth-200 text-sm">
              <thead className="bg-earth-100 text-left text-earth-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Contexto</th>
                  <th className="px-3 py-2 font-medium">Publicado na loja</th>
                  <th className="px-3 py-2 font-medium">Preco</th>
                  <th className="px-3 py-2 font-medium">Condicao</th>
                  <th className="px-3 py-2 font-medium">Estoque</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {catalogProducts.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-earth-200" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-earth-900">{p.name || 'Sem nome'}</p>
                          {p.description && (
                            <p className="line-clamp-2 text-xs text-earth-600">{p.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-earth-700">
                      {p.purchase_group_id ? 'Produto de grupo' : 'Produto-base'}
                    </td>
                    <td className="px-3 py-2 text-earth-700">
                      {!p.purchase_group_id && p.store_linked ? 'Sim' : 'Não'}
                    </td>
                    <td className="px-3 py-2 text-earth-700">
                      {formatJPY(getProductBasePriceJpy(p))}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const condition = getProductConditionMeta(p.item_condition)
                        return (
                          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${condition.className}`}>
                            {condition.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2 text-earth-700">
                      {p.stock_quantity != null ? p.stock_quantity : 'Ilimitado'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-earth-500">{p.id}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleEdit(p)
                          setCatalogCreateOpen(true)
                        }}
                        className="mr-3 text-sm font-medium text-earth-600 hover:text-earth-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(p)}
                        disabled={duplicatingId === p.id}
                        className="mr-3 text-sm font-medium text-earth-600 hover:text-earth-900 disabled:opacity-50"
                      >
                        {duplicatingId === p.id ? 'Duplicando...' : 'Duplicar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={productsPage}
            hasMore={productsHasMore}
            loading={loading}
            onPrev={() => setProductsPage((p) => Math.max(0, p - 1))}
            onNext={() => setProductsPage((p) => p + 1)}
          />
        </div>
      )}
    </section>
  )
}
