/** Ícone de buyback: carta que volta (revenda). */
export function BuybackIcon({ className = '', title }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-full w-full ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect x="20" y="12" width="24" height="34" rx="3.5" {...stroke} />
      <path d="M26 22h12M26 28h8" {...stroke} />
      <path d="M10 28c2-12 14-18 24-18" {...stroke} />
      <path d="M10 18v11h11" {...stroke} />
      <path d="M54 36c-2 12-14 18-24 18" {...stroke} />
      <path d="M54 46V35H43" {...stroke} />
    </svg>
  )
}
