/**
 * Imports a Japanese set checklist from TCGdex (MIT-licensed data) into catalog_sets / catalog_items.
 *
 *   node --env-file=.env scripts/catalog/import-tcgdex-set.mjs m2a [sv2a ...] [--dry-run] [--prune] [--sync-manifest]
 *
 * - Creates the set from its manifest when missing. An existing set's manifest is NOT overwritten (admins may have
 *   edited it) unless --sync-manifest is passed.
 * - Never imports images or prices. TCGdex rarity is kept only as attributes.tcgdex_rarity because its Japanese
 *   rarity data is incomplete; catalog_items.rarity is filled from the official page via CSV/admin.
 */
import { normalizeCardNumber } from '../../src/lib/catalog/validateChecklist.js'
import { createServiceClient, fetchSetByCode, parseArgs, readManifest } from './lib.mjs'

const TCGDEX_API = 'https://api.tcgdex.net/v2/ja'
const CONCURRENCY = 6

async function fetchJson(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)))
    }
  }
  throw new Error(`Falha ao buscar ${url}: ${lastError?.message || lastError}`)
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next
        next += 1
        results[index] = await fn(items[index], index)
      }
    }),
  )
  return results
}

function toCatalogItem(card, fetchedAt) {
  const number = normalizeCardNumber(card.localId)
  const variants = card.variants && typeof card.variants === 'object' ? card.variants : {}
  const attributes = {
    category: card.category ?? null,
    stage: card.stage ?? null,
    dex_ids: Array.isArray(card.dexId) ? card.dexId : [],
    tcgdex_rarity: card.rarity && card.rarity !== 'None' ? card.rarity : null,
    tcgdex_variants: {
      normal: Boolean(variants.normal),
      reverse: Boolean(variants.reverse),
      holo: Boolean(variants.holo),
    },
  }
  return {
    number,
    name_ja: card.name ?? null,
    attributes,
    external_refs: { tcgdex: card.id },
    provenance: { license: 'MIT', api: TCGDEX_API, card_id: card.id, fetched_at: fetchedAt },
  }
}

async function importOne(client, manifestRef, flags) {
  const manifest = await readManifest(manifestRef)
  const tcgdexId = manifest.import?.ref || manifest.set_code
  const franchise = manifest.franchise || 'pokemon_tcg'
  console.log(`\n== ${manifest.set_code} (TCGdex ${tcgdexId}) ==`)

  const tcgSet = await fetchJson(`${TCGDEX_API}/sets/${encodeURIComponent(tcgdexId)}`)
  if (!tcgSet) throw new Error(`Set ${tcgdexId} não existe no TCGdex (ja). Use importação CSV manual.`)
  const cardRefs = Array.isArray(tcgSet.cards) ? tcgSet.cards : []
  console.log(`TCGdex: ${cardRefs.length} cartas listadas (official=${tcgSet.cardCount?.official}, total=${tcgSet.cardCount?.total})`)

  const fetchedAt = new Date().toISOString()
  const cards = await mapPool(cardRefs, CONCURRENCY, (ref) => fetchJson(`${TCGDEX_API}/cards/${encodeURIComponent(ref.id)}`))
  const missing = cardRefs.filter((_, i) => !cards[i]).map((ref) => ref.id)
  if (missing.length) throw new Error(`Cartas não encontradas no TCGdex: ${missing.join(', ')}`)

  const items = cards.map((card) => toCatalogItem(card, fetchedAt))
  const numbers = new Set()
  for (const item of items) {
    if (!item.number) throw new Error(`Carta sem número: ${item.external_refs.tcgdex}`)
    if (numbers.has(item.number)) throw new Error(`Número duplicado no TCGdex: ${item.number}`)
    numbers.add(item.number)
  }
  const withTcgdexRarity = items.filter((item) => item.attributes.tcgdex_rarity).length
  console.log(`Itens preparados: ${items.length} (com raridade TCGdex: ${withTcgdexRarity}; coluna rarity fica vazia)`)

  if (flags.has('dry-run')) {
    console.log('Dry run: nada gravado. Exemplo:', JSON.stringify(items[items.length - 1]))
    return
  }

  let set = await fetchSetByCode(client, franchise, manifest.set_code)
  if (!set || flags.has('sync-manifest')) {
    const payload = {
      ...(set ? { id: set.id } : {}),
      franchise,
      set_code: manifest.set_code,
      name_ja: manifest.name_ja || tcgSet.name || null,
      name_en: manifest.name_en || null,
      release_date: manifest.release_date || tcgSet.releaseDate || null,
      set_kind: manifest.set_kind || 'main',
      official_reference_url: manifest.official_reference_url || null,
      official_manifest: manifest.official_manifest || {},
      checklist_scope: manifest.checklist_scope || { mode: 'all_numbers', exclude_variants: true },
      import_source: 'tcgdex',
      import_ref: tcgdexId,
    }
    const existed = Boolean(set)
    const { data, error } = await client.rpc('service_catalog_upsert_manifest', { p_payload: payload })
    if (error) throw new Error(`Erro ao gravar set: ${error.message}`)
    set = data
    console.log(`Set ${existed ? 'atualizado' : 'criado'}: ${set.id} (status ${set.status})`)
  } else {
    console.log(`Set existente ${set.id} (status ${set.status}); manifesto preservado.`)
  }

  const { data: result, error } = await client.rpc('service_catalog_import_items', {
    p_set_id: set.id,
    p_items: items,
    p_source: 'tcgdex',
    p_import_ref: tcgdexId,
    p_prune: flags.has('prune'),
  })
  if (error) throw new Error(`Erro ao importar itens: ${error.message}`)
  console.log(`Importação: ${JSON.stringify(result)}`)
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))
  if (!positional.length) {
    console.error('Uso: import-tcgdex-set.mjs <manifesto|set_code> [...] [--dry-run] [--prune] [--sync-manifest]')
    process.exit(1)
  }
  const client = flags.has('dry-run') ? null : createServiceClient()
  for (const ref of positional) {
    await importOne(client, ref, flags)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
