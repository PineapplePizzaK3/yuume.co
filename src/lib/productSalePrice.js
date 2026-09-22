/**
 * Preço unitário de venda em BRL com taxas embutidas (câmbio + markup Wise + taxa grupo quando aplicável).
 * Alinhado ao pipeline de checkout (create_store_checkout_intent / create_store_order).
 * Frete internacional não entra aqui — é cobrado separadamente no envio.
 */
import {
  GRUPO_COMPRAS_FEE_PERCENT,
  GRUPO_COMPRAS_FEE_PER_UNIT_USD,
} from '../data/serviceFees.js'

export const SALE_CHANNEL_STORE = 'store'
export const SALE_CHANNEL_GRUPO = 'grupo'

const DEFAULT_WISE_MARKUP_PERCENT = 0.73

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

/** USD cobrado por 1 JPY (spot × markup Wise). */
export function chargeJpyUsdRate(jpyUsdSpot, markupPercent = DEFAULT_WISE_MARKUP_PERCENT) {
  const spot = Number(jpyUsdSpot) || 0
  if (spot <= 0) return 0
  const markup = Number(markupPercent)
  const pct = Number.isFinite(markup) && markup >= 0 ? markup : DEFAULT_WISE_MARKUP_PERCENT
  return spot * (1 + pct / 100)
}

/** Normaliza payload da API /exchange-rates ou system_settings. Idempotente se já normalizado. */
export function normalizePricingRates(input = {}) {
  if (Number(input.jpyUsdCharge) > 0 && Number(input.usdBrl ?? input.usd_brl) > 0) {
    const jpyUsdCharge = Number(input.jpyUsdCharge)
    const usdBrl = Number(input.usdBrl ?? input.usd_brl)
    const jpyUsdSpot = Number(input.jpyUsdSpot ?? input.jpy_usd) || jpyUsdCharge
    const wiseMarkupPercent =
      Number(input.wiseMarkupPercent ?? input.wise_usd_jpy_withdrawal_markup_percent) ||
      DEFAULT_WISE_MARKUP_PERCENT
    return {
      jpyUsdSpot,
      jpyUsdCharge,
      usdBrl,
      effectiveBrlPerJpy:
        Number(input.effectiveBrlPerJpy ?? input.effective_brl_per_jpy) > 0
          ? Number(input.effectiveBrlPerJpy ?? input.effective_brl_per_jpy)
          : jpyUsdCharge * usdBrl,
      wiseMarkupPercent,
      grupoFeePerUnitUsd:
        Number(input.grupoFeePerUnitUsd ?? input.grupo_fee_per_unit_usd) > 0
          ? Number(input.grupoFeePerUnitUsd ?? input.grupo_fee_per_unit_usd)
          : GRUPO_COMPRAS_FEE_PER_UNIT_USD,
    }
  }

  const jpyUsdSpot = Number(input.jpy_usd ?? input.jpyUsdSpot) || 0
  const wiseMarkupPercent =
    Number(input.wise_usd_jpy_withdrawal_markup_percent ?? input.wiseMarkupPercent) ||
    DEFAULT_WISE_MARKUP_PERCENT
  const jpyUsdCharge =
    Number(input.jpy_usd_charge) > 0
      ? Number(input.jpy_usd_charge)
      : chargeJpyUsdRate(jpyUsdSpot, wiseMarkupPercent)
  const usdBrl = Number(input.usd_brl) || 0
  const effectiveBrlPerJpy =
    Number(input.effective_brl_per_jpy) > 0
      ? Number(input.effective_brl_per_jpy)
      : jpyUsdCharge > 0 && usdBrl > 0
        ? jpyUsdCharge * usdBrl
        : 0
  const grupoFeePerUnitUsd =
    Number(input.grupo_fee_per_unit_usd ?? input.grupoFeePerUnitUsd) > 0
      ? Number(input.grupo_fee_per_unit_usd ?? input.grupoFeePerUnitUsd)
      : GRUPO_COMPRAS_FEE_PER_UNIT_USD

  return {
    jpyUsdSpot,
    jpyUsdCharge,
    usdBrl,
    effectiveBrlPerJpy,
    wiseMarkupPercent,
    grupoFeePerUnitUsd,
  }
}

export function jpyToChargeUsd(priceJpy, rates) {
  const jpy = Number(priceJpy) || 0
  const normalized =
    Number(rates?.jpyUsdCharge) > 0 ? rates : normalizePricingRates(rates)
  if (jpy <= 0 || normalized.jpyUsdCharge <= 0) return 0
  return jpy * normalized.jpyUsdCharge
}

/** Taxa total do grupo em USD (mesma fórmula do RPC de checkout). */
export function computeGrupoFeeUsd(
  grupoSubtotalUsd,
  grupoUnitsQty,
  feePerUnitUsd = GRUPO_COMPRAS_FEE_PER_UNIT_USD,
) {
  const sub = Number(grupoSubtotalUsd) || 0
  const qty = Math.max(0, Math.floor(Number(grupoUnitsQty) || 0))
  const feeUnit = Number(feePerUnitUsd) || GRUPO_COMPRAS_FEE_PER_UNIT_USD
  if (sub <= 0 || qty <= 0) return 0
  return sub * (GRUPO_COMPRAS_FEE_PERCENT / 100) + feeUnit * qty
}

/**
 * Calcula preço unitário de venda ao cliente em BRL, com taxas embutidas.
 *
 * @param {object} opts
 * @param {number} opts.priceJpy - custo base em ienes (Mercari / fornecedor)
 * @param {'store'|'grupo'} [opts.channel='store'] - loja direta ou compras programadas
 * @param {number} [opts.quantity=1]
 * @param {object} [opts.rates] - cotações (normalizePricingRates)
 * @param {number} [opts.grupoSubtotalUsd] - subtotal USD de todo o grupo (rateio proporcional)
 * @param {number} [opts.grupoTotalQty] - unidades totais no grupo (rateio proporcional)
 */
export function computeProductSalePrice(opts = {}) {
  const priceJpy = Number(opts.priceJpy) || 0
  const quantity = Math.max(1, Math.floor(Number(opts.quantity) || 1))
  const channel = opts.channel === SALE_CHANNEL_GRUPO ? SALE_CHANNEL_GRUPO : SALE_CHANNEL_STORE
  const rates = normalizePricingRates(opts.rates || {})

  const empty = {
    priceJpy: 0,
    priceUsd: 0,
    priceBrl: 0,
    unitSaleUsd: 0,
    unitSaleBrl: 0,
    lineSaleUsd: 0,
    lineSaleBrl: 0,
    fees: {
      fxMarkupUsd: 0,
      grupoPercentUsd: 0,
      grupoPerUnitUsd: 0,
      grupoTotalUsd: 0,
      grupoTotalBrl: 0,
    },
    channel,
    quantity,
    rates: {
      jpyUsdCharge: rates.jpyUsdCharge,
      usdBrl: rates.usdBrl,
      effectiveBrlPerJpy: rates.effectiveBrlPerJpy,
      wiseMarkupPercent: rates.wiseMarkupPercent,
      grupoFeePerUnitUsd: rates.grupoFeePerUnitUsd,
    },
  }

  if (priceJpy <= 0) return empty

  const unitUsd = jpyToChargeUsd(priceJpy, rates)
  const lineUsd = unitUsd * quantity
  const unitBrlBase =
    rates.effectiveBrlPerJpy > 0
      ? priceJpy * rates.effectiveBrlPerJpy
      : rates.usdBrl > 0
        ? unitUsd * rates.usdBrl
        : 0

  const spotUnitUsd = rates.jpyUsdSpot > 0 ? priceJpy * rates.jpyUsdSpot : 0
  const fxMarkupUsd = Math.max(0, unitUsd - spotUnitUsd)

  let unitSaleUsd = unitUsd
  let grupoPercentUsd = 0
  let grupoPerUnitUsd = 0
  let grupoTotalUsd = 0

  if (channel === SALE_CHANNEL_GRUPO) {
    const grupoSubtotalUsd = Number(opts.grupoSubtotalUsd) || 0
    const grupoTotalQty = Math.max(0, Math.floor(Number(opts.grupoTotalQty) || 0))

    if (grupoSubtotalUsd > 0 && grupoTotalQty > 0) {
      grupoTotalUsd = computeGrupoFeeUsd(grupoSubtotalUsd, grupoTotalQty, rates.grupoFeePerUnitUsd)
      const lineFeeUsd = grupoTotalUsd * (lineUsd / grupoSubtotalUsd)
      unitSaleUsd = unitUsd + lineFeeUsd / quantity
      grupoPercentUsd = lineFeeUsd * (GRUPO_COMPRAS_FEE_PERCENT / 100) / (GRUPO_COMPRAS_FEE_PERCENT / 100 + 1e-9)
      grupoPerUnitUsd = (lineFeeUsd - grupoPercentUsd) / quantity
    } else {
      grupoPercentUsd = unitUsd * (GRUPO_COMPRAS_FEE_PERCENT / 100)
      grupoPerUnitUsd = rates.grupoFeePerUnitUsd
      unitSaleUsd = unitUsd * (1 + GRUPO_COMPRAS_FEE_PERCENT / 100) + rates.grupoFeePerUnitUsd
      grupoTotalUsd = (grupoPercentUsd + grupoPerUnitUsd) * quantity
    }
  }

  const unitSaleBrl = rates.usdBrl > 0 ? unitSaleUsd * rates.usdBrl : unitBrlBase
  const lineSaleUsd = unitSaleUsd * quantity
  const lineSaleBrl = unitSaleBrl * quantity
  const grupoTotalBrl = rates.usdBrl > 0 ? grupoTotalUsd * rates.usdBrl : 0

  return {
    priceJpy,
    priceUsd: round4(unitUsd),
    priceBrl: round2(unitBrlBase),
    unitSaleUsd: round4(unitSaleUsd),
    unitSaleBrl: round2(unitSaleBrl),
    lineSaleUsd: round4(lineSaleUsd),
    lineSaleBrl: round2(lineSaleBrl),
    fees: {
      fxMarkupUsd: round4(fxMarkupUsd),
      grupoPercentUsd: round4(grupoPercentUsd * quantity),
      grupoPerUnitUsd: round4(grupoPerUnitUsd * quantity),
      grupoTotalUsd: round4(
        channel === SALE_CHANNEL_GRUPO
          ? grupoTotalUsd || grupoPercentUsd * quantity + grupoPerUnitUsd * quantity
          : 0,
      ),
      grupoTotalBrl: round2(grupoTotalBrl),
    },
    channel,
    quantity,
    rates: {
      jpyUsdCharge: rates.jpyUsdCharge,
      usdBrl: rates.usdBrl,
      effectiveBrlPerJpy: rates.effectiveBrlPerJpy,
      wiseMarkupPercent: rates.wiseMarkupPercent,
      grupoFeePerUnitUsd: rates.grupoFeePerUnitUsd,
    },
  }
}
