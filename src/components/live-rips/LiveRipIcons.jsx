const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconShell({ children, className = '', title }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`h-full w-full text-earth-800 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/** Caixa na frente + packs atrás (hero). */
export function LiveRipHeroIcon({ className = '', title = 'Booster box and packs' }) {
  return (
    <IconShell className={className} title={title}>
      {/* packs atrás */}
      <rect x="10" y="14" width="14" height="22" rx="2" {...stroke} opacity="0.45" />
      <rect x="18" y="10" width="14" height="22" rx="2" {...stroke} opacity="0.6" />
      <rect x="40" y="10" width="14" height="22" rx="2" {...stroke} opacity="0.6" />
      <rect x="48" y="14" width="14" height="22" rx="2" {...stroke} opacity="0.45" />
      {/* box na frente */}
      <rect x="18" y="24" width="28" height="28" rx="3" {...stroke} />
      <path d="M18 32h28" {...stroke} />
      <path d="M32 24v28" {...stroke} opacity="0.35" />
      <circle cx="32" cy="40" r="4" {...stroke} />
    </IconShell>
  )
}

/** Passo 1 — escolher / reservar */
export function LiveRipStepReserveIcon({ className = '' }) {
  return (
    <IconShell className={className}>
      <rect x="14" y="12" width="28" height="36" rx="3" {...stroke} />
      <path d="M14 22h28" {...stroke} />
      <circle cx="44" cy="44" r="10" {...stroke} />
      <path d="M44 39v10M39 44h10" {...stroke} />
    </IconShell>
  )
}

/** Passo 2 — separar / preparar */
export function LiveRipStepPrepareIcon({ className = '' }) {
  return (
    <IconShell className={className}>
      <rect x="12" y="18" width="32" height="28" rx="3" {...stroke} />
      <path d="M12 28h32" {...stroke} />
      <path d="M40 14l8 6v12l-8 6" {...stroke} />
      <path d="M28 34h8M28 40h12" {...stroke} opacity="0.7" />
    </IconShell>
  )
}

/** Passo 3 — abertura ao vivo */
export function LiveRipStepLiveIcon({ className = '' }) {
  return (
    <IconShell className={className}>
      <rect x="10" y="20" width="28" height="20" rx="2.5" {...stroke} />
      <path d="M10 28h28" {...stroke} opacity="0.4" />
      <path d="M24 20v20" {...stroke} opacity="0.35" />
      <circle cx="46" cy="28" r="8" {...stroke} />
      <circle cx="46" cy="28" r="3" fill="currentColor" stroke="none" />
      <path d="M18 46h20" {...stroke} />
    </IconShell>
  )
}

/** Passo 4 — pulls registrados */
export function LiveRipStepLoggedIcon({ className = '' }) {
  return (
    <IconShell className={className}>
      <rect x="8" y="16" width="18" height="28" rx="2" {...stroke} opacity="0.55" />
      <rect x="18" y="12" width="18" height="28" rx="2" {...stroke} opacity="0.75" />
      <rect x="28" y="16" width="18" height="28" rx="2" {...stroke} />
      <path d="M48 36l4 4 8-10" {...stroke} />
    </IconShell>
  )
}

export const LIVE_RIP_HOW_IT_WORKS_ICONS = {
  step1: LiveRipStepReserveIcon,
  step2: LiveRipStepPrepareIcon,
  step3: LiveRipStepLiveIcon,
  step4: LiveRipStepLoggedIcon,
}
