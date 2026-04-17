import fs from 'node:fs/promises'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const FUNCTION_NAME = process.env.SCRAPE_FUNCTION_NAME || 'scrape-product'
const SAMPLE_FILE = process.env.SCRAPE_SAMPLE_FILE || 'scripts/scrape-quality-sample-urls.json'

function pct(num, den) {
  if (!den) return '0.0%'
  return `${((num / den) * 100).toFixed(1)}%`
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const raw = await fs.readFile(SAMPLE_FILE, 'utf8')
const samples = JSON.parse(raw)
if (!Array.isArray(samples) || samples.length === 0) {
  console.error(`No samples found in ${SAMPLE_FILE}`)
  process.exit(1)
}

const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`
const rows = []

for (const sample of samples) {
  const label = String(sample?.label || sample?.url || 'sample')
  const url = String(sample?.url || '').trim()
  if (!url) continue
  let row = {
    label,
    url,
    ok: false,
    hasName: false,
    hasPrice: false,
    hasImage: false,
    confidence: 0,
    source: '',
    warnings: 0,
    error: '',
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ url }),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.error) {
      row.error = data.error
    } else {
      row.ok = true
      row.hasName = Boolean(data?.name && data.name !== 'Produto')
      row.hasPrice = Number(data?.price) > 0
      row.hasImage = Boolean(data?.imageUrl)
      row.confidence = Number(data?.confidence) || 0
      row.source = String(data?.source || '')
      row.warnings = Array.isArray(data?.warnings) ? data.warnings.length : 0
    }
  } catch (err) {
    row.error = err?.message || 'network error'
  }
  rows.push(row)
}

const total = rows.length
const ok = rows.filter((r) => r.ok).length
const hasName = rows.filter((r) => r.hasName).length
const hasPrice = rows.filter((r) => r.hasPrice).length
const hasImage = rows.filter((r) => r.hasImage).length
const avgConfidence = rows.reduce((acc, r) => acc + (Number(r.confidence) || 0), 0) / Math.max(1, rows.length)

console.log('\n=== Scrape Quality Report ===')
console.log(`Endpoint: ${endpoint}`)
console.log(`Samples: ${total}`)
console.log(`Success: ${ok}/${total} (${pct(ok, total)})`)
console.log(`Name found: ${hasName}/${total} (${pct(hasName, total)})`)
console.log(`Price found: ${hasPrice}/${total} (${pct(hasPrice, total)})`)
console.log(`Image found: ${hasImage}/${total} (${pct(hasImage, total)})`)
console.log(`Average confidence: ${(avgConfidence * 100).toFixed(1)}%`)

console.log('\nPer URL:')
for (const r of rows) {
  const status = r.ok ? 'OK' : 'ERR'
  console.log(
    `- [${status}] ${r.label} | conf=${(r.confidence * 100).toFixed(0)}% | source=${r.source || '-'} | name=${r.hasName ? 'Y' : 'N'} price=${r.hasPrice ? 'Y' : 'N'} image=${r.hasImage ? 'Y' : 'N'}${r.error ? ` | error=${r.error}` : ''}`
  )
}

