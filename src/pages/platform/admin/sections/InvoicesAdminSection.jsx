import { useState } from 'react'
import { useAdminContext } from '../AdminContext'

const DOC_KIND_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'invoice', label: 'Invoice (fase 1)' },
  { value: 'consolidation_invoice', label: 'Consolidation Invoice (fase 2)' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'payout_statement', label: 'Payout Statement' },
]

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
    generateCreditNoteDoc,
    generatePayoutDoc,
    downloadFinancialDocPdf,
    deleteFinancialDocument,
    deleteFinancialDocumentsBulk,
    setMessage,
  } = useAdminContext()

  const [invoiceForm, setInvoiceForm] = useState({ orderId: '', invoiceKind: 'invoice' })
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

      <div className="grid gap-6 xl:grid-cols-3">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!invoiceForm.orderId.trim()) {
              setMessage('Para geração manual de invoice, informe um orderId.')
              return
            }
            await generateInvoiceDoc({
              orderId: invoiceForm.orderId.trim(),
              invoiceKind: invoiceForm.invoiceKind,
            })
          }}
          className="rounded-lg border border-earth-200 bg-white p-4"
        >
          <h3 className="font-semibold text-earth-900">Gerar Invoice</h3>
          <p className="mt-1 text-xs text-earth-600">Gera Invoice fase 1 ou de consolidacao.</p>
          <div className="mt-3 space-y-2">
            <input
              placeholder="orderId (uuid)"
              value={invoiceForm.orderId}
              onChange={(e) => setInvoiceForm((s) => ({ ...s, orderId: e.target.value }))}
              className="w-full rounded border border-earth-300 px-3 py-2 text-sm"
            />
            <select
              value={invoiceForm.invoiceKind}
              onChange={(e) => setInvoiceForm((s) => ({ ...s, invoiceKind: e.target.value }))}
              className="w-full rounded border border-earth-300 px-3 py-2 text-sm"
            >
              <option value="invoice">invoice</option>
              <option value="consolidation_invoice">consolidation_invoice</option>
            </select>
            <div className="grid gap-2">
              <button className="w-full rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
                Gerar manual
              </button>
              <button
                type="button"
                onClick={() =>
                  generateInvoiceDoc({
                    invoiceKind: invoiceForm.invoiceKind,
                    randomData: true,
                  })
                }
                className="w-full rounded border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
              >
                Gerar teste aleatório
              </button>
            </div>
          </div>
        </form>

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
          className="rounded-lg border border-earth-200 bg-white p-4"
        >
          <h3 className="font-semibold text-earth-900">Gerar Credit Note</h3>
          <div className="mt-3 grid gap-2">
            <input placeholder="originalInvoiceId (opcional)" value={creditForm.originalInvoiceId} onChange={(e) => setCreditForm((s) => ({ ...s, originalInvoiceId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="orderId" value={creditForm.orderId} onChange={(e) => setCreditForm((s) => ({ ...s, orderId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="userId" value={creditForm.userId} onChange={(e) => setCreditForm((s) => ({ ...s, userId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input type="number" step="0.0001" placeholder="amountCreditedUsd" value={creditForm.amountCreditedUsd} onChange={(e) => setCreditForm((s) => ({ ...s, amountCreditedUsd: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input type="number" step="0.01" placeholder="amountCreditedBrl" value={creditForm.amountCreditedBrl} onChange={(e) => setCreditForm((s) => ({ ...s, amountCreditedBrl: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="paymentMethod" value={creditForm.paymentMethod} onChange={(e) => setCreditForm((s) => ({ ...s, paymentMethod: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="currency" value={creditForm.currency} onChange={(e) => setCreditForm((s) => ({ ...s, currency: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="transactionId" value={creditForm.transactionId} onChange={(e) => setCreditForm((s) => ({ ...s, transactionId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="reason" value={creditForm.reason} onChange={(e) => setCreditForm((s) => ({ ...s, reason: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <button className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
              Gerar manual
            </button>
            <button
              type="button"
              onClick={() => generateCreditNoteDoc({ randomData: true })}
              className="rounded border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
            >
              Gerar teste aleatório
            </button>
          </div>
        </form>

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
          className="rounded-lg border border-earth-200 bg-white p-4"
        >
          <h3 className="font-semibold text-earth-900">Gerar Payout Statement</h3>
          <div className="mt-3 grid gap-2">
            <input placeholder="orderId (opcional)" value={payoutForm.orderId} onChange={(e) => setPayoutForm((s) => ({ ...s, orderId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="userId" value={payoutForm.userId} onChange={(e) => setPayoutForm((s) => ({ ...s, userId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="affiliateId" value={payoutForm.affiliateId} onChange={(e) => setPayoutForm((s) => ({ ...s, affiliateId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input type="number" step="0.0001" placeholder="commissionUsd" value={payoutForm.commissionUsd} onChange={(e) => setPayoutForm((s) => ({ ...s, commissionUsd: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input type="number" step="0.01" placeholder="commissionBrl" value={payoutForm.commissionBrl} onChange={(e) => setPayoutForm((s) => ({ ...s, commissionBrl: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="paymentMethod" value={payoutForm.paymentMethod} onChange={(e) => setPayoutForm((s) => ({ ...s, paymentMethod: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <input placeholder="transactionId" value={payoutForm.transactionId} onChange={(e) => setPayoutForm((s) => ({ ...s, transactionId: e.target.value }))} className="rounded border border-earth-300 px-3 py-2 text-sm" />
            <button className="rounded bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800">
              Gerar manual
            </button>
            <button
              type="button"
              onClick={() => generatePayoutDoc({ randomData: true })}
              className="rounded border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
            >
              Gerar teste aleatório
            </button>
          </div>
        </form>
      </div>

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
                <td className="px-3 py-2 font-mono text-xs">{doc.order_id || '—'}</td>
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
