/**
 * GET /api/exchange-rates — JSON público de cotações (Frankfurter + effective_brl_per_jpy).
 * Arquivo dedicado evita depender só de rewrite → create-checkout-session.
 */
import { handleExchangeRatesGet } from './lib/exchangeRatesHttp.js'

export default async function handler(req, res) {
  return handleExchangeRatesGet(req, res)
}
