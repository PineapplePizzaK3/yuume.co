import { ON_DEMAND_SNKRDUNK_PRODUCTS as products } from '../../src/data/onDemandSnkrdunkCatalog.js'
const pokemon = products.filter((x) => x.categoryId === 'pokemon-standard')
console.log('pokemon', pokemon.length, 'total', products.length)
for (const item of pokemon) {
  console.log(`${item.popularityRank || '-'} | ${item.name} | ${item.priceLabel}`)
}
