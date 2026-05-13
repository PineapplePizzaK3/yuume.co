import { useEffect, useState } from 'react'
import { useAdminContext } from '../AdminContext'
import { getAdminEmailTemplates, saveAdminEmailTemplates } from '../../../../services/adminEmailTemplateService'

const TEMPLATE_CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'envio', label: 'Envio' },
  { value: 'pos_venda', label: 'Pos-venda' },
  { value: 'carrinho', label: 'Carrinho' },
]

const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: 'order_update',
    label: 'Atualizacao de pedido',
    category: 'pedido',
    subject: 'Atualizacao importante sobre seu pedido na Yuume',
    preheader: 'Seu pedido teve atualizacao. Confira os detalhes em poucos segundos.',
    headline: 'Seu pedido foi atualizado',
    text: `Ola!

Temos uma atualizacao no seu pedido na Yuume.

Se houver qualquer duvida, nosso time esta disponivel para te ajudar. Voce pode acompanhar tudo pela sua area de pedidos com total transparencia.

Obrigado pela confianca.

Atenciosamente,
Time Yuume`,
    cta_label: 'Acompanhar pedido',
    cta_url: 'https://yuume.co/platform/orders',
    signature_name: 'Time Yuume',
  },
  {
    id: 'payment_pending',
    label: 'Pagamento pendente',
    category: 'pagamento',
    subject: 'Seu pedido esta pronto para pagamento',
    preheader: 'Finalize em seguranca para continuarmos o processamento.',
    headline: 'Pagamento pendente do seu pedido',
    text: `Ola!

Seu pedido esta pronto para a etapa de pagamento.
Assim que o pagamento for confirmado, seguimos com o processamento normalmente.

Se precisar de ajuda, responda este e-mail ou fale com nosso suporte.

Atenciosamente,
Time Yuume`,
    cta_label: 'Finalizar pagamento',
    cta_url: 'https://yuume.co/platform/orders',
    signature_name: 'Time Yuume',
  },
  {
    id: 'shipment_posted',
    label: 'Pedido enviado',
    category: 'envio',
    subject: 'Seu pedido foi enviado',
    preheader: 'Seu pacote ja esta em rota. Acompanhe o status.',
    headline: 'Pedido enviado com sucesso',
    text: `Ola!

Boas noticias: seu pedido foi enviado e ja esta em rota.

Voce pode acompanhar as atualizacoes pela sua area de pedidos.

Obrigado por comprar com a Yuume.

Atenciosamente,
Time Yuume`,
    cta_label: 'Ver rastreio',
    cta_url: 'https://yuume.co/platform/orders',
    signature_name: 'Time Yuume',
  },
  {
    id: 'post_sale',
    label: 'Pos-venda e feedback',
    category: 'pos_venda',
    subject: 'Como foi sua experiencia com a Yuume?',
    preheader: 'Seu feedback nos ajuda a melhorar cada vez mais.',
    headline: 'Queremos ouvir voce',
    text: `Ola!

Esperamos que sua experiencia com a Yuume tenha sido excelente.

Se puder, nos conte rapidamente como foi sua compra. Seu feedback e muito importante para melhorarmos nosso servico.

Obrigado pela confianca.

Atenciosamente,
Time Yuume`,
    cta_label: 'Enviar feedback',
    cta_url: 'https://yuume.co/contact',
    signature_name: 'Time Yuume',
  },
  {
    id: 'cart_recovery',
    label: 'Recuperacao de carrinho',
    category: 'carrinho',
    subject: 'Seus itens ainda estao te esperando',
    preheader: 'Retome sua compra com seguranca e praticidade.',
    headline: 'Retome sua compra',
    text: `Ola!

Percebemos que voce deixou itens no carrinho e quisemos te lembrar.

Se ainda tiver interesse, voce pode retomar a compra de forma simples e segura.

Caso precise de ajuda, nosso time de suporte esta a disposicao.

Atenciosamente,
Time Yuume`,
    cta_label: 'Voltar ao carrinho',
    cta_url: 'https://yuume.co/platform/cart',
    signature_name: 'Time Yuume',
  },
]

function slugifyTemplateId(value, fallback = 'template') {
  const normalized = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

function normalizeTemplate(input, index = 0) {
  const fallbackLabel = `Template ${index + 1}`
  const label = String(input?.label || fallbackLabel).trim() || fallbackLabel
  const id = slugifyTemplateId(input?.id || label, `template_${index + 1}`)
  const categoryRaw = String(input?.category || '').trim().toLowerCase()
  const category = TEMPLATE_CATEGORIES.some((item) => item.value === categoryRaw) ? categoryRaw : 'geral'
  return {
    id,
    label,
    category,
    subject: String(input?.subject || '').trim(),
    preheader: String(input?.preheader || '').trim(),
    headline: String(input?.headline || '').trim(),
    text: String(input?.text || '').trim(),
    cta_label: String(input?.cta_label || '').trim(),
    cta_url: String(input?.cta_url || '').trim(),
    signature_name: String(input?.signature_name || '').trim(),
  }
}

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
    reply_to: '',
    use_professional_template: true,
    preheader: '',
    headline: '',
    cta_label: '',
    cta_url: '',
    signature_name: '',
  })
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateLabelInput, setTemplateLabelInput] = useState('')
  const [templateCategoryInput, setTemplateCategoryInput] = useState('geral')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all')
  const [templateLibrary, setTemplateLibrary] = useState(DEFAULT_EMAIL_TEMPLATES)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesSaving, setTemplatesSaving] = useState(false)
  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'marketing' || templatesLoaded) return
    let isActive = true
    ;(async () => {
      setTemplatesLoading(true)
      const { data, error } = await getAdminEmailTemplates()
      if (!isActive) return
      if (error) {
        setMessage(error.message || 'Erro ao carregar templates de e-mail')
        setTemplateLibrary(DEFAULT_EMAIL_TEMPLATES)
      } else {
        const incoming = Array.isArray(data?.templates) ? data.templates : []
        const normalized = incoming.map((template, index) => normalizeTemplate(template, index)).filter((item) => item.label && item.text)
        setTemplateLibrary(normalized.length > 0 ? normalized : DEFAULT_EMAIL_TEMPLATES)
      }
      setTemplatesLoaded(true)
      setTemplatesLoading(false)
    })()
    return () => {
      isActive = false
    }
  }, [activeTab, templatesLoaded, setMessage])

  if (activeTab !== 'marketing') return null
  const visibleTemplates = templateCategoryFilter === 'all'
    ? templateLibrary
    : templateLibrary.filter((item) => item.category === templateCategoryFilter)

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
      reply_to: '',
      use_professional_template: true,
      preheader: '',
      headline: '',
      cta_label: '',
      cta_url: '',
      signature_name: '',
    })
    setSelectedTemplateId('')
    setTemplateCategoryInput('geral')
  }

  const applyEmailTemplate = () => {
    const selected = templateLibrary.find((template) => template.id === selectedTemplateId)
    if (!selected) {
      setMessage('Selecione um template para aplicar.')
      return
    }
    setEmailForm((prev) => ({
      ...prev,
      subject: selected.subject,
      text: selected.text,
      preheader: selected.preheader,
      headline: selected.headline,
      cta_label: selected.cta_label,
      cta_url: selected.cta_url,
      signature_name: selected.signature_name,
      html: '',
      use_professional_template: true,
    }))
    setTemplateCategoryInput(selected.category || 'geral')
    setTemplateLabelInput(selected.label)
    setMessage(`Template "${selected.label}" aplicado.`)
  }

  const buildTemplateFromCurrentForm = () => {
    const label = String(templateLabelInput || '').trim()
    const fallbackLabel = String(emailForm.headline || emailForm.subject || '').trim() || 'Novo template'
    const finalLabel = label || fallbackLabel
    return normalizeTemplate({
      id: selectedTemplateId || finalLabel,
      label: finalLabel,
      category: templateCategoryInput,
      subject: emailForm.subject,
      preheader: emailForm.preheader,
      headline: emailForm.headline,
      text: emailForm.text,
      cta_label: emailForm.cta_label,
      cta_url: emailForm.cta_url,
      signature_name: emailForm.signature_name,
    })
  }

  const persistTemplates = async (nextTemplates, successMessage) => {
    const safeTemplates = Array.isArray(nextTemplates) ? nextTemplates.map((template, index) => normalizeTemplate(template, index)) : []
    setTemplatesSaving(true)
    const { error } = await saveAdminEmailTemplates({
      templates: safeTemplates,
    })
    setTemplatesSaving(false)
    if (error) {
      setMessage(error.message || 'Erro ao salvar templates')
      return false
    }
    setTemplateLibrary(safeTemplates.length > 0 ? safeTemplates : DEFAULT_EMAIL_TEMPLATES)
    if (successMessage) setMessage(successMessage)
    return true
  }

  const handleSaveTemplate = async () => {
    const template = buildTemplateFromCurrentForm()
    if (!template.text || !template.subject) {
      setMessage('Preencha pelo menos assunto e mensagem para salvar o template.')
      return
    }
    const existingIndex = templateLibrary.findIndex((item) => item.id === selectedTemplateId || item.id === template.id)
    let next
    if (existingIndex >= 0) {
      next = [...templateLibrary]
      next[existingIndex] = { ...template, id: templateLibrary[existingIndex].id }
      await persistTemplates(next, `Template "${template.label}" atualizado.`)
      setSelectedTemplateId(next[existingIndex].id)
    } else {
      const dedupId = templateLibrary.some((item) => item.id === template.id)
        ? `${template.id}_${Date.now()}`
        : template.id
      const created = { ...template, id: dedupId }
      next = [...templateLibrary, created]
      await persistTemplates(next, `Template "${created.label}" salvo.`)
      setSelectedTemplateId(created.id)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) {
      setMessage('Selecione um template para remover.')
      return
    }
    const next = templateLibrary.filter((item) => item.id !== selectedTemplateId)
    await persistTemplates(next, 'Template removido.')
    setSelectedTemplateId('')
    setTemplateLabelInput('')
    setTemplateCategoryInput('geral')
  }

  const handleRestoreDefaultTemplates = async () => {
    await persistTemplates(DEFAULT_EMAIL_TEMPLATES, 'Templates padrao restaurados.')
    setSelectedTemplateId('')
    setTemplateLabelInput('')
    setTemplateCategoryInput('geral')
  }

  const moveSelectedTemplate = async (direction) => {
    if (!selectedTemplateId) {
      setMessage('Selecione um template para reordenar.')
      return
    }
    const currentIndex = templateLibrary.findIndex((item) => item.id === selectedTemplateId)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= templateLibrary.length) return
    const next = [...templateLibrary]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, moved)
    await persistTemplates(next, 'Ordem dos templates atualizada.')
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
    const replyTo = String(emailForm.reply_to || '').trim()
    const useProfessionalTemplate = Boolean(emailForm.use_professional_template)
    const preheader = String(emailForm.preheader || '').trim()
    const headline = String(emailForm.headline || '').trim()
    const ctaLabel = String(emailForm.cta_label || '').trim()
    const ctaUrl = String(emailForm.cta_url || '').trim()
    const signatureName = String(emailForm.signature_name || '').trim()

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
    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) {
      setMessage('O link do CTA deve começar com http:// ou https://')
      return
    }

    setEmailSubmitting(true)
    const { error } = await sendManualAdminEmail({
      to: recipients,
      subject,
      text,
      html,
      from: from || undefined,
      reply_to: replyTo || undefined,
      use_professional_template: useProfessionalTemplate,
      preheader: preheader || undefined,
      headline: headline || undefined,
      cta_label: ctaLabel || undefined,
      cta_url: ctaUrl || undefined,
      signature_name: signatureName || undefined,
    })
    setEmailSubmitting(false)
    if (!error) {
      setEmailForm((prev) => ({
        ...prev,
        subject: '',
        text: '',
        html: '',
        preheader: '',
        headline: '',
        cta_label: '',
        cta_url: '',
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
            <span className="text-earth-700">Templates prontos</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                className="min-w-[220px] rounded border border-earth-300 px-3 py-2 text-sm"
              >
                <option value="all">Todas categorias</option>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedTemplateId(id)
                  const selected = templateLibrary.find((item) => item.id === id)
                  setTemplateLabelInput(selected?.label || '')
                  setTemplateCategoryInput(selected?.category || 'geral')
                }}
                className="min-w-[240px] flex-1 rounded border border-earth-300 px-3 py-2"
                disabled={templatesLoading}
              >
                <option value="">{templatesLoading ? 'Carregando templates...' : 'Selecione um template'}</option>
                {visibleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label} ({TEMPLATE_CATEGORIES.find((item) => item.value === template.category)?.label || 'Geral'})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyEmailTemplate}
                className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
              >
                Aplicar template
              </button>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_auto_auto_auto_auto_auto]">
              <input
                type="text"
                value={templateLabelInput}
                onChange={(e) => setTemplateLabelInput(e.target.value)}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
                placeholder="Nome do template atual"
              />
              <select
                value={templateCategoryInput}
                onChange={(e) => setTemplateCategoryInput(e.target.value)}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              >
                {TEMPLATE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={templatesSaving}
                className="rounded-lg border border-earth-300 px-3 py-2 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                {templatesSaving ? 'Salvando...' : 'Salvar template'}
              </button>
              <button
                type="button"
                onClick={() => moveSelectedTemplate('up')}
                disabled={templatesSaving}
                className="rounded-lg border border-earth-300 px-3 py-2 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                Subir
              </button>
              <button
                type="button"
                onClick={() => moveSelectedTemplate('down')}
                disabled={templatesSaving}
                className="rounded-lg border border-earth-300 px-3 py-2 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                Descer
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplate}
                disabled={templatesSaving}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-70"
              >
                Remover
              </button>
              <button
                type="button"
                onClick={handleRestoreDefaultTemplates}
                disabled={templatesSaving}
                className="rounded-lg border border-earth-300 px-3 py-2 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                Restaurar padrao
              </button>
            </div>
            <p className="mt-1 text-xs text-earth-600">
              Templates ficam salvos no banco e podem ser alterados sem novo deploy.
            </p>
          </label>
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
            <span className="flex items-center gap-2 text-earth-700">
              <input
                type="checkbox"
                checked={Boolean(emailForm.use_professional_template)}
                onChange={(e) => setEmailForm((s) => ({ ...s, use_professional_template: e.target.checked }))}
              />
              Aplicar template profissional automaticamente
            </span>
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Preheader (opcional)</span>
            <input
              type="text"
              value={emailForm.preheader}
              onChange={(e) => setEmailForm((s) => ({ ...s, preheader: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Resumo curto que aparece na prévia da caixa de entrada"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Título interno (headline, opcional)</span>
            <input
              type="text"
              value={emailForm.headline}
              onChange={(e) => setEmailForm((s) => ({ ...s, headline: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Ex: Atualização importante do seu pedido"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Texto do botão (CTA, opcional)</span>
            <input
              type="text"
              value={emailForm.cta_label}
              onChange={(e) => setEmailForm((s) => ({ ...s, cta_label: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Ex: Acompanhar pedido"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Link do botão (CTA URL, opcional)</span>
            <input
              type="url"
              value={emailForm.cta_url}
              onChange={(e) => setEmailForm((s) => ({ ...s, cta_url: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="https://seudominio.com/minha-conta/pedidos"
            />
          </label>
          <label className="text-sm">
            <span className="text-earth-700">Assinatura (opcional)</span>
            <input
              type="text"
              value={emailForm.signature_name}
              onChange={(e) => setEmailForm((s) => ({ ...s, signature_name: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="Ex: Time de Suporte Yuume"
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
          <label className="text-sm md:col-span-2">
            <span className="text-earth-700">Responder para (reply-to, opcional)</span>
            <input
              type="text"
              value={emailForm.reply_to}
              onChange={(e) => setEmailForm((s) => ({ ...s, reply_to: e.target.value }))}
              className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
              placeholder="suporte@seudominio.com"
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
