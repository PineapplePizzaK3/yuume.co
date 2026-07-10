import { useEffect, useMemo, useState } from 'react'

import { getSystemSettings } from '../../../../services/settingsService'

import { createCalculatorProductAdmin, updateCalculatorProductAdmin } from '../../../../services/calculatorProductService'

import { formatBRL, formatJPY, formatPairFromBrl, formatPairFromYen } from '../../../../lib/fx'
import {
  calculateBrazilFinalPrice,
  DEFAULT_IOF_PERCENT,
  DIRECT_METHOD_EMS,
  DIRECT_METHOD_EPACKET,
  DIRECT_METHOD_AIRMAIL,
  LOTE_EMS_RATE_TABLE,
  PAYMENT_METHODS,
  SHIPPING_MODE_DIRETO,
  SHIPPING_MODE_LOTE,
  resolveBrlPerJpyFromSettings,
  toWeightGrams,
} from '../../../../lib/brazilPriceCalculator'

function resolveMoneyPair(yen, brl, brlPerJpy) {
  const rate = Number(brlPerJpy) || 0
  let yenVal = yen != null && yen !== '' ? Number(yen) : null
  let brlVal = brl != null && brl !== '' ? Number(brl) : null
  if ((yenVal == null || !Number.isFinite(yenVal)) && brlVal != null && Number.isFinite(brlVal) && rate > 0) {
    yenVal = brlVal / rate
  }
  if ((brlVal == null || !Number.isFinite(brlVal)) && yenVal != null && Number.isFinite(yenVal) && rate > 0) {
    brlVal = yenVal * rate
  }
  return { yenVal, brlVal }
}

function MoneyPair({ yen, brl, brlPerJpy, className = 'text-lg font-semibold text-earth-900' }) {
  const { yenVal, brlVal } = resolveMoneyPair(yen, brl, brlPerJpy)
  return (
    <>
      <p className={className}>{formatJPY(yenVal)}</p>
      <p className={className}>{formatBRL(brlVal)}</p>
    </>
  )
}

function roundMoney2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function PerItemHint({ brl, yen, brlPerJpy, quantity, className = 'mt-1 text-[11px] text-earth-500' }) {
  const qty = Math.max(1, Math.round(Number(quantity) || 1))
  if (qty <= 1) return null
  const pair = resolveMoneyPair(yen, brl, brlPerJpy)
  if (pair.brlVal == null && pair.yenVal == null) return null
  const perBrl = pair.brlVal != null ? roundMoney2(pair.brlVal / qty) : null
  const perYen = pair.yenVal != null ? Math.round(pair.yenVal / qty) : null
  return (
    <p className={className}>
      Por item:{' '}
      {perBrl != null ? formatBRL(perBrl) : null}
      {perBrl != null && perYen != null ? ' · ' : null}
      {perYen != null ? formatJPY(perYen) : null}
    </p>
  )
}

/** Exibição voltada ao cliente: BRL em destaque, JPY como referência. */
function ClientMoney({ yen, brl, brlPerJpy, size = 'md', align = 'left' }) {
  const { yenVal, brlVal } = resolveMoneyPair(yen, brl, brlPerJpy)
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  const brlClass =
    size === 'xl'
      ? 'text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl'
      : size === 'lg'
        ? 'text-2xl font-bold tracking-tight text-earth-900'
        : size === 'sm'
          ? 'text-base font-semibold text-earth-900'
        : 'text-xl font-semibold text-earth-900'
  const yenClass =
    size === 'xl'
      ? 'mt-1 text-base text-earth-500'
      : size === 'lg'
        ? 'mt-0.5 text-sm text-earth-500'
        : size === 'sm'
          ? 'mt-0.5 text-[11px] text-earth-500'
        : 'mt-0.5 text-xs text-earth-500'
  return (
    <div className={alignClass}>
      <p className={brlClass}>{formatBRL(brlVal)}</p>
      <p className={yenClass}>{formatJPY(yenVal)}</p>
    </div>
  )
}

function getPaymentMethodMeta(methodId) {
  if (methodId.startsWith('stripe_')) return { icon: '🌐', hint: 'Cartão internacional' }
  if (methodId.startsWith('parcelow_pix')) return { icon: '🇧🇷', hint: 'PIX' }
  if (methodId.startsWith('parcelow_ted')) return { icon: '🇧🇷', hint: 'TED' }
  if (methodId.startsWith('parcelow_card_')) {
    const installment = methodId.match(/parcelow_card_(\d+)x/i)?.[1]
    return { icon: '🇧🇷', hint: installment ? `Cartão ${installment}x` : 'Cartão' }
  }
  if (methodId.startsWith('glin_pix')) return { icon: '🇧🇷', hint: 'PIX' }
  if (methodId.startsWith('glin_card_')) {
    const installment = methodId.match(/glin_card_(\d+)x/i)?.[1]
    return { icon: '🇧🇷', hint: installment ? `Cartão ${installment}x` : 'Cartão' }
  }
  return { icon: '💳', hint: '' }
}

function formatInstallmentLabel(charge) {
  const installments = Math.max(0, Math.round(Number(charge?.installments) || 0))
  if (installments <= 0) return null
  const installmentBrl = Number(charge?.installmentBrl)
  const amount = Number.isFinite(installmentBrl)
    ? installmentBrl
    : (Number(charge?.chargeBrl) || 0) / installments
  return `${installments}x de ${formatBRL(amount)}`
}

function formatInstallmentPerItemLabel(charge, quantity) {
  const qty = Math.max(1, Math.round(Number(quantity) || 1))
  if (qty <= 1) return null
  const installments = Math.max(0, Math.round(Number(charge?.installments) || 0))
  if (installments <= 0) return null
  const perInstallment = roundMoney2(
    (Number.isFinite(Number(charge?.installmentBrl))
      ? Number(charge.installmentBrl)
      : (Number(charge?.chargeBrl) || 0) / installments) / qty
  )
  return `${installments}x de ${formatBRL(perInstallment)}`
}

function defaultPaymentFeeByMethod() {
  const map = {}
  for (const method of PAYMENT_METHODS) map[method.id] = String(method.defaultFeePercent)
  return map
}

function resolveLegacyFeeForMethod(method, rawFees = {}) {
  const direct = Number(rawFees?.[method.id])
  if (Number.isFinite(direct) && direct >= 0) return direct

  // Compatibilidade com formato antigo sem parcelas da Glin.
  if (method.id.startsWith('glin_card_')) {
    const legacyGlinCard = Number(rawFees?.glin_card)
    if (Number.isFinite(legacyGlinCard) && legacyGlinCard >= 0) return legacyGlinCard
  }
  // Compatibilidade com formato antigo sem parcelas da Parcelow.
  if (method.id.startsWith('parcelow_card_')) {
    const legacyParcelowCard = Number(rawFees?.parcelow_card)
    if (Number.isFinite(legacyParcelowCard) && legacyParcelowCard >= 0) return legacyParcelowCard
  }

  const byGateway = Number(rawFees?.[method.gatewayId])
  if (Number.isFinite(byGateway) && byGateway >= 0) return byGateway
  return method.defaultFeePercent
}

function normalizePaymentFeePercents(rawFees = {}) {
  const map = {}
  for (const method of PAYMENT_METHODS) {
    map[method.id] = String(resolveLegacyFeeForMethod(method, rawFees))
  }
  return map
}

const PAYMENT_GATEWAY_TITLES = {
  stripe: 'Stripe',
  parcelow: 'Parcelow',
  glin: 'Glin',
}
const PAYMENT_CATEGORY_TITLES = {
  card: 'Cartão',
  other: 'Outros',
}

function groupByGateway(items = [], getGatewayId) {
  return items.reduce((acc, item) => {
    const gatewayId = getGatewayId(item)
    if (!gatewayId) return acc
    if (!acc[gatewayId]) acc[gatewayId] = []
    acc[gatewayId].push(item)
    return acc
  }, {})
}

function summarizeGatewayCharge(charges = []) {
  if (!Array.isArray(charges) || charges.length === 0) return null
  return charges.reduce((best, current) => {
    if (!best) return current
    return Number(current?.chargeBrl || 0) < Number(best?.chargeBrl || 0) ? current : best
  }, null)
}

function resolvePaymentCategory(methodId = '') {
  if (String(methodId).includes('_card')) return 'card'
  if (String(methodId).includes('_pix') || String(methodId).includes('_ted')) return 'pix'
  return 'other'
}

function groupChargesByCategory(charges = []) {
  const groups = charges.reduce((acc, charge) => {
    const category = resolvePaymentCategory(charge?.id)
    if (!acc[category]) acc[category] = []
    acc[category].push(charge)
    return acc
  }, {})
  const order = ['pix', 'card', 'other']
  return order
    .filter((category) => Array.isArray(groups[category]) && groups[category].length > 0)
    .map((category) => {
      const categoryCharges = groups[category]
      if (category !== 'pix') {
        return { category, label: PAYMENT_CATEGORY_TITLES[category] || category, charges: categoryCharges }
      }
      const hasPix = categoryCharges.some((charge) => String(charge?.id || '').includes('_pix'))
      const hasTed = categoryCharges.some((charge) => String(charge?.id || '').includes('_ted'))
      const label = hasPix && hasTed ? 'PIX / TED' : hasTed ? 'TED' : 'PIX'
      return { category, label, charges: categoryCharges }
    })
}

function buildCalculatorProductPayload(result, name, notes) {
  return {
    name: String(name).trim(),
    notes: String(notes || '').trim() || null,
    base_cost_yen: result.inputs.unitBaseCostYen ?? result.inputs.baseCostYen,
    declared_value_yen: result.inputs.unitDeclaredValueYen ?? result.inputs.declaredValueYen,
    weight_grams: result.inputs.unitWeightGrams ?? result.inputs.weightGrams,
    shipping_mode: result.inputs.shippingMode,
    direct_method: result.inputs.shippingMode === SHIPPING_MODE_DIRETO ? result.inputs.directMethod : null,
    lote_kg: result.inputs.shippingMode === SHIPPING_MODE_LOTE ? result.inputs.loteKg : null,
    customs_factor: result.inputs.customsFactor,
    brl_per_jpy: result.inputs.brlPerJpy,
    margin_percent: result.inputs.marginPercent,
    packaging_brl: result.inputs.packagingBrl,
    local_shipping_brl: result.inputs.localShippingBrl,
    international_shipping_yen: result.shipping.yen,
    landed_cost_yen: result.breakdown.landedCostYen,
    landed_cost_brl: result.breakdown.landedCostBrl,
    final_price_brl: result.breakdown.finalBrl,
    calculation_snapshot: result,
  }
}

function getDeclaredValueForForm(product) {
  const base = Number(product?.base_cost_yen) || 0
  const declared = Number(product?.declared_value_yen) || 0
  if (declared > 0 && declared !== base) return String(declared)
  return ''
}

export default function BrazilPriceCalculatorPanel({
  viewMode = 'loja',
  editingProduct = null,
  onCancelEdit,
  onRegistered,
}) {
  const isStoreView = viewMode !== 'cliente'


  const [loadingSettings, setLoadingSettings] = useState(false)

  const [settingsError, setSettingsError] = useState('')

  const [productName, setProductName] = useState('')

  const [productNotes, setProductNotes] = useState('')

  const [baseCostYen, setBaseCostYen] = useState('')

  const [declaredValueYen, setDeclaredValueYen] = useState('')

  const [weightValue, setWeightValue] = useState('')

  const [weightUnit, setWeightUnit] = useState('g')

  const [quantity, setQuantity] = useState('1')

  const [shippingMode, setShippingMode] = useState(SHIPPING_MODE_LOTE)

  const [loteKg, setLoteKg] = useState('1')

  const [directMethod, setDirectMethod] = useState(DIRECT_METHOD_EMS)

  const [customsFactor, setCustomsFactor] = useState('2')

  const [systemSettings, setSystemSettings] = useState(null)

  const [marginPercent, setMarginPercent] = useState('30')

  const [packagingBrl, setPackagingBrl] = useState('0')

  const [localShippingBrl, setLocalShippingBrl] = useState('0')

  const [applyIof, setApplyIof] = useState(false)

  const [iofPercent, setIofPercent] = useState(String(DEFAULT_IOF_PERCENT))

  const [paymentFeePercents, setPaymentFeePercents] = useState(() => defaultPaymentFeeByMethod())
  const [clientPrintMode, setClientPrintMode] = useState(false)

  const [saving, setSaving] = useState(false)

  const [saveFeedback, setSaveFeedback] = useState('')

  const isEditing = Boolean(editingProduct?.id)

  useEffect(() => {
    if (!editingProduct?.id) return

    const snap = (() => {
      const raw = editingProduct.calculation_snapshot
      if (!raw) return {}
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw)
        } catch {
          return {}
        }
      }
      return raw
    })()
    const inputs = snap.inputs || {}
    setProductName(editingProduct.name || '')
    setProductNotes(editingProduct.notes || '')
    setBaseCostYen(String(editingProduct.base_cost_yen ?? ''))
    setDeclaredValueYen(getDeclaredValueForForm(editingProduct))
    setWeightValue(String(editingProduct.weight_grams ?? ''))
    setWeightUnit('g')
    setQuantity(String(inputs.quantity ?? '1'))
    setShippingMode(editingProduct.shipping_mode === SHIPPING_MODE_DIRETO ? SHIPPING_MODE_DIRETO : SHIPPING_MODE_LOTE)
    setLoteKg(String(editingProduct.lote_kg ?? '1'))
    setDirectMethod(
      editingProduct.direct_method === DIRECT_METHOD_EPACKET
        ? DIRECT_METHOD_EPACKET
        : editingProduct.direct_method === DIRECT_METHOD_AIRMAIL
          ? DIRECT_METHOD_AIRMAIL
          : DIRECT_METHOD_EMS
    )
    setCustomsFactor(String(editingProduct.customs_factor ?? '2'))
    setMarginPercent(String(editingProduct.margin_percent ?? '30'))
    setPackagingBrl(String(editingProduct.packaging_brl ?? '0'))
    setLocalShippingBrl(String(editingProduct.local_shipping_brl ?? '0'))
    setApplyIof(Boolean(inputs.applyIof))
    setIofPercent(String(inputs.iofPercent ?? DEFAULT_IOF_PERCENT))
    setPaymentFeePercents(normalizePaymentFeePercents(inputs.paymentFeePercents || {}))
    setSaveFeedback('')
  }, [editingProduct])

  const resetForm = () => {
    setProductName('')
    setProductNotes('')
    setBaseCostYen('')
    setDeclaredValueYen('')
    setWeightValue('')
    setWeightUnit('g')
    setQuantity('1')
    setShippingMode(SHIPPING_MODE_LOTE)
    setLoteKg('1')
    setDirectMethod(DIRECT_METHOD_EMS)
    setCustomsFactor('2')
    setPackagingBrl('0')
    setLocalShippingBrl('0')
    setApplyIof(false)
    setIofPercent(String(DEFAULT_IOF_PERCENT))
    setPaymentFeePercents(defaultPaymentFeeByMethod())
    setSaveFeedback('')
  }

  const handleCancelEdit = () => {
    resetForm()
    if (typeof onCancelEdit === 'function') onCancelEdit()
  }

  const setPaymentFeePercent = (methodId, value) => {
    setPaymentFeePercents((prev) => ({ ...prev, [methodId]: value }))
  }



  useEffect(() => {

    let active = true

    const load = async () => {

      setLoadingSettings(true)

      setSettingsError('')

      const { data, error } = await getSystemSettings()

      if (!active) return

      if (error) {

        setSettingsError(error.message || 'Nao foi possivel carregar cotacoes.')

      } else {

        setSystemSettings(data || {})

        const margin = Number(data?.pricing_margin_percent?.amount)

        if (margin >= 0) {

          setMarginPercent((prev) => (String(prev).trim() ? prev : String(margin)))

        }

      }

      setLoadingSettings(false)

    }

    void load()

    return () => { active = false }

  }, [])



  const weightGrams = useMemo(

    () => toWeightGrams(weightValue, weightUnit),

    [weightValue, weightUnit],

  )

  const brlPerJpy = useMemo(
    () => resolveBrlPerJpyFromSettings(systemSettings || {}),
    [systemSettings],
  )

  const jpyUsd = Number(systemSettings?.fx_jpy_usd?.amount)
  const usdBrl = Number(systemSettings?.fx_usd_brl?.amount)
  const fxSourceIsCross = Number.isFinite(jpyUsd) && jpyUsd > 0 && Number.isFinite(usdBrl) && usdBrl > 0



  const result = useMemo(() => {

    return calculateBrazilFinalPrice({

      baseCostYen,

      declaredValueYen,

      weightGrams,

      quantity,

      shippingMode,

      directMethod,

      loteKg,

      customsFactor,

      brlPerJpy,

      usdBrl,

      marginPercent,

      packagingBrl,

      localShippingBrl,

      applyIof,

      iofPercent,

      paymentFeePercents,

    })

  }, [

    baseCostYen,

    declaredValueYen,

    weightGrams,

    quantity,

    shippingMode,

    directMethod,

    loteKg,

    customsFactor,

    brlPerJpy,

    usdBrl,

    marginPercent,

    packagingBrl,

    localShippingBrl,

    applyIof,

    iofPercent,

    paymentFeePercents,

  ])



  const epacketBlocked = shippingMode === SHIPPING_MODE_DIRETO
    && directMethod === DIRECT_METHOD_EPACKET
    && (weightGrams * Math.max(1, Math.round(Number(quantity) || 1))) > 2000

  const airmailBlocked = shippingMode === SHIPPING_MODE_DIRETO
    && directMethod === DIRECT_METHOD_AIRMAIL
    && (weightGrams * Math.max(1, Math.round(Number(quantity) || 1))) > 30000

  const canSave = result.isValid
    && String(productName).trim().length > 0
    && !epacketBlocked
    && !airmailBlocked
    && !saving



  const handleSave = async () => {

    if (!canSave) return

    setSaving(true)

    setSaveFeedback('')

    const payload = buildCalculatorProductPayload(result, productName, productNotes)

    const { error } = isEditing
      ? await updateCalculatorProductAdmin(editingProduct.id, payload)
      : await createCalculatorProductAdmin(payload)

    if (error) {

      setSaveFeedback(error.message || (isEditing ? 'Falha ao atualizar produto.' : 'Falha ao cadastrar produto.'))

    } else {

      setSaveFeedback(isEditing ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')

      resetForm()

      if (typeof onRegistered === 'function') onRegistered()

      if (isEditing && typeof onCancelEdit === 'function') onCancelEdit()

    }

    setSaving(false)

  }



  const shippingModeLabel = shippingMode === SHIPPING_MODE_LOTE
    ? `Lote fechado EMS (${loteKg} kg)`
    : directMethod === DIRECT_METHOD_EPACKET
      ? 'Envio direto · ePacket'
      : directMethod === DIRECT_METHOD_AIRMAIL
        ? 'Envio direto · Airmail'
        : 'Envio direto · EMS'

  const productDisplayName = String(productName).trim() || 'Produto sem nome'
  const productDisplayNotes = String(productNotes).trim()
  const paymentMethodsByGateway = useMemo(
    () => groupByGateway(PAYMENT_METHODS, (method) => method.gatewayId),
    []
  )
  const paymentChargesByGateway = useMemo(
    () => groupByGateway(result.paymentCharges || [], (charge) => charge.gatewayId),
    [result.paymentCharges]
  )

  if (!isStoreView) {
    const qty = Math.max(1, Number(result.inputs.quantity) || 1)
    const weightLabel = result.inputs.weightGrams >= 1000
      ? `${(result.inputs.weightGrams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
      : `${result.inputs.weightGrams} g`
    const unitWeightLabel = result.inputs.unitWeightGrams >= 1000
      ? `${(result.inputs.unitWeightGrams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
      : `${result.inputs.unitWeightGrams} g`

    return (
      <div className={`mt-6 rounded-lg border border-earth-200 bg-white ${clientPrintMode ? 'p-2.5' : 'p-3.5'}`}>
        {!result.isValid || epacketBlocked || airmailBlocked ? (
          <p className="text-sm text-earth-600">
            Configure a simulação na visão loja ou selecione um produto na lista para gerar o resumo do cliente.
          </p>
        ) : (
          <div className={clientPrintMode ? 'space-y-2' : 'space-y-3'}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`${clientPrintMode ? 'text-base' : 'text-lg'} truncate font-semibold text-earth-900`}>{productDisplayName}</h3>
                {!clientPrintMode && productDisplayNotes ? (
                  <p className="mt-1 text-sm text-earth-600">{productDisplayNotes}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setClientPrintMode((prev) => !prev)}
                className="shrink-0 rounded border border-earth-300 bg-white px-2 py-1 text-[11px] font-medium text-earth-700 hover:bg-earth-50"
              >
                {clientPrintMode ? 'Modo normal' : 'Modo print'}
              </button>
            </div>

            <div className={`grid ${clientPrintMode ? 'gap-1.5 md:grid-cols-5' : 'gap-3 md:grid-cols-2 xl:grid-cols-5'}`}>
              <div className={`rounded border border-earth-200 bg-earth-50 ${clientPrintMode ? 'p-2' : 'p-3'}`}>
                <p className="text-xs text-earth-500">Quantidade</p>
                <p className={`${clientPrintMode ? 'mt-0.5 text-sm' : 'mt-1'} font-medium text-earth-900`}>{qty}</p>
              </div>
              <div className={`rounded border border-earth-200 bg-earth-50 ${clientPrintMode ? 'p-2' : 'p-3'}`}>
                <p className="text-xs text-earth-500">Peso total</p>
                <p className={`${clientPrintMode ? 'mt-0.5 text-sm' : 'mt-1'} font-medium text-earth-900`}>{weightLabel}</p>
                {!clientPrintMode && qty > 1 ? (
                  <p className="mt-0.5 text-[11px] text-earth-500">{qty} × {unitWeightLabel}</p>
                ) : null}
              </div>
              <div className={`rounded border border-earth-200 bg-earth-50 ${clientPrintMode ? 'p-2' : 'p-3'}`}>
                <p className="text-xs text-earth-500">Envio</p>
                <p className={`${clientPrintMode ? 'mt-0.5 text-sm' : 'mt-1'} font-medium text-earth-900`}>{shippingModeLabel}</p>
              </div>
              <div className={`rounded border border-earth-200 bg-earth-50 ${clientPrintMode ? 'p-2' : 'p-3'}`}>
                <p className="text-xs text-earth-500">Frete internacional</p>
                <ClientMoney yen={result.shipping.yen} brlPerJpy={brlPerJpy} size={clientPrintMode ? 'sm' : 'md'} />
              </div>
              <div className={`rounded border border-earth-200 bg-earth-50 ${clientPrintMode ? 'p-2' : 'p-3'}`}>
                <p className="text-xs text-earth-500">Embalagem / envio nacional</p>
                <ClientMoney brl={result.breakdown.extrasBrl} brlPerJpy={brlPerJpy} size={clientPrintMode ? 'sm' : 'md'} />
              </div>
            </div>

            <div className={`rounded border border-emerald-200 bg-emerald-50 ${clientPrintMode ? 'p-2.5' : 'p-4'}`}>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Preço final</p>
              <ClientMoney
                brl={result.breakdown.finalBrl}
                brlPerJpy={brlPerJpy}
                size={clientPrintMode ? 'md' : 'lg'}
              />
              <PerItemHint
                brl={result.breakdown.finalBrl}
                brlPerJpy={brlPerJpy}
                quantity={qty}
                className={`mt-1 ${clientPrintMode ? 'text-[10px]' : 'text-[11px]'} text-emerald-800/80`}
              />
              {!clientPrintMode && result.inputs.applyIof ? (
                <p className="mt-1 text-xs text-emerald-800/80">
                  Inclui IOF de {result.inputs.iofPercent}%
                </p>
              ) : null}
            </div>

            <div className={`rounded border border-violet-200 bg-violet-50 ${clientPrintMode ? 'p-2' : 'p-2.5'}`}>
              <p className="text-xs uppercase tracking-wide text-violet-700">Formas de pagamento</p>
              <div className={`mt-2 grid ${clientPrintMode ? 'gap-1 md:grid-cols-3' : 'gap-1.5 md:grid-cols-3'}`}>
                {Object.entries(paymentChargesByGateway).map(([gatewayId, charges]) => {
                  const cheapest = summarizeGatewayCharge(charges)
                  return (
                    <details key={gatewayId} className={`rounded border border-violet-200 bg-white ${clientPrintMode ? 'p-1.5' : 'p-2'}`}>
                      <summary className="cursor-pointer list-none">
                        <div className={clientPrintMode ? 'space-y-0' : 'space-y-0.5'}>
                          <p className="text-[11px] uppercase tracking-wide text-violet-700">
                            {PAYMENT_GATEWAY_TITLES[gatewayId] || gatewayId}
                          </p>
                          {cheapest ? (
                            <>
                              <ClientMoney brl={cheapest.chargeBrl} brlPerJpy={brlPerJpy} size="sm" />
                              <PerItemHint
                                brl={cheapest.chargeBrl}
                                brlPerJpy={brlPerJpy}
                                quantity={qty}
                                className="text-[10px] text-earth-500"
                              />
                            </>
                          ) : null}
                          {!clientPrintMode ? (
                            <div>
                              <p className="text-[11px] text-earth-500">
                                {charges.length} opção(ões)
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </summary>
                      <div className={`border-t border-violet-100 ${clientPrintMode ? 'mt-1 space-y-1 pt-1' : 'mt-2 space-y-1 pt-1.5'}`}>
                        {groupChargesByCategory(charges).map((categoryGroup) => (
                          <div key={`${gatewayId}-${categoryGroup.category}`} className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                              {categoryGroup.label}
                            </p>
                            {categoryGroup.charges.map((charge) => {
                              const meta = getPaymentMethodMeta(charge.id)
                              const installmentLabel = formatInstallmentLabel(charge)
                              const installmentPerItem = formatInstallmentPerItemLabel(charge, qty)
                              return (
                                <div key={charge.id} className={`flex items-center justify-between gap-2 rounded border border-violet-200 bg-violet-50/50 ${clientPrintMode ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-earth-900">
                                      {meta.icon} {meta.hint || charge.label}
                                    </p>
                                  </div>
                                  {installmentLabel ? (
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-earth-900">{installmentLabel}</p>
                                      {!clientPrintMode ? (
                                        <p className="text-[11px] text-earth-500">Total {formatBRL(charge.chargeBrl)}</p>
                                      ) : null}
                                      {installmentPerItem ? (
                                        <p className="text-[10px] text-earth-500">Por item: {installmentPerItem}</p>
                                      ) : (
                                        <PerItemHint
                                          brl={charge.chargeBrl}
                                          brlPerJpy={brlPerJpy}
                                          quantity={qty}
                                          className="text-[10px] text-earth-500"
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-right">
                                      <ClientMoney brl={charge.chargeBrl} brlPerJpy={brlPerJpy} size="sm" align="right" />
                                      <PerItemHint
                                        brl={charge.chargeBrl}
                                        brlPerJpy={brlPerJpy}
                                        quantity={qty}
                                        className="text-[10px] text-earth-500"
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (

    <div className={`mt-6 rounded-lg border bg-white p-4 ${isEditing ? 'border-amber-300' : 'border-emerald-200'}`}>

      <h3 className="text-base font-semibold text-earth-900">
        {isEditing ? `Editar produto: ${editingProduct.name}` : 'Nova simulacao (visao loja)'}
      </h3>

      <p className="mt-1 text-xs text-earth-600">
        Formula: (custo base + ((valor declarado + frete internacional) x fator aduaneiro)) -&gt; converte para BRL -&gt; margem apenas sobre o custo base -&gt; soma embalagem e envio nacional -&gt; opcionalmente IOF -&gt; simula cobranca com taxas de pagamento.
      </p>



      <div className="mt-4 grid gap-3 md:grid-cols-2">

        <label className="text-xs text-earth-700">

          Nome do produto *

          <input

            type="text"

            value={productName}

            onChange={(e) => setProductName(e.target.value)}

            placeholder="Ex.: Figure Banpresto 15cm"

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Observacoes (opcional)

          <input

            type="text"

            value={productNotes}

            onChange={(e) => setProductNotes(e.target.value)}

            placeholder="SKU, fornecedor, link..."

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

      </div>



      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">

        <label className="text-xs text-earth-700">

          Custo base (JPY)

          <input

            type="number"

            min="0"

            step="1"

            value={baseCostYen}

            onChange={(e) => setBaseCostYen(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Valor declarado (JPY)

          <input

            type="number"

            min="0"

            step="1"

            value={declaredValueYen}

            onChange={(e) => setDeclaredValueYen(e.target.value)}

            placeholder="se vazio, usa custo base"

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Peso do produto (unitário)

          <div className="mt-1 flex gap-2">

            <input

              type="number"

              min="0"

              step={weightUnit === 'kg' ? '0.001' : '1'}

              value={weightValue}

              onChange={(e) => setWeightValue(e.target.value)}

              className="block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            />

            <select

              value={weightUnit}

              onChange={(e) => setWeightUnit(e.target.value)}

              className="rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            >

              <option value="g">g</option>

              <option value="kg">kg</option>

            </select>

          </div>

        </label>

        <label className="text-xs text-earth-700">

          Quantidade

          <input

            type="number"

            min="1"

            step="1"

            value={quantity}

            onChange={(e) => setQuantity(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Margem (%)

          <input

            type="number"

            min="0"

            step="0.01"

            value={marginPercent}

            onChange={(e) => setMarginPercent(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

      </div>



      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

        <label className="text-xs text-earth-700">

          Modo de envio internacional

          <select

            value={shippingMode}

            onChange={(e) => setShippingMode(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          >

            <option value={SHIPPING_MODE_LOTE}>Lote fechado (rateio por grama)</option>

            <option value={SHIPPING_MODE_DIRETO}>Direto para cliente</option>

          </select>

        </label>



        {shippingMode === SHIPPING_MODE_LOTE ? (

          <label className="text-xs text-earth-700">

            Peso do lote (EMS)

            <select

              value={loteKg}

              onChange={(e) => setLoteKg(e.target.value)}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            >

              {LOTE_EMS_RATE_TABLE.map((row) => (

                <option key={row.loteKg} value={row.loteKg}>

                  {row.loteKg} kg - {row.costPerGramYen} JPY/g

                </option>

              ))}

            </select>

          </label>

        ) : (

          <label className="text-xs text-earth-700">

            Metodo direto

            <select

              value={directMethod}

              onChange={(e) => setDirectMethod(e.target.value)}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            >

              <option value={DIRECT_METHOD_EMS}>EMS</option>

              <option value={DIRECT_METHOD_AIRMAIL}>Airmail (ate 30kg)</option>

              <option value={DIRECT_METHOD_EPACKET}>ePacket (ate 2kg)</option>

            </select>

          </label>

        )}



        <label className="text-xs text-earth-700">

          Fator aduaneiro

          <input

            type="number"

            min="0"

            step="0.01"

            value={customsFactor}

            onChange={(e) => setCustomsFactor(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Cotacao BRL por 1 JPY (automatica)

          <input

            type="number"

            min="0.0000001"

            step="0.000001"

            value={brlPerJpy}

            readOnly

            className="mt-1 block w-full rounded border border-earth-300 bg-earth-50 px-2 py-1.5 text-sm text-earth-900"

          />
          <p className="mt-1 text-[11px] text-earth-500">
            {fxSourceIsCross
              ? `Calculada por cruzamento: JPY/USD (${jpyUsd}) x USD/BRL (${usdBrl}).`
              : 'Usando fallback fx_brl_per_jpy do system_settings.'}
          </p>

        </label>

      </div>



      <div className="mt-4 grid gap-3 md:grid-cols-2">

        <label className="text-xs text-earth-700">

          Embalagem (BRL) - opcional

          <input

            type="number"

            min="0"

            step="0.01"

            value={packagingBrl}

            onChange={(e) => setPackagingBrl(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

        <label className="text-xs text-earth-700">

          Envio nacional BR (BRL) - opcional

          <input

            type="number"

            min="0"

            step="0.01"

            value={localShippingBrl}

            onChange={(e) => setLocalShippingBrl(e.target.value)}

            className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

          />

        </label>

      </div>



      <div className="mt-4 rounded border border-earth-200 bg-earth-50 p-3">

        <p className="text-sm font-medium text-earth-900">IOF e taxas de pagamento</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <label className="flex items-center gap-2 text-xs text-earth-700">

            <input

              type="checkbox"

              checked={applyIof}

              onChange={(e) => setApplyIof(e.target.checked)}

              className="rounded border-earth-300"

            />

            Incluir IOF no valor final

          </label>

          <label className="text-xs text-earth-700">

            IOF (%)

            <input

              type="number"

              min="0"

              step="0.01"

              value={iofPercent}

              onChange={(e) => setIofPercent(e.target.value)}

              disabled={!applyIof}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900 disabled:bg-earth-100"

            />

          </label>

        </div>

        <div className="mt-3 space-y-2">
          {Object.entries(paymentMethodsByGateway).map(([gatewayId, methods]) => (
            <details key={gatewayId} className="rounded border border-earth-200 bg-white px-3 py-2">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-earth-900">
                    {PAYMENT_GATEWAY_TITLES[gatewayId] || gatewayId}
                  </p>
                  <p className="text-xs text-earth-500">{methods.length} taxa(s)</p>
                </div>
              </summary>
              <div className="mt-2 grid gap-2 border-t border-earth-100 pt-2 md:grid-cols-2 xl:grid-cols-3">
                {methods.map((method) => (
                  <label key={method.id} className="text-xs text-earth-700">
                    {method.label} (%)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentFeePercents[method.id] || ''}
                      onChange={(e) => setPaymentFeePercent(method.id, e.target.value)}
                      className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                    />
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-earth-500">

          IOF incide sobre o preço antes do gateway. As taxas de pagamento usam gross-up: valor cobrado para você receber o valor final líquido após a taxa do processador.

        </p>

      </div>



      {(loadingSettings || settingsError || epacketBlocked || airmailBlocked) && (

        <div className="mt-3 space-y-1 text-xs">

          {loadingSettings ? <p className="text-earth-600">Carregando cotacoes do sistema...</p> : null}

          {settingsError ? <p className="text-amber-700">{settingsError}</p> : null}

          {epacketBlocked ? (

            <p className="text-red-700">ePacket permite no maximo 2kg por envio.</p>

          ) : null}

          {airmailBlocked ? (

            <p className="text-red-700">Airmail permite no maximo 30kg por envio.</p>

          ) : null}

        </div>

      )}



      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">

        <div className="rounded border border-earth-200 bg-earth-50 p-3">

          <p className="text-xs text-earth-600">Frete internacional</p>

          <MoneyPair yen={result.shipping.yen} brlPerJpy={brlPerJpy} />

          <p className="mt-1 text-xs text-earth-500">
            Peso total: {result.inputs.weightGrams} g
            {result.inputs.quantity > 1
              ? ` (${result.inputs.quantity} × ${result.inputs.unitWeightGrams} g)`
              : ''}
          </p>

        </div>

        <div className="rounded border border-amber-200 bg-amber-50 p-3">

          <p className="text-xs text-amber-700">Antes dos impostos alfandegarios</p>

          <MoneyPair
            yen={result.breakdown.beforeTaxYen}
            brl={result.breakdown.beforeTaxBrl}
            brlPerJpy={brlPerJpy}
          />
          <PerItemHint
            yen={result.breakdown.beforeTaxYen}
            brl={result.breakdown.beforeTaxBrl}
            brlPerJpy={brlPerJpy}
            quantity={result.inputs.quantity}
            className="mt-1 text-[11px] text-amber-800/80"
          />

          <p className="mt-1 text-[11px] text-amber-800/80">
            Custo base + frete + margem
            {result.inputs.applyIof
              ? ` + IOF (${result.inputs.iofPercent}%)`
              : ''}
          </p>

        </div>

        <div className="rounded border border-earth-200 bg-earth-50 p-3">

          <p className="text-xs text-earth-600">Custo para ter no Brasil</p>

          <MoneyPair yen={result.breakdown.landedCostYen} brl={result.breakdown.landedCostBrl} brlPerJpy={brlPerJpy} />
          <PerItemHint
            yen={result.breakdown.landedCostYen}
            brl={result.breakdown.landedCostBrl}
            brlPerJpy={brlPerJpy}
            quantity={result.inputs.quantity}
          />

          <p className="mt-1 text-[11px] text-earth-500">
            Com impostos alfandegarios (fator {result.inputs.customsFactor})
          </p>

        </div>

        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">

          <p className="text-xs text-emerald-700">Preco final sugerido</p>

          <MoneyPair
            brl={result.breakdown.finalBrl}
            brlPerJpy={brlPerJpy}
            className="text-xl font-bold text-emerald-900"
          />
          <PerItemHint
            brl={result.breakdown.finalBrl}
            brlPerJpy={brlPerJpy}
            quantity={result.inputs.quantity}
            className="mt-1 text-[11px] text-emerald-800/80"
          />

          {result.inputs.applyIof ? (

            <p className="mt-1 text-[11px] text-emerald-800/80">

              Base {formatPairFromBrl(result.breakdown.baseFinalBrl, brlPerJpy)} + IOF ({result.inputs.iofPercent}%): {formatPairFromBrl(result.breakdown.iofBrl, brlPerJpy)}

            </p>

          ) : null}

        </div>

        <div className="rounded border border-sky-200 bg-sky-50 p-3">

          <p className="text-xs text-sky-700">Lucro liquido</p>

          <MoneyPair
            brl={result.breakdown.netProfitBrl}
            brlPerJpy={brlPerJpy}
            className="text-xl font-bold text-sky-900"
          />
          <PerItemHint
            brl={result.breakdown.netProfitBrl}
            brlPerJpy={brlPerJpy}
            quantity={result.inputs.quantity}
            className="mt-1 text-[11px] text-sky-800/80"
          />

          <p className="mt-1 text-[11px] text-sky-800/80">
            Preco final − custo para ter no Brasil
          </p>

        </div>

      </div>



      <div className="mt-4 rounded border border-violet-200 bg-violet-50 p-3">

        <p className="text-sm font-medium text-violet-900">Valor para o cliente por forma de pagamento</p>

        <p className="mt-1 text-[11px] text-violet-800/80">

          Sobre o preço final {formatPairFromBrl(result.breakdown.finalBrl, brlPerJpy)} — inclui gross-up da taxa do processador.

        </p>

        <div className="mt-3 space-y-2">
          {Object.entries(paymentChargesByGateway).map(([gatewayId, charges]) => {
            const cheapest = summarizeGatewayCharge(charges)
            return (
              <details key={gatewayId} className="rounded border border-violet-200 bg-white p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-violet-900">
                        {PAYMENT_GATEWAY_TITLES[gatewayId] || gatewayId}
                      </p>
                      <p className="text-xs text-violet-800/80">
                        {charges.length} método(s)
                        {cheapest ? ` · menor valor em ${cheapest.label}` : ''}
                      </p>
                    </div>
                    {cheapest ? (
                      <div className="text-right">
                        <MoneyPair
                          brl={cheapest.chargeBrl}
                          brlPerJpy={brlPerJpy}
                          className="text-base font-bold text-violet-900"
                        />
                        <PerItemHint
                          brl={cheapest.chargeBrl}
                          brlPerJpy={brlPerJpy}
                          quantity={result.inputs.quantity}
                          className="mt-0.5 text-[11px] text-violet-800/80"
                        />
                      </div>
                    ) : null}
                  </div>
                </summary>
                <div className="mt-2 space-y-2 border-t border-violet-100 pt-2">
                  {groupChargesByCategory(charges).map((categoryGroup) => (
                    <div key={`${gatewayId}-${categoryGroup.category}`}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                        {categoryGroup.label}
                      </p>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {categoryGroup.charges.map((charge) => {
                          const installmentLabel = formatInstallmentLabel(charge)
                          const installmentPerItem = formatInstallmentPerItemLabel(charge, result.inputs.quantity)
                          return (
                            <div key={charge.id} className="rounded border border-violet-200 bg-violet-50/40 p-2">
                              <p className="text-xs text-violet-700">{charge.label}</p>
                              {installmentLabel ? (
                                <>
                                  <p className="text-base font-bold text-violet-900">{installmentLabel}</p>
                                  <p className="text-[11px] text-violet-800/80">
                                    Total {formatPairFromBrl(charge.chargeBrl, brlPerJpy)}
                                  </p>
                                  {installmentPerItem ? (
                                    <p className="text-[11px] text-violet-800/80">Por item: {installmentPerItem}</p>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <MoneyPair
                                    brl={charge.chargeBrl}
                                    brlPerJpy={brlPerJpy}
                                    className="text-base font-bold text-violet-900"
                                  />
                                  <PerItemHint
                                    brl={charge.chargeBrl}
                                    brlPerJpy={brlPerJpy}
                                    quantity={result.inputs.quantity}
                                    className="mt-0.5 text-[11px] text-violet-800/80"
                                  />
                                </>
                              )}
                              <p className="mt-1 text-[11px] text-violet-800/80">
                                Taxa {charge.feePercent}%
                                {charge.fixedFeeUsd > 0 ? ` + fixo ${charge.fixedFeeUsd.toFixed(2)} USD` : ''}
                                {' '}
                                (+{formatPairFromBrl(charge.feeBrl, brlPerJpy)})
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>

      </div>



      <div className="mt-4 rounded border border-earth-200 bg-white p-3">
        <p className="text-sm font-semibold text-earth-900">Breakdown do preço</p>
        <p className="mt-1 text-xs text-earth-600">
          Leitura em etapas: antes da alfândega → custo no Brasil → margem/extras → IOF → cobrança por gateway.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded border border-amber-200 bg-amber-50 p-2">
            <p className="text-[11px] uppercase tracking-wide text-amber-700">1) Antes da alfândega</p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              {formatPairFromBrl(result.breakdown.beforeTaxBrl, brlPerJpy)}
            </p>
            <PerItemHint
              brl={result.breakdown.beforeTaxBrl}
              brlPerJpy={brlPerJpy}
              quantity={result.inputs.quantity}
              className="mt-0.5 text-[11px] text-amber-800/80"
            />
          </div>
          <div className="rounded border border-earth-200 bg-earth-50 p-2">
            <p className="text-[11px] uppercase tracking-wide text-earth-500">2) Custo no Brasil</p>
            <p className="mt-1 text-sm font-semibold text-earth-900">
              {formatPairFromBrl(result.breakdown.landedCostBrl, brlPerJpy)}
            </p>
            <PerItemHint
              brl={result.breakdown.landedCostBrl}
              brlPerJpy={brlPerJpy}
              quantity={result.inputs.quantity}
            />
          </div>
          <div className="rounded border border-earth-200 bg-earth-50 p-2">
            <p className="text-[11px] uppercase tracking-wide text-earth-500">3) Margem + extras</p>
            <p className="mt-1 text-sm font-semibold text-earth-900">
              +{formatPairFromBrl(result.breakdown.marginBrl + result.breakdown.extrasBrl, brlPerJpy)}
            </p>
            <PerItemHint
              brl={result.breakdown.marginBrl + result.breakdown.extrasBrl}
              brlPerJpy={brlPerJpy}
              quantity={result.inputs.quantity}
            />
          </div>
          <div className="rounded border border-earth-200 bg-earth-50 p-2">
            <p className="text-[11px] uppercase tracking-wide text-earth-500">4) IOF</p>
            <p className="mt-1 text-sm font-semibold text-earth-900">
              {result.inputs.applyIof
                ? `+${formatPairFromBrl(result.breakdown.iofBrl, brlPerJpy)}`
                : 'Não aplicado'}
            </p>
            {result.inputs.applyIof ? (
              <PerItemHint
                brl={result.breakdown.iofBrl}
                brlPerJpy={brlPerJpy}
                quantity={result.inputs.quantity}
              />
            ) : null}
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700">5) Preço final</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              {formatPairFromBrl(result.breakdown.finalBrl, brlPerJpy)}
            </p>
            <PerItemHint
              brl={result.breakdown.finalBrl}
              brlPerJpy={brlPerJpy}
              quantity={result.inputs.quantity}
              className="mt-0.5 text-[11px] text-emerald-800/80"
            />
          </div>
        </div>

        <details className="mt-3 rounded border border-earth-200 bg-earth-50 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-earth-800">
            Ver fórmula detalhada
          </summary>
          <div className="mt-2 space-y-1 text-xs text-earth-700">
            <p>
              Antes dos impostos alfandegarios: custo base {formatPairFromYen(result.inputs.baseCostYen, brlPerJpy)} + frete internacional {formatPairFromYen(result.shipping.yen, brlPerJpy)} + margem ({result.inputs.marginPercent}% sobre custo base = {formatPairFromBrl(result.breakdown.marginBrl, brlPerJpy)})
              {result.inputs.applyIof
                ? ` + IOF (${result.inputs.iofPercent}% sobre ${formatPairFromBrl(result.breakdown.beforeTaxBaseBrl, brlPerJpy)} = ${formatPairFromBrl(result.breakdown.beforeTaxIofBrl, brlPerJpy)})`
                : ''}
              = {formatPairFromYen(result.breakdown.beforeTaxYen, brlPerJpy)}.
            </p>
            <p>
              Custo no Brasil (com alfândega): (Custo base {formatPairFromYen(result.inputs.baseCostYen, brlPerJpy)} + ((Declarado {formatPairFromYen(result.inputs.declaredValueYen, brlPerJpy)} + Frete internacional {formatPairFromYen(result.shipping.yen, brlPerJpy)}) × fator aduaneiro {result.inputs.customsFactor}))
              = {formatPairFromYen(result.breakdown.landedCostYen, brlPerJpy)}.
            </p>
            <p>
              Margem ({result.inputs.marginPercent}% sobre custo base {formatPairFromBrl(result.breakdown.baseCostBrl, brlPerJpy)}): +{formatPairFromBrl(result.breakdown.marginBrl, brlPerJpy)}.
            </p>
            <p>
              Opcionais (embalagem + envio BR): +{formatPairFromBrl(result.breakdown.extrasBrl, brlPerJpy)}.
            </p>
            {result.inputs.applyIof ? (
              <p>
                IOF ({result.inputs.iofPercent}%): +{formatPairFromBrl(result.breakdown.iofBrl, brlPerJpy)} sobre {formatPairFromBrl(result.breakdown.baseFinalBrl, brlPerJpy)}.
              </p>
            ) : null}
            <p>
              Lucro liquido: {formatPairFromBrl(result.breakdown.baseFinalBrl, brlPerJpy)} − {formatPairFromBrl(result.breakdown.landedCostBrl, brlPerJpy)} = {formatPairFromBrl(result.breakdown.netProfitBrl, brlPerJpy)}.
            </p>
          </div>
        </details>

        <div className="mt-3 rounded border border-violet-200 bg-violet-50 p-2">
          <p className="text-xs font-semibold text-violet-900">Cobrança por gateway (menor valor)</p>
          <div className="mt-1 grid gap-2 md:grid-cols-3">
            {Object.entries(paymentChargesByGateway).map(([gatewayId, charges]) => {
              const cheapest = summarizeGatewayCharge(charges)
              if (!cheapest) return null
              return (
                <div key={gatewayId} className="rounded border border-violet-200 bg-white p-2">
                  <p className="text-[11px] text-violet-700">{PAYMENT_GATEWAY_TITLES[gatewayId] || gatewayId}</p>
                  <p className="text-sm font-semibold text-violet-900">
                    {formatPairFromBrl(cheapest.chargeBrl, brlPerJpy)}
                  </p>
                  <PerItemHint
                    brl={cheapest.chargeBrl}
                    brlPerJpy={brlPerJpy}
                    quantity={result.inputs.quantity}
                    className="mt-0.5 text-[11px] text-violet-800/80"
                  />
                  <p className="text-[11px] text-violet-800/80">{cheapest.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>



      <div className="mt-4 flex flex-wrap items-center gap-3">

        <button

          type="button"

          onClick={() => void handleSave()}

          disabled={!canSave}

          className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-800 disabled:cursor-not-allowed disabled:opacity-50"

        >

          {saving
            ? (isEditing ? 'Salvando...' : 'Cadastrando...')
            : (isEditing ? 'Salvar alteracoes' : 'Cadastrar produto')}

        </button>

        {isEditing ? (
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saving}
            className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-semibold text-earth-700 hover:bg-earth-50 disabled:opacity-50"
          >
            Cancelar edicao
          </button>
        ) : null}

        {saveFeedback ? (

          <p className={`text-sm ${/sucesso/i.test(saveFeedback) ? 'text-emerald-700' : 'text-red-700'}`}>

            {saveFeedback}

          </p>

        ) : null}

      </div>

    </div>

  )

}


