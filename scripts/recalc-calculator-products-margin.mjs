/**
 * Recalcula final_price_brl (e custos derivados) de todos os calculator_products
 * com a regra correta: margem % sobre o custo no Brasil (landed cost).
 *
 * Uso:
 *   npm run recalc:calculator-margin:dry
 *   npm run recalc:calculator-margin
 *
 * Ou:
 *   node --import ./scripts/register-extensionless.mjs scripts/recalc-calculator-products-margin.mjs --dry-run
 *   node --import ./scripts/register-extensionless.mjs scripts/recalc-calculator-products-margin.mjs
 *
 * Env necessários:
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolvePath(__dirname, '..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(resolvePath(rootDir, '.env.local'))
loadEnvFile(resolvePath(rootDir, '.env'))

const dryRun = process.argv.includes('--dry-run')
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const {
  calculateBrazilFinalPrice,
  SHIPPING_MODE_LOTE,
  SHIPPING_MODE_DIRETO,
  DIRECT_METHOD_EMS,
  DIRECT_METHOD_EPACKET,
  DIRECT_METHOD_AIRMAIL,
} = await import('../src/lib/brazilPriceCalculator.js')

function parseSnapshot(raw) {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object') return raw
  return {}
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function buildRecalcInput(row) {
  const snap = parseSnapshot(row.calculation_snapshot)
  const inputs = snap.inputs && typeof snap.inputs === 'object' ? snap.inputs : {}

  const shippingMode = row.shipping_mode === SHIPPING_MODE_DIRETO
    ? SHIPPING_MODE_DIRETO
    : SHIPPING_MODE_LOTE
  const directMethod = row.direct_method === DIRECT_METHOD_EPACKET
    ? DIRECT_METHOD_EPACKET
    : row.direct_method === DIRECT_METHOD_AIRMAIL
      ? DIRECT_METHOD_AIRMAIL
      : DIRECT_METHOD_EMS

  return {
    baseCostYen: Number(row.base_cost_yen) || 0,
    declaredValueYen: Number(row.declared_value_yen) || 0,
    weightGrams: Number(row.weight_grams) || 0,
    quantity: Math.max(1, Math.round(Number(inputs.quantity) || 1)),
    shippingMode,
    directMethod,
    loteKg: row.lote_kg != null ? Number(row.lote_kg) : (Number(inputs.loteKg) || 1),
    customsFactor: Number(row.customs_factor) || Number(inputs.customsFactor) || 2,
    brlPerJpy: Number(row.brl_per_jpy) || Number(inputs.brlPerJpy) || 0,
    usdBrl: Number(inputs.usdBrl) || 0,
    marginPercent: Number(row.margin_percent) || Number(inputs.marginPercent) || 0,
    packagingBrl: Number(row.packaging_brl) || Number(inputs.packagingBrl) || 0,
    localShippingBrl: Number(row.local_shipping_brl) || Number(inputs.localShippingBrl) || 0,
    applyIof: Boolean(inputs.applyIof),
    iofPercent: inputs.iofPercent,
    paymentFeePercents: inputs.paymentFeePercents || {},
    paymentFixedUsdByMethod: inputs.paymentFixedUsdByMethod || {},
  }
}

function buildUpdatePayload(row, result) {
  return {
    international_shipping_yen: result.shipping.yen,
    landed_cost_yen: result.breakdown.landedCostYen,
    landed_cost_brl: result.breakdown.landedCostBrl,
    final_price_brl: result.breakdown.finalBrl,
    calculation_snapshot: result,
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log(dryRun ? 'Mode: DRY-RUN (nenhum update será gravado)' : 'Mode: APPLY (vai atualizar o banco)')
console.log(`Supabase: ${SUPABASE_URL}`)

const { data: rows, error: listError } = await supabase
  .from('calculator_products')
  .select('*')
  .order('created_at', { ascending: true })

if (listError) {
  console.error('Falha ao listar calculator_products:', listError.message)
  process.exit(1)
}

const products = Array.isArray(rows) ? rows : []
console.log(`Encontrados ${products.length} produto(s).`)

let updated = 0
let skipped = 0
let failed = 0
let unchanged = 0

for (const row of products) {
  const label = `${row.name || '(sem nome)'} [${String(row.id).slice(0, 8)}]`
  try {
    const input = buildRecalcInput(row)
    const result = calculateBrazilFinalPrice(input)

    if (!result.isValid) {
      console.warn(`SKIP  ${label} — cálculo inválido (peso/câmbio/frete).`)
      skipped += 1
      continue
    }

    const oldFinal = round2(row.final_price_brl)
    const newFinal = round2(result.breakdown.finalBrl)
    const oldLanded = round2(row.landed_cost_brl)
    const newLanded = round2(result.breakdown.landedCostBrl)
    const delta = round2(newFinal - oldFinal)

    if (oldFinal === newFinal && oldLanded === newLanded) {
      console.log(`OK    ${label} — sem mudança (final ${newFinal})`)
      unchanged += 1
      continue
    }

    console.log(
      `${dryRun ? 'WOULD' : 'UPDATE'} ${label}`
      + ` | landed ${oldLanded} → ${newLanded}`
      + ` | final ${oldFinal} → ${newFinal}`
      + ` | Δ ${delta >= 0 ? '+' : ''}${delta}`
      + ` | margem ${input.marginPercent}%`,
    )

    if (!dryRun) {
      const payload = buildUpdatePayload(row, result)
      const { error: updateError } = await supabase
        .from('calculator_products')
        .update(payload)
        .eq('id', row.id)

      if (updateError) {
        console.error(`FAIL  ${label}: ${updateError.message}`)
        failed += 1
        continue
      }
    }

    updated += 1
  } catch (err) {
    console.error(`FAIL  ${label}:`, err?.message || err)
    failed += 1
  }
}

console.log('\nResumo')
console.log(`  atualizados: ${updated}${dryRun ? ' (dry-run)' : ''}`)
console.log(`  sem mudança: ${unchanged}`)
console.log(`  ignorados:   ${skipped}`)
console.log(`  falhas:      ${failed}`)

if (failed > 0) process.exit(1)
