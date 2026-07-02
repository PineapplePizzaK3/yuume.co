import { useState } from 'react'
import { useAdminContext } from '../AdminContext'
import {
  getInvoiceTemplate,
  INVOICE_CREATE_TEMPLATES,
} from './invoiceTemplates'

const DOC_KIND_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'invoice', label: 'Invoice (fase 1)' },
  { value: 'consolidation_invoice', label: 'Consolidation Invoice (fase 2)' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'payout_statement', label: 'Payout Statement' },
]

const EMPTY_MANUAL_ITEM = { itemName: '', quantity: '1', unitPriceUsd: '' }

function parseDecimalInput(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

function buildManualInvoicePayload(form, invoiceKind = 'invoice') {
  const items = (form.items || [])
    .map((row) => ({
      itemName: row.itemName.trim(),
      quantity: parseDecimalInput(row.quantity) || 1,
      unitPriceUsd: parseDecimalInput(row.unitPriceUsd),
    }))
    .filter((row) => row.itemName && Number.isFinite(row.unitPriceUsd) && row.unitPriceUsd > 0)

  const payload = {
    invoiceKind,
    customer: {
      name: form.customerName.trim(),
      email: form.customerEmail.trim() || undefined,
      country: form.customerCountry.trim() || 'Brazil',
    },
    items,
    paymentMethod: form.paymentMethod.trim() || 'Manual',
    transactionId: form.transactionId.trim() || undefined,
    externalReference: form.externalReference.trim() || undefined,
    notes: form.notes.trim() || undefined,
  }

  if (form.userId.trim()) payload.userId = form.userId.trim()
  if (form.serviceFeeUsd !== '') {
    const v = parseDecimalInput(form.serviceFeeUsd)
    if (Number.isFinite(v)) payload.serviceFeeUsd = v
  }
  if (form.shippingUsd !== '') {
    const v = parseDecimalInput(form.shippingUsd)
    if (Number.isFinite(v)) payload.shippingUsd = v
  }
  if (form.discountBrl !== '') {
    const v = parseDecimalInput(form.discountBrl)
    if (Number.isFinite(v)) payload.discountBrl = v
  }
  if (form.exchangeRateUsdBrl !== '') {
    const v = parseDecimalInput(form.exchangeRateUsdBrl)
    if (Number.isFinite(v) && v > 0) payload.exchangeRateUsdBrl = v
  }

  return payload
}

function createEmptyManualForm(template = null) {
  const defaults = template?.defaults || {}
  return {
    userId: '',
    externalReference: '',
    customerName: '',
    customerEmail: '',
    customerCountry: 'Brazil',
    paymentMethod: 'PIX',
    transactionId: '',
    serviceFeeUsd: '',
    shippingUsd: '',
    discountBrl: '',
    exchangeRateUsdBrl: '',
    notes: '',
    items: defaults.items?.length
      ? defaults.items.map((row) => ({ ...EMPTY_MANUAL_ITEM, ...row }))
      : [{ ...EMPTY_MANUAL_ITEM }],
  }
}

export default function InvoicesAdminSection() {
  const {
    activeTab,
    docsLoading,
    docsFilterKind,
    setDocsFilterKind,
    docsFilterUserId,
    setDocsFilterUserId,
    loadFinancialDocuments,
    financialDocs,
    generateInvoiceDoc,
    generateManualInvoiceDoc,
    generateCreditNoteDoc,
    generatePayoutDoc,
    downloadFinancialDocPdf,
    deleteFinancialDocument,
    deleteFinancialDocumentsBulk,
    setMessage,
  } = useAdminContext()

  const [selectedTemplateId, setSelectedTemplateId] = useState('manual_invoice')
  const [invoiceForm, setInvoiceForm] = useState({ orderId: '', invoiceKind: 'invoice' })
  const [manualForm, setManualForm] = useState(() => createEmptyManualForm(getInvoiceTemplate('manual_invoice')))
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const selectedTemplate = getInvoiceTemplate(selectedTemplateId)

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId)
    const template = getInvoiceTemplate(templateId)
    if (template?.mode === 'manual') {
      setManualForm(createEmptyManualForm(template))
    }
    if (template?.mode === 'order') {
      setInvoiceForm((s) => ({ ...s, invoiceKind: 'invoice' }))
    }
  }

  const renderManualFormFields = (invoiceKind) => (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          placeholder="Nome do cliente *"
          value={manualForm.customerName}
          onChange={(e) => setManualForm((s) => ({ ...s, customerName: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="E-mail do cliente"
          value={manualForm.customerEmail}
          onChange={(e) => setManualForm((s) => ({ ...s, customerEmail: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="País"
          value={manualForm.customerCountry}
          onChange={(e) => setManualForm((s) => ({ ...s, customerCountry: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="Referência externa (ex: pedido WhatsApp)"
          value={manualForm.externalReference}
          onChange={(e) => setManualForm((s) => ({ ...s, externalReference: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          placeholder="userId (opcional — vincula à conta na plataforma)"
          value={manualForm.userId}
          onChange={(e) => setManualForm((s) => ({ ...s, userId: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm font-mono text-xs"
        />
        <input
          placeholder="Método de pagamento"
          value={manualForm.paymentMethod}
          onChange={(e) => setManualForm((s) => ({ ...s, paymentMethod: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="ID da transação"
          value={manualForm.transactionId}
          onChange={(e) => setManualForm((s) => ({ ...s, transactionId: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.0001"
          placeholder="Câmbio USD/BRL (opcional)"
          value={manualForm.exchangeRateUsdBrl}
          onChange={(e) => setManualForm((s) => ({ ...s, exchangeRateUsdBrl: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="number"
          step="0.0001"
          placeholder="Taxa de serviço (USD)"
          value={manualForm.serviceFeeUsd}
          onChange={(e) => setManualForm((s) => ({ ...s, serviceFeeUsd: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.0001"
          placeholder="Frete (USD)"
          value={manualForm.shippingUsd}
          onChange={(e) => setManualForm((s) => ({ ...s, shippingUsd: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Desconto (BRL)"
          value={manualForm.discountBrl}
          onChange={(e) => setManualForm((s) => ({ ...s, discountBrl: e.target.value }))}
          className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-earth-800">Itens *</p>
          <button
            type="button"
            onClick={() =>
              setManualForm((s) => ({
                ...s,
                items: [...s.items, { ...EMPTY_MANUAL_ITEM }],
              }))
            }
            className="rounded border border-earth-300 bg-white px-2.5 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100"
          >
            + Adicionar item
          </button>
        </div>
        {manualForm.items.map((row, idx) => (
          <div key={idx} className="grid gap-2 md:grid-cols-[1fr_90px_130px_auto]">
            <input
              placeholder="Descrição do item"
              value={row.itemName}
              onChange={(e) =>
                setManualForm((s) => {
                  const items = [...s.items]
                  items[idx] = { ...items[idx], itemName: e.target.value }
                  return { ...s, items }
                })
              }
              className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Qtd"
              value={row.quantity}
              onChange={(e) =>
                setManualForm((s) => {
                  const items = [...s.items]
                  items[idx] = { ...items[idx], quantity: e.target.value }
                  return { ...s, items }
                })
              }
              className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Preço unit. USD"
              value={row.unitPriceUsd}
              onChange={(e) =>
                setManualForm((s) => {
                  const items = [...s.items]
                  items[idx] = { ...items[idx], unitPriceUsd: e.target.value }
                  return { ...s, items }
                })
              }
              className="rounded border border-earth-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={manualForm.items.length <= 1}
              onClick={() =>
                setManualForm((s) => ({
                  ...s,
                  items: s.items.filter((_, i) => i !== idx),
                }))
              }
              className="rounded border border-earth-300 bg-white px-3 py-2 text-xs text-earth-600 hover:bg-earth-100 disabled:opacity-40"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <textarea
        placeholder="Observações internas (opcional)"
        value={manualForm.notes}
        onChange={(e) => setManualForm((s) => ({ ...s, notes: e.target.value }))}
        rows={2}
        className="w-full rounded border border-earth-300 bg-white px-3 py-2 text-sm"
      />

      <button
        type="submit"
        disabled={manualSubmitting}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {manualSubmitting ? 'Gerando documento...' : 'Gerar documento e baixar PDF'}
      </button>
    </>
  )

  const [creditForm, setCreditForm] = useState({
    originalInvoiceId: '',
    orderId: '',
    userId: '',
    amountCreditedUsd: '',
    amountCreditedBrl: '',
    paymentMethod: 'Parcelow',
    currency: 'USD',
    transactionId: '',
    reason: '',
  })
  const [payoutForm, setPayoutForm] = useState({
    orderId: '',
    userId: '',
    affiliateId: '',
    commissionUsd: '',
    commissionBrl: '',
    paymentMethod: 'Wise',
    transactionId: '',
  })

  if (activeTab !== 'invoices_admin') return null

  return (
    <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-earth-900">Invoices & Financial Documents</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadFinancialDocuments()}
            disabled={docsLoading}
            className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
          >
            {docsLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            disabled={financialDocs.length === 0}
            onClick={() => {
              const ids = financialDocs.map((d) => d?.id).filter(Boolean)
              if (ids.length === 0) return
              const ok = window.confirm(
                `Excluir ${ids.length} documentos listados? Esta ação não pode ser desfeita.`
              )
              if (!ok) return
              deleteFinancialDocumentsBulk(ids)
            }}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            title="Excluir todos os documentos atualmente listados"
          >
            Excluir listados
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-earth-200 bg-white p-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="text-earth-700">Tipo de documento</span>
          <select
            value={docsFilterKind}
            onChange={(e) => setDocsFilterKind(e.target.value)}
            className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
          >
            {DOC_KIND_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-earth-700">Filtrar por user_id</span>
          <input
            value={docsFilterUserId}
            onChange={(e) => setDocsFilterUserId(e.target.value)}
            placeholder="uuid do usuario (opcional)"
            className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => loadFinancialDocuments()}
            className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setDocsFilterKind('')
              setDocsFilterUserId('')
              loadFinancialDocuments({ kind: '', userId: '' })
            }}
            className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-earth-200 bg-white p-4">
        <div>
          <h3 className="font-semibold text-earth-900">1. Escolha o template</h3>
          <p className="mt-1 text-xs text-earth-600">
            Selecione o tipo de documento antes de preencher os campos.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {INVOICE_CREATE_TEMPLATES.map((template) => {
            const selected = selectedTemplateId === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selected
                    ? `ring-2 ${template.accentClass}`
                    : 'border-earth-200 bg-earth-50/40 hover:border-earth-300 hover:bg-earth-50'
                }`}
              >
                <p className="font-semibold text-earth-900">{template.label}</p>
                <p className="text-xs font-medium text-earth-500">{template.subtitle}</p>
                <p className="mt-2 text-xs text-earth-600">{template.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedTemplate && (
        <div className="space-y-4 rounded-lg border border-earth-200 bg-white p-4">
          <div>
            <h3 className="font-semibold text-earth-900">2. Preencha os campos — {selectedTemplate.label}</h3>
            <p className="mt-1 text-xs text-earth-600">{selectedTemplate.description}</p>
          </div>

          {selectedTemplate.mode === 'manual' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (manualSubmitting) return
                if (!manualForm.customerName.trim()) {
                  setMessage('Informe o nome do cliente.')
                  return
                }
                const payload = buildManualInvoicePayload(manualForm, selectedTemplate.invoiceKind)
                if (!payload.items.length) {
                  setMessage('Adicione ao menos um item com descrição e preço unitário em USD (use ponto ou vírgula).')
                  return
                }
                setManualSubmitting(true)
                try {
                  await generateManualInvoiceDoc(payload)
                } finally {
                  setManualSubmitting(false)
                }
              }}
              className="space-y-4"
            >
              {renderManualFormFields(selectedTemplate.invoiceKind)}
            </form>
          )}

          {selectedTemplate.mode === 'order' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const orderId = invoiceForm.orderId.trim()
                if (!orderId) {
                  setMessage('Informe o orderId de um pedido pago na plataforma.')
                  return
                }
                await generateInvoiceDoc({
                  orderId,
                  invoiceKind: invoiceForm.invoiceKind,
                })
              }}
              className="grid max-w-xl gap-3"
            >
              <input
                placeholder="orderId (uuid do pedido pago) *"
                value={invoiceForm.orderId}
                onChange={(e) => setInvoiceForm((s) => ({ ...s, orderId: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm font-mono"
              />
              <select
                value={invoiceForm.invoiceKind}
                onChange={(e) => setInvoiceForm((s) => ({ ...s, invoiceKind: e.target.value }))}
                className="rounded border border-earth-300 px-3 py-2 text-sm"
              >
                <option value="invoice">Fatura fase 1 (invoice)</option>
                <option value="consolidation_invoice">Fatura de consolidação (fase 2)</option>
              </select>
              <p className="text-xs text-earth-600">
                Este template só funciona para pedidos que existem na plataforma com status paid ou products_paid.
                Para vendas externas, use &quot;Fatura manual&quot;.
              </p>
              <button
                type="submit"
                className="w-fit rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
              >
                Gerar a partir do pedido
              </button>
            </form>
          )}

          {selectedTemplate.mode === 'credit_note' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                await generateCreditNoteDoc({
                  originalInvoiceId: creditForm.originalInvoiceId.trim() || undefined,
                  orderId: creditForm.orderId.trim() || undefined,
                  userId: creditForm.userId.trim() || undefined,
                  amountCreditedUsd: Number(creditForm.amountCreditedUsd) || 0,
                  amountCreditedBrl: Number(creditForm.amountCreditedBrl) || 0,
                  paymentMethod: creditForm.paymentMethod,
                  currency: creditForm.currency,
                  transactionId: creditForm.transactionId.trim() || undefined,
                  reason: creditForm.reason.trim() || undefined,
                })
              }}
              className="grid max-w-xl gap-2"
            >
              <input placeholder="originalInvoiceId (opcional)" value={creditForm.originalInvoiceId} onChange={(e) => setCreditForm((s) => ({ ...s, originalInvoiceId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="orderId" value={creditForm.orderId} onChange={(e) => setCreditForm((s) => ({ ...s, orderId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="userId" value={creditForm.userId} onChange={(e) => setCreditForm((s) => ({ ...s, userId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input type="number" step="0.0001" placeholder="amountCreditedUsd" value={creditForm.amountCreditedUsd} onChange={(e) => setCreditForm((s) => ({ ...s, amountCreditedUsd: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input type="number" step="0.01" placeholder="amountCreditedBrl" value={creditForm.amountCreditedBrl} onChange={(e) => setCreditForm((s) => ({ ...s, amountCreditedBrl: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="paymentMethod" value={creditForm.paymentMethod} onChange={(e) => setCreditForm((s) => ({ ...s, paymentMethod: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="currency" value={creditForm.currency} onChange={(e) => setCreditForm((s) => ({ ...s, currency: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="transactionId" value={creditForm.transactionId} onChange={(e) => setCreditForm((s) => ({ ...s, transactionId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="reason" value={creditForm.reason} onChange={(e) => setCreditForm((s) => ({ ...s, reason: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <button type="submit" className="w-fit rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800">
                Gerar nota de crédito
              </button>
            </form>
          )}

          {selectedTemplate.mode === 'payout' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                await generatePayoutDoc({
                  orderId: payoutForm.orderId.trim() || undefined,
                  userId: payoutForm.userId.trim() || undefined,
                  affiliateId: payoutForm.affiliateId.trim() || undefined,
                  commissionUsd: Number(payoutForm.commissionUsd) || 0,
                  commissionBrl: Number(payoutForm.commissionBrl) || 0,
                  paymentMethod: payoutForm.paymentMethod,
                  transactionId: payoutForm.transactionId.trim() || undefined,
                })
              }}
              className="grid max-w-xl gap-2"
            >
              <input placeholder="orderId (opcional)" value={payoutForm.orderId} onChange={(e) => setPayoutForm((s) => ({ ...s, orderId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="userId" value={payoutForm.userId} onChange={(e) => setPayoutForm((s) => ({ ...s, userId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="affiliateId" value={payoutForm.affiliateId} onChange={(e) => setPayoutForm((s) => ({ ...s, affiliateId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input type="number" step="0.0001" placeholder="commissionUsd" value={payoutForm.commissionUsd} onChange={(e) => setPayoutForm((s) => ({ ...s, commissionUsd: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input type="number" step="0.01" placeholder="commissionBrl" value={payoutForm.commissionBrl} onChange={(e) => setPayoutForm((s) => ({ ...s, commissionBrl: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="paymentMethod" value={payoutForm.paymentMethod} onChange={(e) => setPayoutForm((s) => ({ ...s, paymentMethod: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <input placeholder="transactionId" value={payoutForm.transactionId} onChange={(e) => setPayoutForm((s) => ({ ...s, transactionId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
              <button type="submit" className="w-fit rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800">
                Gerar comprovante de repasse
              </button>
            </form>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-earth-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-earth-200 bg-earth-50 text-left text-earth-700">
              <th className="px-3 py-2">Numero</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {financialDocs.map((doc) => (
              <tr key={doc.id} className="border-b border-earth-100">
                <td className="px-3 py-2 font-medium text-earth-900">
                  {doc.invoice_number ? (
                    <button
                      type="button"
                      onClick={() => downloadFinancialDocPdf(doc.id, doc.invoice_number)}
                      className="underline hover:text-earth-700"
                      title="Baixar PDF do documento"
                    >
                      {doc.invoice_number}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">{doc.invoice_kind || doc.document_subtype || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{doc.order_id || doc.external_reference || '—'}</td>
                <td className="px-3 py-2 text-xs">{doc.user_name || doc.user_id || '—'}</td>
                <td className="px-3 py-2">{doc.created_at ? new Date(doc.created_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm(
                        `Excluir documento ${doc.invoice_number || doc.id}? Esta ação não pode ser desfeita.`
                      )
                      if (!ok) return
                      deleteFinancialDocument(doc.id)
                    }}
                    className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    title="Excluir documento"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {financialDocs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-earth-600">
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
