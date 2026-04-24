export default function ProductScrapeBlock({
  sourceUrl,
  setSourceUrl,
  onScrape,
  scraping = false,
  scrapeMeta = null,
  scrapePreview = null,
  onApplyPreview,
  onDiscardPreview,
  feedback = '',
  placeholder = 'URL do produto para preencher dados automaticamente',
  disabled = false,
  previewText = 'Há dados no formulário. Deseja aplicar os dados encontrados?',
  showWarnings = false,
}) {
  if (disabled) return null

  return (
    <>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onScrape()
            }
          }}
          placeholder={placeholder}
          className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
        />
        <button
          type="button"
          onClick={() => void onScrape()}
          disabled={scraping || !String(sourceUrl || '').trim()}
          className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
        >
          {scraping ? 'Buscando...' : 'Buscar dados'}
        </button>
      </div>

      {scrapeMeta && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">
            Scrape: {Math.round((Number(scrapeMeta.confidence) || 0) * 100)}% de confiança
            {scrapeMeta.source ? ` • origem: ${scrapeMeta.source}` : ''}
          </p>
          {showWarnings && Array.isArray(scrapeMeta.warnings) && scrapeMeta.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {scrapeMeta.warnings.slice(0, 3).map((warn, idx) => (
                <li key={`${warn}-${idx}`}>{warn}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {scrapePreview && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="font-medium">{previewText}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApplyPreview}
              className="rounded-md border border-blue-300 bg-white px-2.5 py-1.5 font-medium text-blue-800 hover:bg-blue-100"
            >
              Aplicar dados
            </button>
            <button
              type="button"
              onClick={onDiscardPreview}
              className="rounded-md border border-blue-200 bg-blue-100 px-2.5 py-1.5 font-medium text-blue-800 hover:bg-blue-200"
            >
              Manter meus dados
            </button>
          </div>
        </div>
      )}

      {feedback && <p className="text-xs text-earth-600">{feedback}</p>}
    </>
  )
}
