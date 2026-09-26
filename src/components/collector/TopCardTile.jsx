import { CreditsAmount } from '../CreditsAmount'

export function TopCardTile({ card, locale = 'pt-BR', t }) {
  const cardName = locale === 'en' ? card?.nameEn || card?.name : card?.name || card?.nameEn
  const rarity = String(card?.rarity || '').trim()
  const cardNumber = String(card?.cardNumber || '').trim()
  const imageUrl = String(card?.imageUrl || '').trim()
  const cardUrl = String(card?.url || '').trim()
  const content = (
    <article className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50">
      <div className="aspect-[3/4] w-full bg-white">
        {imageUrl ? (
          <img src={imageUrl} alt={cardName || 'Top card'} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-earth-500">
            {t('collector.topCards.imageUnavailable', { defaultValue: 'Imagem indisponivel' })}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-medium text-earth-900">{cardName || '-'}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {rarity ? (
            <span className="rounded-full bg-earth-200 px-2 py-0.5 text-[11px] font-semibold uppercase text-earth-700">
              {rarity}
            </span>
          ) : null}
          {cardNumber ? (
            <span className="text-[11px] text-earth-600">
              {t('collector.topCards.cardNumber', { defaultValue: 'Carta' })}: {cardNumber}
            </span>
          ) : null}
        </div>
        <CreditsAmount amount={card?.priceJpy || 0} variant="compact" showFiat />
      </div>
    </article>
  )

  if (!cardUrl) return content
  return (
    <a href={cardUrl} target="_blank" rel="noreferrer" className="block transition hover:opacity-95">
      {content}
    </a>
  )
}
