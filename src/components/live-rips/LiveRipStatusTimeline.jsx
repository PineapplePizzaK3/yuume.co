export function LiveRipStatusTimeline({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            item.done
              ? 'border-earth-200 bg-earth-50 text-earth-900'
              : 'border-earth-200 bg-white text-earth-600'
          }`}
        >
          <span
            aria-hidden
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              item.done ? 'bg-earth-900 text-earth-50' : 'bg-earth-200 text-earth-700'
            }`}
          >
            {item.done ? '✓' : '○'}
          </span>
          <span className={item.done ? 'font-medium' : ''}>{item.label}</span>
        </li>
      ))}
    </ol>
  )
}
