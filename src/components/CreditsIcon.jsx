/**
 * Ícone da moeda interna da plataforma (créditos YuumeCo).
 * 1 crédito = ¥1.
 */
export function CreditsIcon({ size = 18, className = '', title }) {
  const label = title || 'Créditos YuumeCo'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <circle cx="12" cy="12" r="11" fill="#A72B3D" />
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="#FBEAED" strokeWidth="1.4" />
      <path
        d="M9.1 15.4V8.6h3.05c1.55 0 2.55.88 2.55 2.2 0 .92-.5 1.62-1.32 1.95L15.1 15.4h-1.85l-1.55-2.35H10.7V15.4H9.1zm1.6-3.7h1.35c.72 0 1.15-.38 1.15-.95s-.43-.95-1.15-.95H10.7v1.9z"
        fill="#FCF9F5"
      />
    </svg>
  )
}
