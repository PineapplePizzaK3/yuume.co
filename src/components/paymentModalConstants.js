/**
 * Constantes compartilhadas entre Central de Pagamentos (Cart) e modais de pagamento (ex.: recarga de carteira).
 */
const buildBadgeSrc = (label, { bg = '#ffffff', fg = '#1f2937', stroke = '#d1d5db' } = {}) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="40" viewBox="0 0 112 40">
      <rect x="1" y="1" width="110" height="38" rx="10" fill="${bg}" stroke="${stroke}" />
      <text x="56" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${fg}">
        ${label}
      </text>
    </svg>`
  )}`

const PIX_BADGE_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="40" viewBox="0 0 112 40">
    <rect x="1" y="1" width="110" height="38" rx="10" fill="#f0fdf9" stroke="#9ae6cc" />
    <g transform="translate(14 9)" fill="none" stroke="#00b388" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 0 14 6 8 12 2 6Z" />
      <path d="M20 0 26 6 20 12 14 6Z" />
      <path d="M14 6 20 12 14 18 8 12Z" />
    </g>
    <text x="78" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#047857">PIX</text>
  </svg>`
)}`
const TED_BADGE_SRC = buildBadgeSrc('TED', { bg: '#f8fafc', fg: '#0f172a', stroke: '#cbd5e1' })

export const GATEWAY_OPTIONS_META = [
  { id: 'parcelow', label: 'Parcelow', icon: '🇧🇷' },
  { id: 'stripe', label: 'Stripe', icon: '🌐' },
]

export const PAYMENT_METHODS_BY_GATEWAY = {
  parcelow: [
    { id: 'pix', label: 'PIX', group: 'pix', src: PIX_BADGE_SRC },
    { id: 'ted', label: 'TED', group: 'transfer', src: TED_BADGE_SRC },
    { id: 'visa', label: 'Visa', group: 'card', src: buildBadgeSrc('VISA', { bg: '#e6f0ff', fg: '#1a3fa3', stroke: '#8fb5ff' }) },
    { id: 'mastercard', label: 'Mastercard', group: 'card', src: buildBadgeSrc('MASTERCARD', { bg: '#fff4e6', fg: '#b45309', stroke: '#f7c58a' }) },
    { id: 'elo', label: 'Elo', group: 'card', src: buildBadgeSrc('ELO', { bg: '#faf5ff', fg: '#7c3aed', stroke: '#d8b4fe' }) },
    { id: 'amex', label: 'American Express', group: 'card', src: buildBadgeSrc('AMEX', { bg: '#e0f2fe', fg: '#075985', stroke: '#93c5fd' }) },
    { id: 'hipercard', label: 'Hipercard', group: 'card', src: buildBadgeSrc('HIPERCARD', { bg: '#fff1f2', fg: '#be123c', stroke: '#fda4af' }) },
    { id: 'diners', label: 'Diners Club', group: 'card', src: buildBadgeSrc('DINERS', { bg: '#eff6ff', fg: '#1d4ed8', stroke: '#93c5fd' }) },
    { id: 'discover', label: 'Discover', group: 'card', src: buildBadgeSrc('DISCOVER', { bg: '#fff7ed', fg: '#c2410c', stroke: '#fdba74' }) },
    { id: 'jcb', label: 'JCB', group: 'card', src: buildBadgeSrc('JCB', { bg: '#ecfdf3', fg: '#166534', stroke: '#86efac' }) },
    { id: 'hiper', label: 'Hiper', group: 'card', src: buildBadgeSrc('HIPER', { bg: '#fef3c7', fg: '#92400e', stroke: '#fcd34d' }) },
  ],
  stripe: [
    { id: 'visa', label: 'Visa', group: 'card', src: buildBadgeSrc('VISA', { bg: '#e6f0ff', fg: '#1a3fa3', stroke: '#8fb5ff' }) },
    { id: 'mastercard', label: 'Mastercard', group: 'card', src: buildBadgeSrc('MASTERCARD', { bg: '#fff4e6', fg: '#b45309', stroke: '#f7c58a' }) },
    { id: 'amex', label: 'American Express', group: 'card', src: buildBadgeSrc('AMEX', { bg: '#e0f2fe', fg: '#075985', stroke: '#93c5fd' }) },
    { id: 'discover', label: 'Discover', group: 'card', src: buildBadgeSrc('DISCOVER', { bg: '#fff7ed', fg: '#c2410c', stroke: '#fdba74' }) },
    { id: 'jcb', label: 'JCB', group: 'card', src: buildBadgeSrc('JCB', { bg: '#ecfdf3', fg: '#166534', stroke: '#86efac' }) },
    { id: 'diners', label: 'Diners Club', group: 'card', src: buildBadgeSrc('DINERS', { bg: '#eff6ff', fg: '#1d4ed8', stroke: '#93c5fd' }) },
  ],
}
