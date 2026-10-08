import { describe, expect, it } from 'vitest'
import { defaultCatalogStoreSelection } from '../components/CatalogSearchPanel.jsx'

describe('defaultCatalogStoreSelection', () => {
  it('enables Mercari and both Yahoos by default', () => {
    expect(defaultCatalogStoreSelection()).toEqual({
      amazon: false,
      rakuma: false,
      mercari: true,
      yahoo: true,
      yahoo_flea: true,
      snkrdunk: false,
    })
  })

  it('pins to a single store from the URL', () => {
    expect(defaultCatalogStoreSelection('rakuma').rakuma).toBe(true)
    expect(defaultCatalogStoreSelection('rakuma').mercari).toBe(false)
  })

  it('enables every store when catalogStore=all', () => {
    const all = defaultCatalogStoreSelection('all')
    expect(Object.values(all).every(Boolean)).toBe(true)
  })
})
