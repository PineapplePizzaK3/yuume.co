/**
 * Exibe os três eixos de preço: BRL (destaque), JPY (base) e USD (cobrança).
 * Bandeiras ajudam a escanear visualmente sem misturar moedas.
 */
import { formatBRL, formatJPY, formatUSD } from '../lib/fx'

const FLAG_BR = '🇧🇷'
const FLAG_US = '🇺🇸'
const FLAG_JP = '🇯🇵'

function isPos(n) {
  return Number.isFinite(n) && n > 0
}

export function TriCurrencyDisplay({
  brl,
  jpy,
  usd,
  variant = 'card',
  className = '',
  /** Texto curto abaixo da linha secundária (ex.: cupom aplicado) */
  footnote = null,
}) {
  const brlCls =
    variant === 'modal'
      ? 'text-2xl sm:text-3xl'
      : variant === 'checkout'
        ? 'text-xl sm:text-2xl'
        : variant === 'compact'
          ? 'text-sm'
          : 'text-lg'
  const secondaryCls =
    variant === 'compact' ? 'text-xs text-earth-700' : 'text-sm text-earth-700'

  const showBrl = isPos(brl)
  const showJpy = isPos(jpy)
  const showUsd = isPos(usd)

  return (
    <div
      className={`space-y-1.5 ${className}`}
      role="group"
      aria-label="Preços: real (referência), iene (base Japão), dólar (cobrança)"
    >
      <div
        className={`flex items-center gap-2 font-bold text-earth-900 ${brlCls}`}
        title="Valor em real (referência para você)"
      >
        <span className="select-none shrink-0 text-[1.15em] leading-none" aria-hidden>
          {FLAG_BR}
        </span>
        <span className="tabular-nums">{showBrl ? formatBRL(brl) : '—'}</span>
        <span className="sr-only">Real</span>
      </div>
      <div className={`flex flex-wrap items-baseline gap-x-5 gap-y-1 ${secondaryCls}`}>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title="Preço base no Japão (iene)"
        >
          <span className="select-none shrink-0 text-[1.05em] leading-none" aria-hidden>
            {FLAG_JP}
          </span>
          <span>{showJpy ? formatJPY(jpy) : '—'}</span>
          <span className="sr-only">Iene</span>
        </span>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title="Valor de cobrança internacional (dólar)"
        >
          <span className="select-none shrink-0 text-[1.05em] leading-none" aria-hidden>
            {FLAG_US}
          </span>
          <span>{showUsd ? formatUSD(usd) : '—'}</span>
          <span className="sr-only">Dólar</span>
        </span>
      </div>
      {footnote ? <p className="text-xs text-earth-500">{footnote}</p> : null}
    </div>
  )
}
