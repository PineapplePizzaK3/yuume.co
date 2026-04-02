/**
 * Gera PDF simples a partir do snapshot data_json (sem recalcular valores).
 */
import PDFDocument from 'pdfkit'

function esc(s) {
  return String(s ?? '—').replace(/[^\x00-\xFF]/g, '?')
}

export function buildInvoicePdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const d = data || {}
    const ps = d.pricing_summary || {}
    const cust = d.customer || {}
    const pay = d.payment || {}
    const fx = d.currency_info || {}
    const foot = d.footer || {}

    doc.fontSize(18).text(esc(`Invoice ${d.invoice_number || ''}`), { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(10)
    doc.text(esc(`Order: ${d.order_id || ''}`))
    doc.text(esc(`Issue date: ${d.issue_date || ''}`))
    doc.text(esc(`Payment date: ${d.payment_date || ''}`))
    doc.moveDown()

    doc.fontSize(11).text('Bill to', { underline: true })
    doc.fontSize(10)
    doc.text(esc(cust.name))
    doc.text(esc(cust.email))
    doc.text(esc(`Country: ${cust.country || 'Brazil'}`))
    doc.moveDown()

    doc.fontSize(11).text('Line items', { underline: true })
    doc.moveDown(0.3)
    const items = Array.isArray(d.items) ? d.items : []
    for (const it of items) {
      doc.fontSize(10).text(
        esc(
          `${it.item_name} × ${it.quantity} — USD ${Number(it.unit_price_usd || 0).toFixed(4)} / JPY ${Number(it.unit_price_jpy || 0).toFixed(2)} / BRL ${Number(it.unit_price_brl || 0).toFixed(2)}`
        )
      )
    }
    if (!items.length) doc.text('—')
    doc.moveDown()

    doc.fontSize(11).text('Totals (USD is the transactional reference)', { underline: true })
    doc.fontSize(10)
    doc.text(esc(`Subtotal USD: ${Number(ps.subtotal_usd || 0).toFixed(4)}`))
    doc.text(esc(`Subtotal BRL (approx.): ${Number(ps.subtotal_brl || 0).toFixed(2)}`))
    doc.text(esc(`Service fee USD: ${Number(ps.service_fee_usd || 0).toFixed(4)}`))
    doc.text(esc(`Service fee BRL (approx.): ${Number(ps.service_fee_brl || 0).toFixed(2)}`))
    doc.text(esc(`Shipping USD: ${Number(ps.shipping_usd || 0).toFixed(4)}`))
    doc.text(esc(`Shipping BRL (approx.): ${Number(ps.shipping_brl || 0).toFixed(2)}`))
    doc.moveDown(0.3)
    doc.fontSize(12).text(esc(`Total paid USD: ${Number(ps.total_paid_usd || 0).toFixed(4)}`), {
      continued: false,
    })
    doc.fontSize(10).text(esc(`Total display BRL (approx.): ${Number(ps.total_display_brl || 0).toFixed(2)}`))
    doc.moveDown()

    doc.fontSize(11).text('Currency snapshot', { underline: true })
    doc.fontSize(9)
    doc.text(esc(`USD/BRL: ${fx.exchange_rate_usd_brl}`))
    doc.text(esc(`JPY/USD (per 1 JPY): ${fx.exchange_rate_jpy_usd}`))
    doc.text(esc(String(fx.note || '')))
    doc.moveDown()

    doc.fontSize(11).text('Payment', { underline: true })
    doc.fontSize(10)
    doc.text(esc(`Method: ${pay.payment_method}`))
    doc.text(esc(`Currency (reference): ${pay.currency}`))
    doc.text(esc(`Transaction ref: ${pay.transaction_id}`))
    doc.moveDown()

    doc.fontSize(9).fillColor('#444444')
    doc.text(esc(foot.company_name || ''))
    doc.text(esc(`Support: ${foot.support_contact || ''}`))
    doc.moveDown(0.3)
    doc.text(esc(foot.disclaimer || ''), { align: 'left', width: 500 })

    doc.end()
  })
}
