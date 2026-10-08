import { describe, expect, it } from 'vitest'
import { buildLinkOutUrl, buildMarketQuery, classifyMatch } from './marketQuery.js'

describe('buildMarketQuery', () => {
  it('joins Japanese name, number and set with exclusion terms', () => {
    const q = buildMarketQuery({ nameJa: 'メガカイリューex', number: '250', setCode: 'M2a' })
    expect(q.positive).toContain('メガカイリューex')
    expect(q.positive).toContain('250')
    expect(q.positive).toContain('M2a')
    expect(q.query).toContain('-PSA')
    expect(q.query).toContain('-オリパ')
  })
})

describe('classifyMatch', () => {
  const item = { name_ja: 'ピカチュウ', number: '025', set_code: 'SV2a' }
  it('classifies exact, likely and loose', () => {
    expect(classifyMatch({ title: 'ピカチュウ 025/165 SV2a' }, item)).toBe('exact')
    expect(classifyMatch({ title: 'ピカチュウ SAR' }, item)).toBe('likely')
    expect(classifyMatch({ title: 'リザードン PSA10' }, item)).toBe('loose')
  })
})

describe('buildLinkOutUrl', () => {
  it('fills the query placeholder', () => {
    expect(buildLinkOutUrl('https://x.test?q={query}', 'a b')).toBe('https://x.test?q=a%20b')
    expect(buildLinkOutUrl('https://x.test', 'a')).toBe(null)
  })
})
