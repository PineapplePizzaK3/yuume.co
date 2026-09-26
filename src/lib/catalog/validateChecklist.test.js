import { describe, expect, it } from 'vitest'
import {
  normalizeCardNumber,
  parseChecklistCsv,
  selectSpotCheck,
  validateChecklist,
} from './validateChecklist.js'

function buildItems(total, overrides = {}) {
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return {
      id: `item-${n}`,
      number: String(n).padStart(3, '0'),
      number_int: n,
      name_ja: `カード${n}`,
      rarity: null,
      in_checklist: true,
      ...(overrides[n] || {}),
    }
  })
}

const set = { id: 'set-1', set_code: 'M2a', official_reference_url: 'https://example.test/m2a', checklist_version: 1 }
const manifest = { expected_total: 250, expected_official: 193 }

describe('normalizeCardNumber', () => {
  it('pads numeric numbers and strips the printed total', () => {
    expect(normalizeCardNumber('1')).toBe('001')
    expect(normalizeCardNumber('001')).toBe('001')
    expect(normalizeCardNumber('194/193')).toBe('194')
    expect(normalizeCardNumber(' sv-p ')).toBe('SV-P')
    expect(normalizeCardNumber('')).toBe(null)
  })
})

describe('validateChecklist', () => {
  it('passes a complete 250-number checklist (M2a base-number scope)', () => {
    const report = validateChecklist({ set, manifest, items: buildItems(250) })
    expect(report.passed).toBe(true)
    expect(report.counts.in_checklist).toBe(250)
    expect(report.counts.secret).toBe(57)
    expect(report.issues.map((i) => i.code)).toEqual(['rarity_incomplete'])
  })

  it('reports gaps, duplicates and count mismatches', () => {
    const items = buildItems(250).filter((item) => item.number_int !== 42)
    items.push({ ...items[0], id: 'dup' })
    const report = validateChecklist({ set, manifest, items })
    const codes = report.issues.map((i) => i.code)
    expect(report.passed).toBe(false)
    expect(codes).toContain('missing_numbers')
    expect(codes).toContain('duplicate_numbers')
    expect(report.issues.find((i) => i.code === 'missing_numbers').numbers).toEqual(['042'])
  })

  it('fails without a manifest total or reference URL', () => {
    const report = validateChecklist({ set: { id: 'x' }, manifest: {}, items: buildItems(10) })
    const codes = report.issues.map((i) => i.code)
    expect(codes).toContain('manifest_incomplete')
    expect(codes).toContain('reference_url_missing')
    expect(report.passed).toBe(false)
  })

  it('ignores items outside the checklist and supports official_only scope', () => {
    const items = buildItems(250).map((item) => (item.number_int > 193 ? { ...item, in_checklist: false } : item))
    const report = validateChecklist({ set, manifest, scope: { mode: 'official_only' }, items })
    expect(report.passed).toBe(true)
    expect(report.expected.range_max).toBe(193)
  })

  it('checks rarity counts only when the manifest provides them', () => {
    const items = buildItems(3, { 1: { rarity: 'C' }, 2: { rarity: 'C' }, 3: { rarity: 'SR' } })
    const ok = validateChecklist({ set, manifest: { expected_total: 3, rarity_counts: { C: 2, SR: 1 } }, items })
    expect(ok.passed).toBe(true)
    const bad = validateChecklist({ set, manifest: { expected_total: 3, rarity_counts: { C: 3 } }, items })
    expect(bad.issues.map((i) => i.code)).toContain('rarity_count_mismatch')
  })
})

describe('selectSpotCheck', () => {
  it('always includes secrets and SR+ and is deterministic', () => {
    const items = buildItems(250, { 10: { rarity: 'SAR' } })
    const a = selectSpotCheck(items, { seed: 'set-1:v1', expectedOfficial: 193 })
    const b = selectSpotCheck(items, { seed: 'set-1:v1', expectedOfficial: 193 })
    expect(a).toEqual(b)
    expect(a).toContain('item-10')
    for (let n = 194; n <= 250; n += 1) expect(a).toContain(`item-${n}`)
    expect(a.length).toBe(57 + 1 + 25)
  })

  it('changes the random part when the seed changes', () => {
    const items = buildItems(250)
    const a = selectSpotCheck(items, { seed: 'set-1:v1', expectedOfficial: 193 })
    const b = selectSpotCheck(items, { seed: 'set-1:v2', expectedOfficial: 193 })
    expect(a).not.toEqual(b)
  })
})

describe('parseChecklistCsv', () => {
  it('parses quoted cells, normalizes numbers and flags repeats', () => {
    const csv = 'number,name_ja,rarity\n1,"ピカチュウ, スペシャル",c\n001,重複,U\n194/193,メガカイリューex,MUR\n'
    const { items, errors } = parseChecklistCsv(csv)
    expect(items).toEqual([
      { number: '001', name_ja: 'ピカチュウ, スペシャル', rarity: 'C' },
      { number: '194', name_ja: 'メガカイリューex', rarity: 'MUR' },
    ])
    expect(errors).toEqual(['Linha 3: número 001 repetido.'])
  })

  it('requires a number column', () => {
    expect(parseChecklistCsv('name_ja\nピカチュウ').errors[0]).toMatch(/number/)
  })
})
