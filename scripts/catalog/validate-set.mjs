/**
 * Runs the automated checklist validation and stores the report (set moves to VALIDATING).
 *
 *   node --env-file=.env scripts/catalog/validate-set.mjs SV2a [M2a ...] [--dry-run]
 *
 * VERIFIED is never set here: it needs the human spot-check and manifest confirmation in the admin tab.
 */
import { validateChecklist } from '../../src/lib/catalog/validateChecklist.js'
import { createServiceClient, fetchSetByCode, fetchSetItems, parseArgs } from './lib.mjs'

async function validateOne(client, setCode, flags) {
  const franchise = 'pokemon_tcg'
  const set = await fetchSetByCode(client, franchise, setCode)
  if (!set) throw new Error(`Set ${setCode} não encontrado. Rode a importação primeiro.`)
  const items = await fetchSetItems(client, set.id)
  const report = validateChecklist({
    set,
    manifest: set.official_manifest || {},
    scope: set.checklist_scope || {},
    items,
  })

  console.log(`\n== ${setCode} (${set.status}) ==`)
  console.log(`passed=${report.passed} itens=${report.counts.in_checklist} esperado=${report.expected.range_max ?? '?'} secretas=${report.counts.secret ?? '?'} amostra=${report.spot_check.item_ids.length}`)
  for (const issue of report.issues) {
    const numbers = issue.numbers?.length ? ` [${issue.numbers.join(', ')}]` : ''
    console.log(`  ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${numbers}`)
  }

  if (flags.has('dry-run')) return
  const { data, error } = await client.rpc('service_catalog_record_validation', { p_set_id: set.id, p_report: report })
  if (error) throw new Error(`Erro ao gravar relatório: ${error.message}`)
  console.log(`Relatório gravado; status agora ${data.status}.`)
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))
  if (!positional.length) {
    console.error('Uso: validate-set.mjs <set_code> [...] [--dry-run]')
    process.exit(1)
  }
  const client = createServiceClient()
  for (const code of positional) {
    await validateOne(client, code, flags)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
