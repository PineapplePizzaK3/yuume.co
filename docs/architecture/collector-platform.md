# YuumeCo Collector Platform Architecture

Status: frozen for implementation (2026-09-27). Changes require an explicit product decision.

## Hero product

"A collector's collection connected to the Japanese market."

## Core loop

Collection -> Missing / Wanted -> Find in Japan -> Acquire -> Hold in Japan -> Consolidate / Ship
-> Collection updated (user choice) -> Discover what is missing next.

Every MVP feature must strengthen one step of this loop. Openings, Live Rips, Virtual Packs, Store and
Group Buy are acquisition modules; the core must keep working if any of them is switched off.

## Domain rules

- `catalog_sets` -> `catalog_items`: the collectible master, independent of commerce. `kind` + `attributes`
  keep it open to other franchises and collectible types.
- Set status: PENDING -> IMPORTED -> VALIDATING -> VERIFIED. Only VERIFIED sets power completion %, missing
  items, "Finish your set" and set-based recommendation signals. Structural edits demote a VERIFIED set.
- `tracked_sets` define where "missing" applies. Missing = verified checklist minus owned; never stored.
- `collection_items` exist only when the user chooses to track something. Acquisitions (orders) and holdings
  (`user_inventory`) never create collection rows automatically.
- `wishlist_items` hold explicit catalog wants with target prices. Legacy URL wants stay in `wishlist_links`.
- Acquisition = existing `orders` / `order_items` (optionally linked to a catalog / wishlist item).
- Holding = existing `user_inventory` row (physical item in Japan), shipped via `shipments`.
- `market_snapshots` store per (item, source) aggregates with provenance. No listings, no price history.

## Data provenance rules

- Every market source has a row in `market_sources` describing what YuumeCo may search, display, cache,
  link, purchase/source and automate. See `docs/sources/source-rights-audit.md`.
- Every automated adapter checks `market_sources` before running. Collector contexts fail closed.
  Legacy contexts keep today's behavior until owner decision D4.
- Snapshots can only be written for sources allowed to be snapshotted; expired or disallowed snapshots are
  never shown and never produce opportunities.
- Official Pokemon Card Game pages are a human verification reference only; never crawled or copied.
- No card images without established rights (`image_provenance`).

## Recommendation V1

Deterministic rules only (no ML, LLM, embeddings, collaborative filtering, behavioral ranking, stored
recommendations or visible score). Types: `wishlist_found`, `complete_set`, `opportunity`, `related`.
Every result carries reason codes. Built only after the collector data is proven end-to-end.

## Execution order

0. Source/rights audit
1. Baseline
2. Source registry + adapter gating
3. Verified catalog
4. Collection
5. Tracked sets / missing
6. Home (flag `collector_home_v2_enabled`)
7. Wishlist
8. Contextual Japan Market (flag `collector_market_enabled`)
9. Orders / Holdings links
10. Market snapshots
11. Recommendation V1 (flag `collector_recommendations_enabled`)
12. Secondary modules and legacy decisions (each approved separately)

## Safe-execution protocol

- Inspect the live schema and callers before every migration; migrations are additive, numbered from 151,
  and end with a rollback note.
- Never change the signature or body of an existing forwarding / store / wallet RPC; add new RPCs instead.
- User-visible changes go behind `system_settings` flags.
- No legacy path is deleted before its replacement is proven.
- Migrations on this project are applied manually (remote migration history is empty). Before applying any
  new migration, verify prerequisite objects exist remotely.

## Known baseline issues (2026-09-27)

- Remote database has objects from migrations 147, 149 and 150, but NOT the columns from 148
  (`pack_allocations.price_jpy`, `payment_status`, `payment_provider`, `payment_reference`). Openings wallet
  reservation depends on them. Needs an owner decision before applying 148.
