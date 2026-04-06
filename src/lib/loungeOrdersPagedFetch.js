import { getMyOrders } from '../services/orderService'

const BATCH = 40
const MAX_SCAN = 500

/**
 * Percorre pedidos em lotes até preencher a página ou esgotar o túnel de busca.
 * @param {string} userId
 * @param {{ page: number, pageSize: number, matchFn: (order: object) => boolean, excludeStatus?: string | null }} opts
 */
export async function fetchLoungeOrderPage(userId, { page, pageSize, matchFn, excludeStatus = null }) {
  const targetEnd = (page + 1) * pageSize
  const matched = []
  let offset = 0
  let lastBatchLen = 0

  while (matched.length < targetEnd && offset < MAX_SCAN) {
    const { data, error } = await getMyOrders(userId, {
      limit: BATCH,
      offset,
      ...(excludeStatus ? { excludeStatus } : {}),
    })
    if (error) return { data: [], error, hasMore: false }
    const batch = data ?? []
    lastBatchLen = batch.length
    if (lastBatchLen === 0) break
    for (const o of batch) {
      if (matchFn(o)) matched.push(o)
    }
    offset += BATCH
    if (lastBatchLen < BATCH) break
  }

  const start = page * pageSize
  const pageData = matched.slice(start, start + pageSize)
  const exhausted = lastBatchLen < BATCH || offset >= MAX_SCAN
  const hasMore =
    matched.length > targetEnd || (matched.length === targetEnd && !exhausted && lastBatchLen === BATCH)

  return { data: pageData, error: null, hasMore }
}
