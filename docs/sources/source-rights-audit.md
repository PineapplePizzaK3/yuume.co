# Source and Rights Audit (Step 0)

Status: DRAFT, pending owner sign-off. Last research pass: 2026-09-27.

This document is the source of truth for the seed values of the `market_sources` registry (Step 2).
It is not legal advice. Every row marked "needs review" must be confirmed by the owner (and counsel where available)
before its `review_status` is set to `cleared` in the database.

## Capability vocabulary

| Capability | Meaning |
|---|---|
| search | YuumeCo servers query the source automatically for a user or a job |
| display | Show price / title / images obtained from the source inside YuumeCo |
| cache | Store results (aggregate snapshot) and for how long |
| link | Show an outbound link or a pre-filled search URL the user opens themselves |
| purchase / sourcing | Staff buy on the user's behalf (personal shopping / forwarding) |
| automate | Scheduled jobs (snapshot refresh, catalog builds) |

Source types: `api`, `partner`, `affiliate`, `own_data`, `permitted_automation`, `manual_sourcing`,
`link_out_only`, `prohibited_automation`.

## Per-source matrix

| Source | Type (proposed) | search | display | cache | link | purchase / sourcing | automate | Evidence |
|---|---|---|---|---|---|---|---|---|
| YuumeCo own stock (`products`) | own_data | yes | yes | yes | yes | yes | yes | First-party data |
| Yahoo! Shopping | api | yes, Item Search v3 with app ID | yes, with required credit display | short, respect guideline | yes | yes | yes, within 30 req/min per app ID | [Item Search v3](https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html), guideline + credit display pages. Needs review (D1). Honor `is_cross_border_agency` (D8). |
| Rakuten Ichiba | api | yes, Ichiba Item Search API | yes, per Rakuten rules | per Rakuten refresh rules | yes | yes | yes, within limits | [Item Search API](https://webservice.rakuten.co.jp/documentation/ichiba-item-search), data-use FAQ. Needs review (D1). Excludes C2C (Rakuma not covered). |
| Amazon.co.jp | api (future) / link_out_only (now) | only via Creators API after Associates eligibility | only via API | per API terms | yes | yes | only via API | PA-API 5 retired 2026; Creators API needs qualifying sales (D2). Current HTML scraping is not covered by any API license. |
| Mercari | link_out_only + manual_sourcing | no | no | no | yes | yes (staff buy) | no | Seller terms Art. 13-6: no access by means other than those provided, no commercial use outside the service without written permission. No public C2C API. Pursue partner program. |
| Yahoo Auctions | link_out_only + manual_sourcing | no | no | no | yes | yes | no | Auction Web API closed 2020. No permitted automation found. |
| Yahoo Flea Market (PayPay) | link_out_only + manual_sourcing | no | no | no | yes | yes | no | No public API found. |
| Rakuma | link_out_only + manual_sourcing | no | no | no | yes | yes | no | Not covered by Rakuten Ichiba API. |
| SNKRDUNK | prohibited_automation | no | no | no | yes | yes (staff buy) | no | [Terms Art. 7-13](https://snkrdunk.com/terms): crawling/scraping explicitly prohibited. |
| Surugaya | affiliate | no | no | no | yes (affiliate tags) | yes | no | [Affiliate program](https://affiliate.suruga-ya.jp/); no public feed/API found. |
| Cardrush and other card shops | link_out_only + manual_sourcing | no (until written permission) | no | no | yes | yes | no | No API found. Upgrade to `permitted_automation` / `partner` only with written permission. |
| Physical stores | manual_sourcing | no | no | no | no | yes | no | Staff visit. |

## Catalog / card data sources

| Source | Use | Rights position |
|---|---|---|
| Official Pokemon Card Game site (expansion pages, Card Search) | Reference for human verification only (manifest facts: totals, number ranges, rarity counts, reference URL) | [Site policy](https://www.pokemon-card.com/policy.html): content licensed for personal enjoyment only; copying/reproduction/redistribution prohibited. Never crawl; never copy text or images. |
| TCGdex (cards-database) | Structured import of card facts (Japanese) | MIT license for the database. Card artwork remains The Pokemon Company's copyright; images are NOT imported. Coverage per set must be confirmed (D5). |
| Japanese card-list publications | Tie-breaker only, consulted by a human | Never imported. |
| SNKRDUNK-derived static datasets | Must NOT feed catalog, collection, or recommendations | Obtained by scraping a source that prohibits it (see legacy dependents). |

Card images (D3): MVP catalog is text-only. Allowed later: YuumeCo's own photos of physically held cards, or images with confirmed licensing. `catalog_items.image_provenance` records which.

## Legacy features that depend on uncleared automation (do not delete; decide under D4)

| Legacy feature | Entry points | Sources hit | Method today |
|---|---|---|---|
| Public catalog search | `src/pages/CatalogSearchPublic.jsx` (`/busca-catalogo`, `/en/catalog-search`), `src/pages/collector/JapanSearchPage.jsx` (`/japan-search`) via `src/services/catalogSearchService.js` to edge `catalog-search` | amazon, rakuma, mercari, yahoo (auctions), yahoo_flea, snkrdunk | HTML scraping (`adapters/*.ts`), r.jina.ai proxy fallback (`adapters/common.ts`), Mercari private app API with self-signed DPoP tokens (`adapters/mercariApi.ts`) |
| Admin catalog search + gallery | `searchCatalogAdmin` in `catalogSearchService.js`; `action: 'gallery'` in `catalog-search/index.ts` (`productGallery.ts`) | same as above | same as above |
| URL product scrape | edge `scrape-product` via `src/services/wishlistLinkService.js` (Lounge URL wishlist, `ListaDesejos.jsx`) and `src/pages/platform/AssistedRedirectBudgetSection.jsx` (assisted forwarding budget) | any pasted URL (Mercari, Rakuma, Yahoo, Amazon, SNKRDUNK...) | Direct fetch + r.jina.ai fallback |
| On-demand SNKRDUNK catalog | `.github/workflows/refresh-on-demand-snkrdunk-catalog.yml` -> `scripts/on-demand/update-snkrdunk-catalog.mjs` -> `src/data/onDemandSnkrdunkCatalog.js`, `src/data/liveRipsSnkrdunkCatalog.js` (store SNKRDUNK tab, ephemeral products, `onDemandCatalog.js`, Live Rips) | snkrdunk | Scheduled scraping (runs from `main`) |
| Collection top cards | `scripts/on-demand/build-collection-top-cards.mjs` -> `src/data/collectionTopCards.js` (`collectorService.getCollectionTopCards`, `AberturasSection`, `liveRipsMock`) | snkrdunk | Manual script run. An UNCOMMITTED workflow change would add it to the schedule; intentionally left uncommitted pending D4. |
| Scrape quality report | `scripts/scrape-quality-report.mjs` | multiple | Manual script |

Policy until D4 is decided: these keep working unchanged ("legacy exception"), are recorded in the registry with
`legacy_search_allowed` / `legacy_automation_allowed = true`, and can be switched off from the database without a deploy.
No new Collector Platform feature may call them.

## Owner decisions

| ID | Decision | Blocks |
|---|---|---|
| D1 | Clear Yahoo! Shopping and Rakuten API use (commercial use, credit display, caching) | Steps 8/10 API adapters |
| D2 | Amazon Creators API eligibility | Amazon API adapter |
| D3 | Card image policy (none / own photos / license) | Catalog images (Step 3 ships text-only) |
| D4 | Future of legacy scraping features listed above | Step 12 only |
| D5 | TCGdex Japanese coverage for M2a, SV2a, SV8a, M6 (else manual CSV entry) | Step 3 imports. Checked 2026-09-27: numbers and Japanese names complete for all four (SV2a 210, SV8a 237, M2a 250, M6 113). Rarity is unreliable (SV8a mostly "None", M6 secrets all "Mega Hyper Rare"), so it is stored only as `attributes.tcgdex_rarity`; `catalog_items.rarity` comes from the official page via CSV. |
| D6 | Checklist scope: base numbers only, variants excluded from completion | Step 3/5 |
| D7 | Set-verification reviewer(s) and 14-day post-release grace rule | Step 3 VERIFIED transition |
| D8 | Policy for sellers who exclude proxy buyers (`is_cross_border_agency`) | Step 8 Yahoo adapter |

## Sign-off

| Role | Name | Date |
|---|---|---|
| Owner | | |
| Legal review (optional) | | |
