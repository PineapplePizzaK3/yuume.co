import { beforeEach, describe, expect, it } from 'vitest'
import { computeSellBackOfferJpy } from '../lib/sellBack.js'
import { openingBatchIdFromProductId } from '../data/collectorLiveRipCatalog.js'
import {
  completeLiveRipOpening,
  getCollectionAsset,
  getCollectorDemoWallet,
  getMyRipRecord,
  inspectLiveRipDemoState,
  listCollectionAssets,
  listMyRipRecords,
  reserveOpeningBatch,
  resetLiveRipDemoState,
  resetLiveRipOpeningResults,
  sellBackCollectionAsset,
} from './collectorService.js'

const BATCH_ID = openingBatchIdFromProductId('pokemon-snkrdunk-1016236')

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(String(key), String(value))
    },
    removeItem: (key) => {
      map.delete(String(key))
    },
    clear: () => {
      map.clear()
    },
  }
}

beforeEach(() => {
  const storage = createMemoryStorage()
  globalThis.window = { localStorage: storage }
})

describe('collector mock Box Break loop', () => {
  it('reserves a catalog box and keeps it waiting until the live opening happens', async () => {
    const start = getCollectorDemoWallet()
    const reserved = await reserveOpeningBatch(BATCH_ID, { quantity: 1 })
    expect(reserved.error).toBeNull()
    expect(reserved.data.allocationId).toMatch(/^alloc-/)
    expect(reserved.data.chargedJpy).toBeGreaterThan(0)
    expect(getCollectorDemoWallet().balance).toBe(start.balance - reserved.data.chargedJpy)

    const records = await listMyRipRecords()
    expect(records.data.some((row) => row.id === reserved.data.allocationId)).toBe(true)

    const record = await getMyRipRecord(reserved.data.allocationId)
    expect(record.error).toBeNull()
    expect(record.data.pulls).toEqual([])
    expect(record.data.status).toBe('reserved')
    expect(record.data.packsOpened).toBe(0)

    const assets = await listCollectionAssets()
    const held = assets.data.find((asset) => asset.origin?.allocationId === reserved.data.allocationId)
    expect(held).toBeUndefined()
  })

  it('adds pulls to collection after the live opening completes', async () => {
    const start = getCollectorDemoWallet()
    const reserved = await reserveOpeningBatch(BATCH_ID, { quantity: 1 })
    expect(reserved.error).toBeNull()

    const opened = await completeLiveRipOpening(BATCH_ID)
    expect(opened.error).toBeNull()

    const record = await getMyRipRecord(reserved.data.allocationId)
    expect(record.error).toBeNull()
    expect(record.data.pulls.length).toBeGreaterThan(0)
    expect(record.data.status).toBe('completed')

    const assets = await listCollectionAssets()
    const held = assets.data.find((asset) => asset.origin?.allocationId === reserved.data.allocationId)
    expect(held?.status).toBe('held')
    expect(held.sellBackOfferJpy).toBe(computeSellBackOfferJpy(held.marketValueJpy))

    const sold = await sellBackCollectionAsset(held.id)
    expect(sold.error).toBeNull()
    expect(sold.data.creditedJpy).toBe(held.sellBackOfferJpy)
    expect(getCollectorDemoWallet().balance).toBe(
      start.balance - reserved.data.chargedJpy + sold.data.creditedJpy
    )

    const after = await getCollectionAsset(held.id)
    expect(after.data.status).toBe('sold')
  })

  it('resets auto-opened cards without dropping the reservation', async () => {
    const reserved = await reserveOpeningBatch(BATCH_ID, { quantity: 1 })
    expect(reserved.error).toBeNull()
    await completeLiveRipOpening(BATCH_ID)

    const opened = await getMyRipRecord(reserved.data.allocationId)
    expect(opened.data.pulls.length).toBeGreaterThan(0)

    const reset = resetLiveRipOpeningResults({ batchId: BATCH_ID })
    expect(reset.error).toBeNull()
    expect(reset.data.cleared).toBeGreaterThan(0)

    const after = await getMyRipRecord(reserved.data.allocationId)
    expect(after.data.pulls).toEqual([])
    expect(after.data.status).toBe('reserved')

    const assets = await listCollectionAssets()
    expect(assets.data.find((asset) => asset.origin?.allocationId === reserved.data.allocationId)).toBeUndefined()

    const state = inspectLiveRipDemoState()
    expect(state.boxes.some((row) => row.id === BATCH_ID && row.reserved > 0 && !row.opened)).toBe(true)

    const wipe = resetLiveRipDemoState()
    expect(wipe.error).toBeNull()
    const records = await listMyRipRecords()
    expect(records.data.some((row) => row.id === reserved.data.allocationId)).toBe(false)
  })

  it('blocks a reserve when demo credits are not enough', async () => {
    window.localStorage.setItem(
      'collector_mock_wallet_v1',
      JSON.stringify({ 'demo-user': { balance: 1 } })
    )
    const reserved = await reserveOpeningBatch(BATCH_ID, { quantity: 1 })
    expect(reserved.data).toBeNull()
    expect(reserved.error.code).toBe('INSUFFICIENT_CREDITS')
    expect(getCollectorDemoWallet().balance).toBe(1)
  })
})
