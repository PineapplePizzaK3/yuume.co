function LiveRipPullReveal({
  pull,
  compact = false,
  emptyLabel = 'Aguardando próximo pull...',
}) {
  if (!pull) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-earth-300 bg-earth-50/80 text-sm text-earth-600 ${compact ? 'h-40' : 'h-64'}`}>
        {emptyLabel}
      </div>
    )
  }

  const title = pull.card_name_en || pull.card_name || pull.name || 'Card'
  const image = pull.image_url || pull.image || ''
  const rarity = pull.rarity || '-'

  return (
    <article className={`overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm ${compact ? '' : ''}`}>
      <div className={`w-full bg-earth-100 ${compact ? 'aspect-[3/4] max-h-52' : 'aspect-[3/4] max-h-80'}`}>
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-earth-500">Sem imagem</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-earth-900">{title}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-earth-600">{rarity}</p>
        {pull.market_value_jpy != null ? (
          <p className="mt-1 text-xs text-earth-500">
            ¥{Number(pull.market_value_jpy || 0).toLocaleString('ja-JP')}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export default LiveRipPullReveal
