import { useEffect, useMemo, useState } from 'react'

import { getSystemSettings } from '../../../../services/settingsService'

import { createCalculatorProductAdmin, updateCalculatorProductAdmin } from '../../../../services/calculatorProductService'

import { formatBRL, formatJPY } from '../../../../lib/fx'

import {

  calculateBrazilFinalPrice,

  DEFAULT_IOF_PERCENT,

  DIRECT_METHOD_EMS,

  DIRECT_METHOD_EPACKET,

  LOTE_EMS_RATE_TABLE,

  PAYMENT_GATEWAYS,

  SHIPPING_MODE_DIRETO,

  SHIPPING_MODE_LOTE,

  resolveBrlPerJpyFromSettings,

  toWeightGrams,

} from '../../../../lib/brazilPriceCalculator'

function buildCalculatorProductPayload(result, name, notes) {
  return {
    name: String(name).trim(),
    notes: String(notes || '').trim() || null,
    base_cost_yen: result.inputs.baseCostYen,
    declared_value_yen: result.inputs.declaredValueYen,
    weight_grams: result.inputs.weightGrams,
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

export default function BrazilPriceCalculatorPanel({ editingProduct = null, onCancelEdit, onRegistered }) {

  const [loadingSettings, setLoadingSettings] = useState(false)

  const [settingsError, setSettingsError] = useState('')

  const [productName, setProductName] = useState('')

  const [productNotes, setProductNotes] = useState('')

  const [baseCostYen, setBaseCostYen] = useState('')

  const [declaredValueYen, setDeclaredValueYen] = useState('')

  const [weightValue, setWeightValue] = useState('')

  const [weightUnit, setWeightUnit] = useState('g')

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

  const [stripeFeePercent, setStripeFeePercent] = useState(String(PAYMENT_GATEWAYS.stripe.defaultFeePercent))

  const [parcelowFeePercent, setParcelowFeePercent] = useState(String(PAYMENT_GATEWAYS.parcelow.defaultFeePercent))

  const [glinFeePercent, setGlinFeePercent] = useState(String(PAYMENT_GATEWAYS.glin.defaultFeePercent))

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
    const fees = inputs.paymentFeePercents || {}

    setProductName(editingProduct.name || '')
    setProductNotes(editingProduct.notes || '')
    setBaseCostYen(String(editingProduct.base_cost_yen ?? ''))
    setDeclaredValueYen(getDeclaredValueForForm(editingProduct))
    setWeightValue(String(editingProduct.weight_grams ?? ''))
    setWeightUnit('g')
    setShippingMode(editingProduct.shipping_mode === SHIPPING_MODE_DIRETO ? SHIPPING_MODE_DIRETO : SHIPPING_MODE_LOTE)
    setLoteKg(String(editingProduct.lote_kg ?? '1'))
    setDirectMethod(editingProduct.direct_method === DIRECT_METHOD_EPACKET ? DIRECT_METHOD_EPACKET : DIRECT_METHOD_EMS)
    setCustomsFactor(String(editingProduct.customs_factor ?? '2'))
    setMarginPercent(String(editingProduct.margin_percent ?? '30'))
    setPackagingBrl(String(editingProduct.packaging_brl ?? '0'))
    setLocalShippingBrl(String(editingProduct.local_shipping_brl ?? '0'))
    setApplyIof(Boolean(inputs.applyIof))
    setIofPercent(String(inputs.iofPercent ?? DEFAULT_IOF_PERCENT))
    setStripeFeePercent(String(fees.stripe ?? PAYMENT_GATEWAYS.stripe.defaultFeePercent))
    setParcelowFeePercent(String(fees.parcelow ?? PAYMENT_GATEWAYS.parcelow.defaultFeePercent))
    setGlinFeePercent(String(fees.glin ?? PAYMENT_GATEWAYS.glin.defaultFeePercent))
    setSaveFeedback('')
  }, [editingProduct])

  const resetForm = () => {
    setProductName('')
    setProductNotes('')
    setBaseCostYen('')
    setDeclaredValueYen('')
    setWeightValue('')
    setWeightUnit('g')
    setShippingMode(SHIPPING_MODE_LOTE)
    setLoteKg('1')
    setDirectMethod(DIRECT_METHOD_EMS)
    setCustomsFactor('2')
    setPackagingBrl('0')
    setLocalShippingBrl('0')
    setApplyIof(false)
    setIofPercent(String(DEFAULT_IOF_PERCENT))
    setStripeFeePercent(String(PAYMENT_GATEWAYS.stripe.defaultFeePercent))
    setParcelowFeePercent(String(PAYMENT_GATEWAYS.parcelow.defaultFeePercent))
    setGlinFeePercent(String(PAYMENT_GATEWAYS.glin.defaultFeePercent))
    setSaveFeedback('')
  }

  const handleCancelEdit = () => {
    resetForm()
    if (typeof onCancelEdit === 'function') onCancelEdit()
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

      shippingMode,

      directMethod,

      loteKg,

      customsFactor,

      brlPerJpy,

      marginPercent,

      packagingBrl,

      localShippingBrl,

      applyIof,

      iofPercent,

      paymentFeePercents: {

        stripe: stripeFeePercent,

        parcelow: parcelowFeePercent,

        glin: glinFeePercent,

      },

    })

  }, [

    baseCostYen,

    declaredValueYen,

    weightGrams,

    shippingMode,

    directMethod,

    loteKg,

    customsFactor,

    brlPerJpy,

    marginPercent,

    packagingBrl,

    localShippingBrl,

    applyIof,

    iofPercent,

    stripeFeePercent,

    parcelowFeePercent,

    glinFeePercent,

  ])



  const epacketBlocked = shippingMode === SHIPPING_MODE_DIRETO

    && directMethod === DIRECT_METHOD_EPACKET

    && weightGrams > 2000



  const canSave = result.isValid

    && String(productName).trim().length > 0

    && !epacketBlocked

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



  return (

    <div className={`mt-6 rounded-lg border bg-white p-4 ${isEditing ? 'border-amber-300' : 'border-emerald-200'}`}>

      <h3 className="text-base font-semibold text-earth-900">
        {isEditing ? `Editar produto: ${editingProduct.name}` : 'Nova simulacao'}
      </h3>

      <p className="mt-1 text-xs text-earth-600">

        Formula: (custo base + ((valor declarado + frete internacional) x fator aduaneiro)) -&gt; converte para BRL -&gt; aplica margem -&gt; soma embalagem e envio nacional -&gt; opcionalmente IOF -&gt; simula cobrança com taxas de pagamento.

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



      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

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

          Peso do produto

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

          <label className="text-xs text-earth-700">

            Taxa Stripe (%)

            <input

              type="number"

              min="0"

              step="0.01"

              value={stripeFeePercent}

              onChange={(e) => setStripeFeePercent(e.target.value)}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            />

          </label>

          <label className="text-xs text-earth-700">

            Taxa Parcelow (%)

            <input

              type="number"

              min="0"

              step="0.01"

              value={parcelowFeePercent}

              onChange={(e) => setParcelowFeePercent(e.target.value)}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            />

          </label>

          <label className="text-xs text-earth-700">

            Taxa Glin (%)

            <input

              type="number"

              min="0"

              step="0.01"

              value={glinFeePercent}

              onChange={(e) => setGlinFeePercent(e.target.value)}

              className="mt-1 block w-full rounded border border-earth-300 px-2 py-1.5 text-sm text-earth-900"

            />

          </label>

        </div>

        <p className="mt-2 text-[11px] text-earth-500">

          IOF incide sobre o preço antes do gateway. As taxas de pagamento usam gross-up: valor cobrado para você receber o valor final líquido após a taxa do processador.

        </p>

      </div>



      {(loadingSettings || settingsError || epacketBlocked) && (

        <div className="mt-3 space-y-1 text-xs">

          {loadingSettings ? <p className="text-earth-600">Carregando cotacoes do sistema...</p> : null}

          {settingsError ? <p className="text-amber-700">{settingsError}</p> : null}

          {epacketBlocked ? (

            <p className="text-red-700">ePacket permite no maximo 2kg por envio.</p>

          ) : null}

        </div>

      )}



      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">

        <div className="rounded border border-earth-200 bg-earth-50 p-3">

          <p className="text-xs text-earth-600">Frete internacional</p>

          <p className="text-lg font-semibold text-earth-900">{formatJPY(result.shipping.yen)}</p>

          <p className="mt-1 text-xs text-earth-500">Peso considerado: {result.inputs.weightGrams} g</p>

        </div>

        <div className="rounded border border-earth-200 bg-earth-50 p-3">

          <p className="text-xs text-earth-600">Custo para ter no Brasil</p>

          <p className="text-sm font-medium text-earth-900">{formatJPY(result.breakdown.landedCostYen)}</p>

          <p className="text-lg font-semibold text-earth-900">{formatBRL(result.breakdown.landedCostBrl)}</p>

        </div>

        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">

          <p className="text-xs text-emerald-700">Preco final sugerido</p>

          <p className="text-2xl font-bold text-emerald-900">{formatBRL(result.breakdown.finalBrl)}</p>

          {result.inputs.applyIof ? (

            <p className="mt-1 text-[11px] text-emerald-800/80">

              Base {formatBRL(result.breakdown.baseFinalBrl)} + IOF ({result.inputs.iofPercent}%): {formatBRL(result.breakdown.iofBrl)}

            </p>

          ) : null}

        </div>

        <div className="rounded border border-sky-200 bg-sky-50 p-3">

          <p className="text-xs text-sky-700">Lucro liquido</p>

          <p className="text-2xl font-bold text-sky-900">{formatBRL(result.breakdown.netProfitBrl)}</p>

          <p className="mt-1 text-[11px] text-sky-800/80">
            Preco final − custo para ter no Brasil
          </p>

        </div>

      </div>



      <div className="mt-4 rounded border border-violet-200 bg-violet-50 p-3">

        <p className="text-sm font-medium text-violet-900">Valor para o cliente por forma de pagamento</p>

        <p className="mt-1 text-[11px] text-violet-800/80">

          Sobre o preço final {formatBRL(result.breakdown.finalBrl)} — inclui gross-up da taxa do processador.

        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">

          {result.paymentCharges.map((charge) => (

            <div key={charge.id} className="rounded border border-violet-200 bg-white p-3">

              <p className="text-xs text-violet-700">{charge.label}</p>

              <p className="text-xl font-bold text-violet-900">{formatBRL(charge.chargeBrl)}</p>

              <p className="mt-1 text-[11px] text-violet-800/80">

                Taxa {charge.feePercent}% (+{formatBRL(charge.feeBrl)})

              </p>

            </div>

          ))}

        </div>

      </div>



      <div className="mt-4 rounded border border-earth-200 bg-white p-3 text-xs text-earth-700">

        <p>

          <strong>Breakdown:</strong> ({formatJPY(result.inputs.baseCostYen)} + (({formatJPY(result.inputs.declaredValueYen)} + {formatJPY(result.shipping.yen)}) x {result.inputs.customsFactor}))

          = {formatJPY(result.breakdown.landedCostYen)} -&gt; {formatBRL(result.breakdown.landedCostBrl)}.

        </p>

        <p className="mt-1">

          Margem ({result.inputs.marginPercent}%): +{formatBRL(result.breakdown.marginBrl)}.

        </p>

        <p className="mt-1">

          Opcionais (embalagem + envio BR): +{formatBRL(result.breakdown.extrasBrl)}.

        </p>

        {result.inputs.applyIof ? (

          <p className="mt-1">

            IOF ({result.inputs.iofPercent}%): +{formatBRL(result.breakdown.iofBrl)} sobre {formatBRL(result.breakdown.baseFinalBrl)}.

          </p>

        ) : null}

        <p className="mt-1">

          Lucro liquido: {formatBRL(result.breakdown.baseFinalBrl)} − {formatBRL(result.breakdown.landedCostBrl)} = {formatBRL(result.breakdown.netProfitBrl)}.

        </p>

        <p className="mt-1">

          Cobrança com taxas: Stripe {formatBRL(result.paymentCharges.find((c) => c.id === 'stripe')?.chargeBrl || 0)} · Parcelow {formatBRL(result.paymentCharges.find((c) => c.id === 'parcelow')?.chargeBrl || 0)} · Glin {formatBRL(result.paymentCharges.find((c) => c.id === 'glin')?.chargeBrl || 0)}.

        </p>

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


