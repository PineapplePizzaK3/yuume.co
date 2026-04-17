# Scrape Headless Strategy (Feature Flag)

This project now supports an optional headless fallback strategy for JS-heavy pages in the `scrape-product` edge function.

## Flags

- `SCRAPE_ENABLE_HEADLESS=1` (or `true`)
- `SCRAPE_HEADLESS_ENDPOINT=https://<your-service>/scrape`

When disabled, the scraper returns a warning indicating that headless fallback is off.  
When enabled, headless is called only after generic extraction + adapters + Jina fallback still produce low confidence.

## Expected endpoint contract

`POST` JSON body:

```json
{ "url": "https://example.com/product/123" }
```

Response JSON (best-effort):

```json
{
  "name": "Product name",
  "price": 123.45,
  "currency": "JPY",
  "imageUrl": "https://..."
}
```

## Why this is optional

- Headless adds runtime cost and operational complexity.
- Many pages are already covered by metadata/JSON-LD/adapters.
- Keeping it behind a flag allows gradual rollout per environment/domain.

