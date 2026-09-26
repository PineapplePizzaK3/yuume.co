# Route Boundary Map (Transition)

This file maps the current route ownership during the split between Services and Openings.

The target architecture is collector-first (see `docs/architecture/collector-platform.md`): the "Openings"
app becomes the Collector app, and Openings becomes one acquisition module inside it. New collector routes
(`/item`, `/explorar`, `/desejos`, and their `/en` equivalents) will be registered in the Openings app until
that rename happens.

## Openings Domain

- `"/"` (transition alias, points to collector home)
- `"/en"` (transition alias, points to collector home)
- `"/rips"`, `"/rips/:ripId"`
- `"/batches"`, `"/batches/:batchId"`
- `"/lives"`, `"/lives/:liveId"`
- `"/openings"`, `"/openings/:openingId"`
- `"/colecao"`, `"/colecao/rips/:ripId"`, `"/colecao/batches/:ripId"`, `"/colecao/cartas/:assetId"`
- `"/item/:itemId"`
- `"/japan-search"`
- `"/en/rips"`, `"/en/rips/:ripId"`
- `"/en/batches"`, `"/en/batches/:batchId"`
- `"/en/lives"`, `"/en/lives/:liveId"`
- `"/en/openings"`, `"/en/openings/:openingId"`
- `"/en/collection"`, `"/en/collection/rips/:ripId"`, `"/en/collection/batches/:ripId"`, `"/en/collection/cards/:assetId"`
- `"/en/item/:itemId"`
- `"/en/japan-search"`

## Services Domain

- `"/redirecionamento"`, `"/en/forwarding"`
- `"/servicos-e-precos/*"`, `"/en/services-pricing/*"`
- `"/faq/*"`, `"/en/help/*"`
- `"/legal/*"`, `"/en/legal/*"`
- `"/onde-comprar"`, `"/en/where-to-buy"`
- `"/busca-catalogo"`, `"/en/catalog-search"`
- `"/contact"`, `"/en/contact"`
- `"/loja/*"`, `"/en/store/*"`
- `"/login"`, `"/register"`, `"/forgot-password"`, `"/reset-password"`
- `"/en/login"`, `"/en/register"`, `"/en/forgot-password"`, `"/en/reset-password"`
- `"/app/*"`, `"/en/app/*"`
- `"/live-rips/*"`, `"/en/live-rips/*"`
- `"/produto-temporario/*"`, `"/en/instant-product/*"`

## Platform Domain (inside Services app)

- `"/app/*"` and `"/en/app/*"` remain in Services app for now.
- This includes dashboard, lounge, store, cart, invoices, affiliate, and admin tabs.

