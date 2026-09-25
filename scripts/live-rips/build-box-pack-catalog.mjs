/**
 * Gera o catálogo Live Rips (só caixas com packs) a partir do catálogo On-Demand.
 * On-Demand permanece completo; Live Rips é um subset filtrado.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { filterLiveRipBoxWithPacksProducts } from '../../src/lib/liveRipBoxPackFilter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const onDemandCatalogPath = path.join(projectRoot, 'src', 'data', 'onDemandSnkrdunkCatalog.js')
const outputPath = path.join(projectRoot, 'src', 'data', 'liveRipsSnkrdunkCatalog.js')

function buildOutput({ source, lastUpdatedAt, categories, products }) {
  const lines = []
  lines.push(`export const LIVE_RIPS_SNKRDUNK_SOURCE = ${JSON.stringify(source, null, 2)}`)
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_LAST_UPDATED_AT = ${JSON.stringify(lastUpdatedAt)}`
  )
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_CATEGORIES = ${JSON.stringify(categories, null, 2)}`
  )
  lines.push('')
  lines.push(
    `export const LIVE_RIPS_SNKRDUNK_PRODUCTS = ${JSON.stringify(products, null, 2)}`
  )
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const mod = await import(pathToFileURL(onDemandCatalogPath).href)
  const source = mod.ON_DEMAND_SNKRDUNK_SOURCE
  const categories = mod.ON_DEMAND_SNKRDUNK_CATEGORIES
  const allProducts = Array.isArray(mod.ON_DEMAND_SNKRDUNK_PRODUCTS)
    ? mod.ON_DEMAND_SNKRDUNK_PRODUCTS
    : []
  const products = filterLiveRipBoxWithPacksProducts(allProducts)
  const lastUpdatedAt = new Date().toISOString()

  const usedCategoryIds = new Set(products.map((p) => p.categoryId))
  const filteredCategories = (Array.isArray(categories) ? categories : []).filter((c) =>
    usedCategoryIds.has(c.id)
  )

  const outputText = buildOutput({
    source: {
      ...source,
      categoryPath: 'トレカ (ボックス・パック) — Live Rips',
    },
    lastUpdatedAt,
    categories: filteredCategories.length ? filteredCategories : categories,
    products,
  })

  await writeFile(outputPath, outputText, 'utf8')
  console.log(`Live Rips box/pack catalog generated: ${outputPath}`)
  console.log(`Products kept: ${products.length} / ${allProducts.length}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
