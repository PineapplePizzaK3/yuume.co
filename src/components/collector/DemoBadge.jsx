export function DemoBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-collector-600 bg-collector-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-collector-700 ${className}`}
    >
      Demo
    </span>
  )
}
