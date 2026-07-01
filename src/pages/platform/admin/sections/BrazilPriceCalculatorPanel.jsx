import { useEffect, useMemo, useState } from 'react'

import { getSystemSettings } from '../../../../services/settingsService'

import { createCalculatorProductAdmin } from '../../../../services/calculatorProductService'

import { formatBRL, formatJPY } from '../../../../lib/fx'

import {

  calculateBrazilFinalPrice,

  DIRECT_METHOD_EMS,

  DIRECT_METHOD_EPACKET,

  LOTE_EMS_RATE_TABLE,

  SHIPPING_MODE_DIRETO,

  SHIPPING_MODE_LOTE,

  resolveBrlPerJpyFromSettings,

  toWeightGrams,

} from '../../../../lib/brazilPriceCalculator'



export default function BrazilPriceCalculatorPanel({ onRegistered }) {

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

  const [saving, setSaving] = useState(false)

  const [saveFeedback, setSaveFeedback] = useState('')



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

  ])



  const epacketBlocked = shippingMode === SHIPPING_MODE_DIRETO

    && directMethod === DIRECT_METHOD_EPACKET

    && weightGrams > 2000



  const canRegister = result.isValid

    && String(productName).trim().length > 0

    && !epacketBlocked

    && !saving



  const handleRegister = async () => {

    if (!canRegister) return

    setSaving(true)

    setSaveFeedback('')

    const { error } = await createCalculatorProductAdmin({

      name: String(productName).trim(),

      notes: String(productNotes).trim() || null,

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

    })

    if (error) {

      setSaveFeedback(error.message || 'Falha ao cadastrar produto.')

    } else {

      setSaveFeedback('Produto cadastrado com sucesso.')

      setProductName('')

      setProductNotes('')

      if (typeof onRegistered === 'function') onRegistered()

    }

    setSaving(false)

  }



  return (

    <div className="mt-6 rounded-lg border border-emerald-200 bg-white p-4">

      <h3 className="text-base font-semibold text-earth-900">Nova simulacao</h3>

      <p className="mt-1 text-xs text-earth-600">

        Formula: (custo base + ((valor declarado + frete internacional) x fator aduaneiro)) -&gt; converte para BRL -&gt; aplica margem -&gt; soma embalagem e envio nacional.

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

        </div>

        <div className="rounded border border-sky-200 bg-sky-50 p-3">

          <p className="text-xs text-sky-700">Lucro liquido</p>

          <p className="text-2xl font-bold text-sky-900">{formatBRL(result.breakdown.netProfitBrl)}</p>

          <p className="mt-1 text-[11px] text-sky-800/80">
            Preco final − custo para ter no Brasil
          </p>

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

        <p className="mt-1">

          Lucro liquido: {formatBRL(result.breakdown.finalBrl)} − {formatBRL(result.breakdown.landedCostBrl)} = {formatBRL(result.breakdown.netProfitBrl)}.

        </p>

      </div>



      <div className="mt-4 flex flex-wrap items-center gap-3">

        <button

          type="button"

          onClick={() => void handleRegister()}

          disabled={!canRegister}

          className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-800 disabled:cursor-not-allowed disabled:opacity-50"

        >

          {saving ? 'Cadastrando...' : 'Cadastrar produto'}

        </button>

        {saveFeedback ? (

          <p className={`text-sm ${/sucesso/i.test(saveFeedback) ? 'text-emerald-700' : 'text-red-700'}`}>

            {saveFeedback}

          </p>

        ) : null}

      </div>

    </div>

  )

}


