import { useSiteLocale } from '../../../../hooks/useSiteLocale'
import { brlToJpy } from '../../../../lib/fx'
import { formatJpyForSite } from '../../../../lib/moneyDisplay'
import { saveSystemSettingsAdmin } from '../../../../services/settingsService'
import { useAdminContext } from '../AdminContext'

export default function MarketingSection() {
  const siteLocale = useSiteLocale()
  const {
    activeTab,
    marketingLoading,
    loadMarketingData,
    settingsForm,
    setSettingsForm,
    setMessage,
  } = useAdminContext()

  if (activeTab !== 'marketing') return null

  return (
    <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-earth-900">Programa de indicação (referral)</h2>
        <button
          type="button"
          onClick={() => loadMarketingData()}
          disabled={marketingLoading}
          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          {marketingLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <p className="text-sm text-earth-600">
        O benefício do indicado é emitido como cupom na caixa de cupons da central de pagamentos, no valor de{' '}
        {formatJpyForSite(siteLocale, Math.round(brlToJpy(Number(settingsForm.referral_discount_value) || 0)), null)}.
        O crédito ao indicador ({formatJpyForSite(siteLocale, Math.round(brlToJpy(Number(settingsForm.referral_credit_value) || 0)), null)}) é
        lançado quando o pedido do indicado (com cupom de indicação usado) atinge status <strong>enviado</strong> ou{' '}
        <strong>concluído</strong>.
      </p>

      <div className="rounded-lg border border-earth-200 bg-white p-4">
        <h3 className="font-medium text-earth-900">Valores (BRL)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">
              Cotação BRL por 1 JPY (fx_brl_per_jpy) — usada no servidor para converter ¥250/un. das Compras Programadas
            </span>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={settingsForm.fx_brl_per_jpy}
              onChange={(e) => setSettingsForm((s) => ({ ...s, fx_brl_per_jpy: e.target.value }))}
              className="mt-1 w-full max-w-xs rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Valor do cupom do indicado (referral_discount_value)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsForm.referral_discount_value}
              onChange={(e) => setSettingsForm((s) => ({ ...s, referral_discount_value: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Crédito ao indicador (referral_credit_value)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsForm.referral_credit_value}
              onChange={(e) => setSettingsForm((s) => ({ ...s, referral_credit_value: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={async () => {
              const payload = {
                referral_discount_value: { amount: Number(settingsForm.referral_discount_value) || 0 },
                referral_credit_value: { amount: Number(settingsForm.referral_credit_value) || 0 },
                fx_brl_per_jpy: {
                  amount: Math.max(0.0001, Number(settingsForm.fx_brl_per_jpy) || 0.033),
                },
              }
              const { error } = await saveSystemSettingsAdmin(payload)
              if (error) setMessage(error.message || 'Erro ao salvar configurações')
              else {
                setMessage('Configurações de referral salvas.')
                loadMarketingData()
              }
            }}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
          >
            Salvar
          </button>
        </div>
      </div>
    </section>
  )
}
