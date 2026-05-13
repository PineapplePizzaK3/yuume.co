import { useState } from 'react'
import { useAdminContext } from '../AdminContext'

export default function MarketingSection() {
  const {
    activeTab,
    marketingLoading,
    loadMarketingData,
    createCheckoutCoupon,
    sendManualAdminEmail,
    checkoutCoupons,
    checkoutCouponsLoading,
    setMessage,
  } = useAdminContext()
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_order_brl: '',
    max_uses: '',
    valid_from: '',
    valid_until: '',
    description: '',
  })
  const [couponSubmitting, setCouponSubmitting] = useState(false)
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    text: '',
    html: '',
    from: '',
  })

  if (activeTab !== 'marketing') return null

  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      discount_type: 'percent',
      discount_value: '',
      min_order_brl: '',
      max_uses: '',
      valid_from: '',
      valid_until: '',
      description: '',
    })
  }

  const handleCreateCoupon = async () => {
    const code = String(couponForm.code || '').trim().toUpperCase()
    const discountValue = Number(couponForm.discount_value)
    if (!code) {
      setMessage('Informe o código do cupom.')
      return
    }
    if (!discountValue || discountValue <= 0) {
      setMessage('Informe um valor de desconto maior que zero.')
      return
    }
    if (couponForm.discount_type === 'percent' && discountValue > 100) {
      setMessage('Para desconto em porcentagem, use no máximo 100.')
      return
    }
    if (couponForm.valid_from && couponForm.valid_until && couponForm.valid_until < couponForm.valid_from) {
      setMessage('Data final não pode ser anterior à data inicial.')
      return
    }

    setCouponSubmitting(true)
    const { error } = await createCheckoutCoupon({
      ...couponForm,
      code,
      discount_value: discountValue,
    })
    setCouponSubmitting(false)
    if (!error) resetCouponForm()
  }

  const resetEmailForm = () => {
    setEmailForm({
      to: '',
      subject: '',
      text: '',
      html: '',
      from: '',
    })
  }

  const handleSendEmail = async () => {
    const recipients = String(emailForm.to || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const subject = String(emailForm.subject || '').trim()
    const text = String(emailForm.text || '').trim()
    const html = String(emailForm.html || '').trim()
    const from = String(emailForm.from || '').trim()

    if (recipients.length === 0) {
      setMessage('Informe ao menos um destinatário.')
      return
    }
    if (!subject) {
      setMessage('Informe o assunto do e-mail.')
      return
    }
    if (!text && !html) {
      setMessage('Informe uma mensagem em texto ou HTML.')
      return
    }

    setEmailSubmitting(true)
    const { error } = await sendManualAdminEmail({
      to: recipients,
      subject,
      text,
      html,
      from: from || undefined,
    })
    setEmailSubmitting(false)
    if (!error) {
      setEmailForm((prev) => ({
        ...prev,
        subject: '',
        text: '',
        html: '',
      }))
    }
  }

  return (
    <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-earth-900">Cupons de checkout</h2>
        <button
          type="button"
          onClick={() => loadMarketingData()}
          disabled={marketingLoading}
          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          {marketingLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="rounded-lg border border-earth-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-earth-900">Painel de cupons (checkout)</h3>
          <button
            type="button"
            onClick={() => loadMarketingData()}
            disabled={checkoutCouponsLoading}
            className="rounded border border-earth-300 px-3 py-1.5 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
          >
            {checkoutCouponsLoading ? 'Atualizando...' : 'Atualizar cupons'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-earth-700">Código</span>
            <input
              type="text"
              value={couponForm.code}
              onChange={(e) => setCouponForm((s) => ({ ...s, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="EX: OFF10"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Tipo de desconto</span>
            <select
              value={couponForm.discount_type}
              onChange={(e) => setCouponForm((s) => ({ ...s, discount_type: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (BRL)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Valor do desconto</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={couponForm.discount_value}
              onChange={(e) => setCouponForm((s) => ({ ...s, discount_value: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Compra mínima (BRL, opcional)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={couponForm.min_order_brl}
              onChange={(e) => setCouponForm((s) => ({ ...s, min_order_brl: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Limite de usos (opcional)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={couponForm.max_uses}
              onChange={(e) => setCouponForm((s) => ({ ...s, max_uses: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Descrição (opcional)</span>
            <input
              type="text"
              value={couponForm.description}
              onChange={(e) => setCouponForm((s) => ({ ...s, description: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Ex: 10% na primeira compra"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Válido de (opcional)</span>
            <input
              type="datetime-local"
              value={couponForm.valid_from}
              onChange={(e) => setCouponForm((s) => ({ ...s, valid_from: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Válido até (opcional)</span>
            <input
              type="datetime-local"
              value={couponForm.valid_until}
              onChange={(e) => setCouponForm((s) => ({ ...s, valid_until: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateCoupon}
            disabled={couponSubmitting}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-70"
          >
            {couponSubmitting ? 'Criando...' : 'Criar cupom'}
          </button>
          <button
            type="button"
            onClick={resetCouponForm}
            className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Limpar
          </button>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-earth-800">Cupons cadastrados</h4>
          {checkoutCouponsLoading ? (
            <p className="mt-2 text-sm text-earth-600">Carregando cupons...</p>
          ) : checkoutCoupons.length === 0 ? (
            <p className="mt-2 text-sm text-earth-600">Nenhum cupom de checkout cadastrado.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-earth-200 text-left text-earth-600">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Usos</th>
                    <th className="py-2 pr-3">Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {checkoutCoupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-earth-100 text-earth-800">
                      <td className="py-2 pr-3 font-medium">{coupon.code}</td>
                      <td className="py-2 pr-3">{coupon.discount_type === 'percent' ? 'Percentual' : 'Fixo'}</td>
                      <td className="py-2 pr-3">
                        {coupon.discount_type === 'percent'
                          ? `${Number(coupon.discount_value || 0)}%`
                          : `R$ ${Number(coupon.discount_value || 0).toFixed(2)}`}
                      </td>
                      <td className="py-2 pr-3">
                        {Number(coupon.used_count || 0)}
                        {coupon.max_uses != null ? ` / ${Number(coupon.max_uses)}` : ' / sem limite'}
                      </td>
                      <td className="py-2 pr-3">
                        {coupon.valid_from ? new Date(coupon.valid_from).toLocaleString('pt-BR') : '—'}
                        {' '}até{' '}
                        {coupon.valid_until ? new Date(coupon.valid_until).toLocaleString('pt-BR') : 'sem expiração'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-earth-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-earth-900">Envio manual de e-mail</h3>
          <span className="text-xs text-earth-600">Use vírgula para múltiplos destinatários</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Para</span>
            <input
              type="text"
              value={emailForm.to}
              onChange={(e) => setEmailForm((s) => ({ ...s, to: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="cliente@exemplo.com, suporte@exemplo.com"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Assunto</span>
            <input
              type="text"
              value={emailForm.subject}
              onChange={(e) => setEmailForm((s) => ({ ...s, subject: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Ex: Atualização do seu pedido"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Mensagem (texto)</span>
            <textarea
              value={emailForm.text}
              onChange={(e) => setEmailForm((s) => ({ ...s, text: e.target.value }))}
              className="mt-1 min-h-28 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Mensagem em texto puro"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Mensagem HTML (opcional)</span>
            <textarea
              value={emailForm.html}
              onChange={(e) => setEmailForm((s) => ({ ...s, html: e.target.value }))}
              className="mt-1 min-h-28 w-full rounded border border-earth-300 px-3 py-2 font-mono text-xs"
              placeholder="<p>Mensagem em HTML</p>"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Remetente (opcional)</span>
            <input
              type="text"
              value={emailForm.from}
              onChange={(e) => setEmailForm((s) => ({ ...s, from: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Loja <no-reply@seudominio.com>"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={emailSubmitting}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-70"
          >
            {emailSubmitting ? 'Enviando...' : 'Enviar e-mail'}
          </button>
          <button
            type="button"
            onClick={resetEmailForm}
            className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Limpar
          </button>
        </div>
      </div>
    </section>
  )
}
