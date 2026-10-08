import { FlagIcon } from '../FlagIcon'

/** Badge JP sobre imagem de produto (versão japonesa). */
export function LiveRipJpVersionBadge({ size = 22, className = '', title = 'Coleção japonesa' }) {
  return (
    <span
      className={`pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center rounded bg-white/90 p-0.5 shadow-sm ring-1 ring-black/10 ${className}`}
      title={title}
    >
      <FlagIcon code="JP" size={size} title={title} />
    </span>
  )
}
