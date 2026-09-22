# Live Rips overlay (OBS Browser Source)

Transparent overlay page for stream software (OBS, Streamlabs, etc.). Shows the latest pull reveal, current opening reservation, and recent pulls via Supabase Realtime (with polling fallback).

## URLs

| Locale | Path |
|--------|------|
| pt-BR | `/live-rips/overlay` |
| en | `/en/live-rips/overlay` |

Examples:

- Production: `https://YOUR_DOMAIN/live-rips/overlay`
- Local: `http://localhost:5173/live-rips/overlay`

## Query parameters

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `theme` | `dark` \| `light` | `dark` | Panel contrast for light/dark scene backgrounds |

Examples:

- Dark panels (default): `/live-rips/overlay`
- Light panels: `/live-rips/overlay?theme=light`

## OBS setup

1. Apply migration `142_live_rips_card_pool.sql` in Supabase (creates card pool + seed + enriched public pulls).
2. In OBS: **Sources → Browser** → create a Browser Source.
3. URL: `https://YOUR_DOMAIN/live-rips/overlay` (or with `?theme=light`).
4. Width / Height: e.g. `1280` × `720` (or match canvas).
5. Enable **Shutdown source when not visible** (optional) and leave **Refresh browser when scene becomes active**.
6. CSS custom for OBS (optional, forces full transparency):

```css
body { background-color: rgba(0, 0, 0, 0) !important; margin: 0; overflow: hidden; }
```

The page itself uses `bg-transparent` so the site chrome is already hidden on `/live-rips/*` routes.

## Operator flow

1. Admin → Live Rips → **Catálogo de cartas**: create/edit cards (image URL, rarity, collection).
2. During live → **Operação ao vivo**: select reservation → search/select card → **Salvar pull**.
3. Overlay, `/live-rips/live`, and Minha Rip update from the same `live_rip_pulls` feed.

## Seed

Migration 142 seeds 8 demo cards (`pokemon-sv`, `one-piece-op`) with placeholder images. Replace `image_url` with real art before go-live.
