/**
 * Gera SQL idempotente do Box Break live:
 * - upsert de um produto por coleção (caixa com shrink, quando existe)
 * - uma opening_batches OPEN por produto, só se ainda não houver caixa ativa
 *
 * Uso: node scripts/catalog/seed-live-box-breaks.mjs --out <arquivo.sql>
 * Não apaga reservas, cartas nem caixas já vendidas.
 */
import { writeFileSync } from 'node:fs'
import { register } from 'node:module'

register('./resolve-js-extension.mjs', import.meta.url)

const { getGroupedLiveRipCatalogProducts, packsPerBoxForLiveRipProduct } = await import('../../src/data/collectorLiveRipCatalog.js')
const { LIVE_RIPS_PRODUCT_CATEGORIES } = await import('../../src/data/liveRipsMock.js')

const ACTIVE_STATUSES = ['OPEN', 'FULL', 'LOCKED', 'SCHEDULED', 'OPENING']

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : ''
}

function sqlText(value) {
  if (value == null || value === '') return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNum(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  const factor = 10 ** digits
  return String(Math.round(n * factor) / factor)
}

function asText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  return String(value['pt-BR'] || value.en || '').trim()
}

const categories = new Map(
  LIVE_RIPS_PRODUCT_CATEGORIES.map((category) => [category.id, category.label || {}])
)

const products = getGroupedLiveRipCatalogProducts().map((product) => {
  const packs = packsPerBoxForLiveRipProduct(product)
  const boxPrice = Number(product.priceYen || product.priceJpy || 0)
  const unit = packs > 0 ? Math.round((boxPrice / packs) * 100) / 100 : 0
  const label = categories.get(product.categoryId) || {}
  return {
    id: String(product.id || '').trim(),
    categoryId: String(product.categoryId || '').trim(),
    categoryPt: label['pt-BR'] || product.categoryId || '',
    categoryEn: label.en || product.categoryId || '',
    name: String(product.name || product.nameEn || product.id || '').trim(),
    nameEn: String(product.nameEn || product.name || product.id || '').trim(),
    type: asText(product.type) || 'Booster Box',
    image: product.image || '',
    source: typeof product.source === 'string' ? product.source : 'SNKRDUNK',
    collectionTitle: product.collectionTitle || product.name || '',
    shrinkwrap: product.shrinkwrapOption === 'with' || product.shrinkwrapOption === 'without'
      ? product.shrinkwrapOption
      : null,
    apparelId: product.snkrdunkApparelId != null ? String(product.snkrdunkApparelId) : '',
    rank: Number.isFinite(Number(product.popularityRank)) ? Math.round(Number(product.popularityRank)) : null,
    priceLabel: product.priceLabel || '',
    boxPrice,
    packs,
    unit,
  }
}).filter((product) => product.id && product.categoryId && product.name && product.packs > 0)

function productValues(rows) {
  return rows.map((row) => `(
    ${sqlText(row.id)},
    ${sqlText(row.categoryId)},
    ${sqlText(row.categoryPt)},
    ${sqlText(row.categoryEn)},
    ${sqlText(row.name)},
    ${sqlText(row.nameEn)},
    ${sqlText(row.type)},
    'Japanese',
    ${sqlText(row.image)},
    ${sqlText(row.source)},
    ${sqlText(row.collectionTitle)},
    ${sqlText(row.shrinkwrap)},
    ${sqlText(row.apparelId)},
    ${row.rank == null ? 'NULL' : String(row.rank)},
    ${sqlNum(row.boxPrice)},
    ${sqlText(row.priceLabel)},
    1,
    true
  )`).join(',\n')
}

function batchValues(rows) {
  return rows.map((row) => `(
    ${sqlText(`BB-${row.id}`)},
    ${sqlText(row.id)},
    ${sqlText(row.categoryId)},
    ${row.packs},
    ${sqlNum(row.unit)},
    'OPEN',
    'Caixa live do catálogo. Os packs abrem quando a caixa esgota.'
  )`).join(',\n')
}

function chunk(rows, size) {
  const pages = []
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size))
  return pages
}

const statements = ['BEGIN;']
for (const page of chunk(products, 40)) {
  statements.push(`
INSERT INTO public.live_rip_products (
  id, category_id, category_label_pt, category_label_en, name, name_en, type, language,
  image_url, source, collection_title, shrinkwrap_option, snkrdunk_apparel_id,
  popularity_rank, price_jpy, price_label, available_rips, is_active
)
VALUES
${productValues(page)}
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  category_label_pt = EXCLUDED.category_label_pt,
  category_label_en = EXCLUDED.category_label_en,
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  type = EXCLUDED.type,
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  collection_title = EXCLUDED.collection_title,
  shrinkwrap_option = EXCLUDED.shrinkwrap_option,
  snkrdunk_apparel_id = EXCLUDED.snkrdunk_apparel_id,
  popularity_rank = EXCLUDED.popularity_rank,
  price_jpy = EXCLUDED.price_jpy,
  price_label = EXCLUDED.price_label,
  is_active = true,
  updated_at = now();`)
}

for (const page of chunk(products, 40)) {
  statements.push(`
INSERT INTO public.opening_batches (
  code, product_id, game, total_positions, price_per_position_jpy, status, notes
)
SELECT v.code, v.product_id, v.game, v.total_positions, v.price_per_position_jpy, v.status, v.notes
FROM (
  VALUES
${batchValues(page)}
) AS v(code, product_id, game, total_positions, price_per_position_jpy, status, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.opening_batches b
  WHERE b.product_id = v.product_id
    AND b.status IN (${ACTIVE_STATUSES.map((status) => sqlText(status)).join(', ')})
);`)
}
statements.push('COMMIT;')

const out = argValue('--out')
const sql = `${statements.join('\n')}\n`
if (out) writeFileSync(out, sql, 'utf8')

const samples = ['one-piece-snkrdunk-943510', 'pokemon-snkrdunk-1016236', 'one-piece-snkrdunk-997333']
const sampleLines = samples.map((id) => {
  const row = products.find((product) => product.id === id)
  return row ? `${id} packs=${row.packs} box=${row.boxPrice} unit=${row.unit}` : `${id} missing`
})

console.log(JSON.stringify({
  products: products.length,
  bytes: Buffer.byteLength(sql),
  out: out || null,
  samples: sampleLines,
}))
