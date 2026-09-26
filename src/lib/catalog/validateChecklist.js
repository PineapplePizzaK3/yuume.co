// Pure checklist validation shared by scripts/catalog/validate-set.mjs and the admin Catalog Sets tab.
// The report shape is stored in catalog_sets.validation_report and checked by admin_catalog_set_status (migration 152).

export const VALIDATOR_VERSION = 1

export const SPOT_CHECK_RATIO = 0.1

/** Rarity codes treated as "SR or higher" for the spot-check sample, when a trusted rarity exists. */
export const HIGH_RARITY_CODES = ['SR', 'SAR', 'UR', 'MUR', 'HR', 'CHR', 'CSR', 'BWR', 'MA', 'ACE']

const MAX_LISTED_NUMBERS = 50

/** Mirrors public.catalog_normalize_number(): "1" / "001" / "001/193" -> "001"; non-numeric -> upper-case. */
export function normalizeCardNumber(raw) {
  if (raw == null) return null
  const head = String(raw).split('/')[0].trim()
  if (!head) return null
  if (/^\d+$/.test(head)) return String(Number.parseInt(head, 10)).padStart(3, '0')
  return head.toUpperCase()
}

export function cardNumberToInt(number) {
  const normalized = normalizeCardNumber(number)
  return normalized && /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : null
}

function toPositiveInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function listNumbers(numbers) {
  return numbers.slice(0, MAX_LISTED_NUMBERS)
}

function hashSeed(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic sample for human review: every secret rare (number above expected_official), every item with a
 * trusted SR+ rarity, plus a seeded 10% random sample of the rest. Same set + checklist_version + items => same sample.
 */
export function selectSpotCheck(items, { seed, expectedOfficial = null, ratio = SPOT_CHECK_RATIO } = {}) {
  const sorted = [...items].sort(
    (a, b) => (a.number_int ?? Infinity) - (b.number_int ?? Infinity) || String(a.number).localeCompare(String(b.number)),
  )
  const mandatory = new Set()
  for (const item of sorted) {
    const isSecret = expectedOfficial != null && item.number_int != null && item.number_int > expectedOfficial
    const isHigh = item.rarity && HIGH_RARITY_CODES.includes(String(item.rarity).toUpperCase())
    if (isSecret || isHigh) mandatory.add(item.id)
  }
  const rest = sorted.filter((item) => !mandatory.has(item.id))
  const random = mulberry32(hashSeed(String(seed ?? 'catalog')))
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  const randomCount = Math.min(rest.length, Math.ceil(sorted.length * ratio))
  const picked = new Set([...mandatory, ...rest.slice(0, randomCount).map((item) => item.id)])
  return sorted.filter((item) => picked.has(item.id)).map((item) => item.id)
}

/**
 * @param {{
 *   set: { id: string, set_code?: string, official_reference_url?: string|null, checklist_version?: number },
 *   manifest?: { expected_total?: number, expected_official?: number, rarity_counts?: Record<string, number> },
 *   scope?: { mode?: 'all_numbers'|'official_only', exclude_variants?: boolean },
 *   items: Array<{ id: string, number: string|null, number_int?: number|null, name_ja?: string|null, rarity?: string|null, in_checklist?: boolean }>,
 *   now?: Date,
 * }} input
 */
export function validateChecklist({ set, manifest = {}, scope = {}, items = [], now = new Date() }) {
  const issues = []
  const addIssue = (code, severity, message, numbers) => {
    issues.push(numbers?.length ? { code, severity, message, numbers: listNumbers(numbers) } : { code, severity, message })
  }

  const mode = scope?.mode === 'official_only' ? 'official_only' : 'all_numbers'
  const expectedTotal = toPositiveInt(manifest?.expected_total)
  const expectedOfficial = toPositiveInt(manifest?.expected_official)
  const rangeMax = mode === 'official_only' ? expectedOfficial : expectedTotal

  const checklist = items
    .filter((item) => item.in_checklist !== false)
    .map((item) => {
      const number = normalizeCardNumber(item.number)
      return { ...item, number, number_int: item.number_int ?? cardNumberToInt(number) }
    })

  if (!set?.official_reference_url) {
    addIssue('reference_url_missing', 'error', 'URL oficial de referência não informada.')
  }
  if (rangeMax == null) {
    addIssue(
      'manifest_incomplete',
      'error',
      mode === 'official_only'
        ? 'Manifesto sem expected_official (contagem oficial impressa).'
        : 'Manifesto sem expected_total (total de números, incluindo secretas).',
    )
  }
  if (expectedTotal != null && expectedOfficial != null && expectedOfficial > expectedTotal) {
    addIssue('manifest_inconsistent', 'error', 'expected_official maior que expected_total.')
  }

  const seen = new Map()
  const duplicates = []
  const nonNumeric = []
  const missingName = []
  let withRarity = 0
  for (const item of checklist) {
    if (!item.number) continue
    if (seen.has(item.number)) duplicates.push(item.number)
    else seen.set(item.number, item)
    if (item.number_int == null) nonNumeric.push(item.number)
    if (!String(item.name_ja ?? '').trim()) missingName.push(item.number)
    if (item.rarity) withRarity += 1
  }
  const withoutNumber = checklist.filter((item) => !item.number).length

  if (withoutNumber) addIssue('number_missing', 'error', `${withoutNumber} item(ns) sem número.`)
  if (duplicates.length) addIssue('duplicate_numbers', 'error', 'Números duplicados no checklist.', duplicates)
  if (nonNumeric.length) {
    addIssue('non_numeric_numbers', 'error', 'Números não numéricos fora do escopo do checklist.', nonNumeric)
  }
  if (missingName.length) addIssue('name_ja_missing', 'error', 'Itens sem nome em japonês.', missingName)

  if (rangeMax != null) {
    const present = new Set(checklist.map((item) => item.number_int).filter((n) => n != null))
    const missing = []
    for (let n = 1; n <= rangeMax; n += 1) {
      if (!present.has(n)) missing.push(normalizeCardNumber(String(n)))
    }
    const outOfRange = checklist
      .filter((item) => item.number_int != null && (item.number_int < 1 || item.number_int > rangeMax))
      .map((item) => item.number)
    if (missing.length) addIssue('missing_numbers', 'error', `${missing.length} número(s) faltando no intervalo 1–${rangeMax}.`, missing)
    if (outOfRange.length) addIssue('out_of_range', 'error', `Números fora do intervalo 1–${rangeMax}.`, outOfRange)
    if (checklist.length !== rangeMax) {
      addIssue('count_mismatch', 'error', `Checklist tem ${checklist.length} itens; o manifesto espera ${rangeMax}.`)
    }
  }

  const rarityCounts = manifest?.rarity_counts && typeof manifest.rarity_counts === 'object' ? manifest.rarity_counts : null
  if (rarityCounts && Object.keys(rarityCounts).length) {
    const actual = {}
    for (const item of checklist) {
      if (!item.rarity) continue
      const code = String(item.rarity).toUpperCase()
      actual[code] = (actual[code] || 0) + 1
    }
    const mismatched = Object.entries(rarityCounts)
      .map(([code, expected]) => ({ code: code.toUpperCase(), expected: Number(expected), actual: actual[code.toUpperCase()] || 0 }))
      .filter((row) => row.expected !== row.actual)
    if (mismatched.length) {
      addIssue(
        'rarity_count_mismatch',
        'error',
        `Contagem por raridade diverge do manifesto: ${mismatched.map((r) => `${r.code} ${r.actual}/${r.expected}`).join(', ')}.`,
      )
    }
  } else if (checklist.length && withRarity < checklist.length) {
    addIssue(
      'rarity_incomplete',
      'warning',
      `${checklist.length - withRarity} item(ns) sem raridade confirmada (não bloqueia; completude usa números).`,
    )
  }

  const seed = `${set?.id ?? set?.set_code ?? 'set'}:v${set?.checklist_version ?? 1}`
  const spotCheckIds = selectSpotCheck(
    checklist.filter((item) => item.number),
    { seed, expectedOfficial },
  )

  return {
    validator_version: VALIDATOR_VERSION,
    generated_at: now.toISOString(),
    passed: !issues.some((issue) => issue.severity === 'error'),
    scope: { mode, exclude_variants: scope?.exclude_variants !== false },
    expected: { total: expectedTotal, official: expectedOfficial, range_max: rangeMax },
    counts: {
      items: items.length,
      in_checklist: checklist.length,
      secret: expectedOfficial != null ? checklist.filter((item) => (item.number_int ?? 0) > expectedOfficial).length : null,
      with_rarity: withRarity,
    },
    issues,
    spot_check: { method: 'secret_and_high_rarity_plus_10pct_random', seed, item_ids: spotCheckIds },
  }
}

function detectDelimiter(headerLine) {
  if (headerLine.includes('\t')) return '\t'
  if (headerLine.includes(';') && !headerLine.includes(',')) return ';'
  return ','
}

function parseCsvLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

const CSV_COLUMNS = ['number', 'name_ja', 'name_en', 'rarity', 'in_checklist']

/**
 * Parses a manual checklist CSV (header required; columns: number, name_ja, name_en?, rarity?, in_checklist?).
 * Returns items in the shape accepted by admin_catalog_import_items.
 */
export function parseChecklistCsv(text) {
  const errors = []
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
  if (!lines.length) return { items: [], errors: ['CSV vazio.'] }

  const delimiter = detectDelimiter(lines[0])
  const header = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase())
  if (!header.includes('number')) return { items: [], errors: ['Cabeçalho precisa da coluna "number".'] }
  const unknown = header.filter((h) => h && !CSV_COLUMNS.includes(h))
  if (unknown.length) errors.push(`Colunas ignoradas: ${unknown.join(', ')}.`)

  const items = []
  const seen = new Set()
  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line, delimiter)
    const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
    const number = normalizeCardNumber(row.number)
    const lineNo = index + 2
    if (!number) {
      errors.push(`Linha ${lineNo}: número vazio.`)
      return
    }
    if (seen.has(number)) {
      errors.push(`Linha ${lineNo}: número ${number} repetido.`)
      return
    }
    seen.add(number)
    const item = { number }
    if (row.name_ja) item.name_ja = row.name_ja
    if (row.name_en) item.name_en = row.name_en
    if (row.rarity) item.rarity = row.rarity.toUpperCase()
    if (row.in_checklist) item.in_checklist = !/^(false|0|no|nao|não)$/i.test(row.in_checklist)
    items.push(item)
  })
  return { items, errors }
}
