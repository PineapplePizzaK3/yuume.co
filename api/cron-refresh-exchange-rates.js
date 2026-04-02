/**
 * GET|POST /api/cron-refresh-exchange-rates — atualiza cotações e opcionalmente produtos.
 */
import { handleCronRefreshExchangeRates } from './lib/cronRefreshHttp.js'

export default async function handler(req, res) {
  return handleCronRefreshExchangeRates(req, res)
}
