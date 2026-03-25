/**
 * Exibe a lista de produtos do orçamento quando orders.message contém dados estruturados.
 * A descrição do pedido (orderDescription) aparece no topo.
 */
import { parseQuoteMessage } from '../lib/quoteProducts'
import { formatJPY } from '../lib/fx'

export default function QuoteProductsList({ message, quoteCurrency = 'JPY', formatMoney }) {
  const parsed = parseQuoteMessage(message)
  if (!parsed) {
    if (message?.trim()) {
      return <p className="mt-1 text-sm text-earth-500 italic">{message}</p>
    }
    return null
  }

  const { products, orderDescription } = parsed
  if (!products || products.length === 0) {
    if (orderDescription?.trim()) {
      return <p className="mt-1 text-sm text-earth-500 italic">{orderDescription}</p>
    }
    if (message?.trim()) {
      return <p className="mt-1 text-sm text-earth-500 italic">{message}</p>
    }
    return null
  }

  const total = products.reduce((s, p) => {
    const valor = Number(p.valor) || 0
    const qty = Math.max(1, parseInt(p.quantidade, 10) || 1)
    return s + valor * qty
  }, 0)
  const fmt = (v) => (formatMoney ? formatMoney(v, quoteCurrency) : formatJPY(v))

  return (
    <div className="mt-2 rounded-lg border border-earth-200 bg-white p-3">
      {orderDescription?.trim() && (
        <p className="mb-3 border-b border-earth-200 pb-3 text-sm text-earth-600 italic">
          {orderDescription}
        </p>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-600">Itens do orçamento</p>
      <ul className="space-y-2">
        {products.map((p, i) => {
          const valor = Number(p.valor) || 0
          const qty = Math.max(1, parseInt(p.quantidade, 10) || 1)
          const lineTotal = valor * qty
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-earth-800">
                {p.name || `Item ${i + 1}`}
                {qty > 1 && <span className="ml-1 font-normal text-earth-600">× {qty}</span>}
              </span>
              <span className="text-earth-700">{fmt(lineTotal)}</span>
              {p.descricao && (
                <span className="w-full text-xs text-earth-500">{p.descricao}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 border-t border-earth-200 pt-2 text-sm font-semibold text-earth-900">
        Total: {fmt(total)}
      </p>
    </div>
  )
}
