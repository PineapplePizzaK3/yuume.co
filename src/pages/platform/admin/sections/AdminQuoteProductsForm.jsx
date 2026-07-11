import { TriCurrencyDisplay } from '../../../../components/TriCurrencyDisplay'
import { jpyAmountToTri } from '../../../../lib/quoteMoneyTri'

export const EMPTY_QUOTE_PRODUCT = { name: '', valor: '', quantidade: 1, descricao: '', link: '' }

export default function AdminQuoteProductsForm({
  orderDescription,
  onOrderDescriptionChange,
  products,
  onProductsChange,
  descriptionPlaceholder = 'Mensagem/pedido do cliente...',
  showLink = false,
  onScrapeProduct = null,
  scrapingProductIndex = null,
  scrapeFeedbackByIndex = {},
}) {
  const updateProduct = (idx, patch) => {
    onProductsChange(products.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  return (
    <div className="space-y-4">
      <textarea
        value={orderDescription}
        onChange={(e) => onOrderDescriptionChange(e.target.value)}
        rows={2}
        placeholder={descriptionPlaceholder}
        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
      />
      {products.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-earth-200 bg-earth-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-earth-700">Produto {idx + 1}</span>
            {products.length > 1 && (
              <button
                type="button"
                onClick={() => onProductsChange(products.filter((_, i) => i !== idx))}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remover
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateProduct(idx, { name: e.target.value })}
              placeholder="Nome"
              className="sm:col-span-2 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
            {showLink && (
              <div className="sm:col-span-2 space-y-1">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={item.link ?? ''}
                    onChange={(e) => updateProduct(idx, { link: e.target.value })}
                    placeholder="Link do produto"
                    className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                  />
                  {onScrapeProduct && (
                    <button
                      type="button"
                      onClick={() => onScrapeProduct(idx)}
                      disabled={scrapingProductIndex === idx || !String(item.link || '').trim()}
                      className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                    >
                      {scrapingProductIndex === idx ? 'Buscando...' : 'Buscar dados'}
                    </button>
                  )}
                </div>
                {scrapeFeedbackByIndex[idx] && (
                  <p className="text-xs text-earth-500">{scrapeFeedbackByIndex[idx]}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.valor}
                onChange={(e) => updateProduct(idx, { valor: e.target.value })}
                placeholder="Valor (¥)"
                className="w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              {(() => {
                const unit = parseFloat(item.valor)
                if (!Number.isFinite(unit) || unit <= 0) return null
                const qty = Math.max(1, parseInt(item.quantidade, 10) || 1)
                const lineTotal = unit * qty
                const tri = jpyAmountToTri(lineTotal)
                if (!tri) return null
                return (
                  <div className="space-y-0.5">
                    {qty > 1 && (
                      <p className="text-xs text-earth-500">
                        Subtotal ({qty}×): ¥{lineTotal.toLocaleString('pt-BR')}
                      </p>
                    )}
                    <TriCurrencyDisplay
                      brl={tri.brl}
                      jpy={tri.jpy}
                      usd={tri.usd}
                      variant="compact"
                      primary="jpy"
                    />
                  </div>
                )
              })()}
            </div>
            <input
              type="number"
              min="1"
              value={item.quantidade ?? 1}
              onChange={(e) => updateProduct(idx, { quantidade: e.target.value })}
              placeholder="Qtd"
              className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onProductsChange([...products, { ...EMPTY_QUOTE_PRODUCT }])}
        className="w-full rounded-lg border-2 border-dashed border-earth-300 py-2 text-sm font-medium text-earth-600 hover:border-earth-400 hover:bg-earth-50"
      >
        + Adicionar produto
      </button>
    </div>
  )
}
