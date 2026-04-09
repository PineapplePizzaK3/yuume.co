/**
 * Gera PDF de invoice em layout visual (template-like).
 */
import { existsSync } from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'

function esc(s) {
  return String(s ?? '—').replace(/[^\x00-\xFF]/g, '?')
}

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function formatUsd(v) {
  return `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(isoLike) {
  if (!isoLike) return '—'
  const dt = new Date(isoLike)
  if (Number.isNaN(dt.getTime())) return esc(isoLike)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function drawTopDecoration(doc, pageWidth) {
  doc.save()
  doc.rect(0, 0, pageWidth, 34).fill('#111111')
  doc.polygon([300, 0], [385, 0], [350, 34], [265, 34]).fill('#FFFFFF')
  doc.rect(pageWidth - 140, 6, 140, 7).fill('#F97316')
  doc.rect(pageWidth - 140, 17, 140, 7).fill('#FFFFFF')
  doc.rect(pageWidth - 140, 28, 140, 6).fill('#111111')
  doc.restore()
}

function drawBottomDecoration(doc, pageWidth, pageHeight) {
  doc.save()
  doc.rect(0, pageHeight - 24, pageWidth, 24).fill('#FFFFFF')
  doc.rect(0, pageHeight - 16, 140, 4).fill('#F97316')
  doc.rect(0, pageHeight - 10, 120, 4).fill('#111111')
  doc.polygon(
    [pageWidth - 210, pageHeight - 24],
    [pageWidth, pageHeight - 24],
    [pageWidth, pageHeight],
    [pageWidth - 260, pageHeight]
  ).fill('#F97316')
  doc.restore()
}

function drawTableHeader(doc, x, y, widths) {
  doc.save()
  doc.rect(x, y, widths.item + widths.qty + widths.price + widths.amount, 26).fill('#F3F4F6')
  doc.fillColor('#1F2937').font('Helvetica-Bold').fontSize(10)
  doc.text('Item', x + 8, y + 8, { width: widths.item - 16 })
  doc.text('Quantity', x + widths.item + 8, y + 8, { width: widths.qty - 16, align: 'center' })
  doc.text('Price', x + widths.item + widths.qty + 8, y + 8, { width: widths.price - 16, align: 'right' })
  doc.text('Amount', x + widths.item + widths.qty + widths.price + 8, y + 8, {
    width: widths.amount - 16,
    align: 'right',
  })
  doc.restore()
}

function resolveLogoPath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'logo.png'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function drawBrandMark(
  doc,
  x,
  y,
  logoPath = null,
  companyName = 'EIKO DLS',
  supportContact = ''
) {
  doc.save()
  let usedLogo = false
  if (logoPath) {
    try {
      doc.image(logoPath, x, y, { fit: [34, 34], align: 'left', valign: 'center' })
      usedLogo = true
    } catch {
      usedLogo = false
    }
  }
  if (!usedLogo) {
    doc.circle(x + 14, y + 14, 14).fill('#F97316')
    doc.polygon([x + 20, y + 3], [x + 28, y + 11], [x + 19, y + 25], [x + 10, y + 16]).fill('#111111')
  }
  const rawName = String(companyName || '').trim() || 'EIKO DLS'
  const parts = rawName.split(/\s+/).filter(Boolean)
  const line1 = parts.slice(0, 2).join(' ') || 'EIKO'
  const line2 = parts.slice(2).join(' ') || 'DLS'
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text(esc(line1), x + 42, y + 6)
  doc.font('Helvetica-Bold').fontSize(12).text(esc(line2), x + 42, y + 20)
  const support = String(supportContact || '').trim()
  if (support) {
    const safeSupport = support.length > 36 ? `${support.slice(0, 33)}...` : support
    doc.fillColor('#4B5563').font('Helvetica').fontSize(7).text(esc(safeSupport), x + 42, y + 33)
  }
  doc.restore()
}

function resolveDocumentKind(d) {
  const type = String(d?.document_type || '').trim().toLowerCase()
  if (type === 'credit_note') return 'credit_note'
  if (type === 'payout_statement') return 'payout_statement'
  if (String(d?.document_subtype || '').toLowerCase() === 'consolidation') {
    return 'consolidation_invoice'
  }
  const invNo = String(d?.invoice_number || '')
  if (/^CN-\d{4}-/.test(invNo)) return 'credit_note'
  if (/^PST-\d{4}-/.test(invNo)) return 'payout_statement'
  if (/-CON$/.test(invNo)) return 'consolidation_invoice'
  return 'invoice'
}

function documentMeta(kind) {
  if (kind === 'credit_note') {
    return { title: 'CREDIT NOTE', totalLabel: 'Credit Total', paymentLabel: 'Refund Method :' }
  }
  if (kind === 'payout_statement') {
    return { title: 'PAYOUT STATEMENT', totalLabel: 'Payout Total', paymentLabel: 'Payout Method :' }
  }
  if (kind === 'consolidation_invoice') {
    return { title: 'CONSOLIDATION INVOICE', totalLabel: 'Total', paymentLabel: 'Payment Method :' }
  }
  return { title: 'INVOICE', totalLabel: 'Total', paymentLabel: 'Payment Method :' }
}

function buildRows(d, kind, totalUsd) {
  if (kind === 'credit_note') {
    return [
      {
        item: d?.reason || d?.document_subtype || 'Refund or adjustment',
        qty: 1,
        unitPrice: num(d?.amount_credited_usd),
        amount: num(d?.amount_credited_usd),
      },
    ]
  }
  if (kind === 'payout_statement') {
    return [
      {
        item: `Affiliate commission${d?.affiliate_id ? ` (${String(d.affiliate_id).slice(0, 8)})` : ''}`,
        qty: 1,
        unitPrice: num(d?.commission_usd),
        amount: num(d?.commission_usd),
      },
    ]
  }
  const items = Array.isArray(d?.items) ? d.items : []
  if (!items.length) {
    return [{ item: 'No items', qty: 1, unitPrice: totalUsd, amount: totalUsd }]
  }
  return items.map((it) => {
    const qty = Math.max(1, Math.floor(num(it.quantity, 1)))
    const unitPrice = num(it.unit_price_usd, 0)
    return {
      item: it.item_name || 'Item',
      qty,
      unitPrice,
      amount: qty * unitPrice,
    }
  })
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
    const kind = resolveDocumentKind(d)
    const meta = documentMeta(kind)
    const logoPath = resolveLogoPath()

    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    drawTopDecoration(doc, pageWidth)
    drawBottomDecoration(doc, pageWidth, pageHeight)

    const totalUsd =
      kind === 'credit_note'
        ? num(d.amount_credited_usd, 0)
        : kind === 'payout_statement'
          ? num(d.commission_usd, 0)
          : num(ps.total_paid_usd || ps.total_usd, 0)
    const rows = buildRows(d, kind, totalUsd)

    drawBrandMark(
      doc,
      48,
      54,
      logoPath,
      foot.company_name || 'EIKO DLS',
      foot.support_contact || ''
    )
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(52).text(meta.title, 48, 108)
    doc.font('Helvetica-Bold').fontSize(12).text(`NO. ${esc(d.invoice_number || '000001')}`, 420, 96, {
      width: 130,
      align: 'right',
    })
    doc.font('Helvetica-Bold').fontSize(10).text('Date  :', 48, 184)
    doc.font('Helvetica').fontSize(11).text(formatDate(d.issue_date), 90, 183)
    doc.moveTo(48, 206).lineTo(pageWidth - 48, 206).stroke('#E5E7EB')

    const boxY = 218
    const boxW = (pageWidth - 96 - 18) / 2
    doc.font('Helvetica-Bold').fontSize(11).text('Billed to:', 48, boxY)
    doc.font('Helvetica').fontSize(10)
    doc.text(esc(cust.name || 'Customer'), 48, boxY + 18, { width: boxW })
    doc.text(esc(cust.email || '—'), 48, boxY + 34, { width: boxW })
    doc.text(esc(cust.country || 'Brazil'), 48, boxY + 50, { width: boxW })

    doc.font('Helvetica-Bold').fontSize(11).text('From:', 48 + boxW + 18, boxY)
    doc.font('Helvetica').fontSize(10)
    doc.text(esc(foot.company_name || 'EIKO DLS'), 48 + boxW + 18, boxY + 18, { width: boxW })
    doc.text(esc(foot.support_contact || 'support@example.com'), 48 + boxW + 18, boxY + 34, {
      width: boxW,
    })
    const orderRef = d.order_id || d.original_invoice_id || d.statement_id || d.credit_note_id
    if (orderRef) {
      doc.text(`Reference: ${esc(String(orderRef).slice(0, 22))}`, 48 + boxW + 18, boxY + 50, { width: boxW })
    }

    let y = 304
    const tx = 48
    const tw = { item: 260, qty: 80, price: 95, amount: 95 }
    drawTableHeader(doc, tx, y, tw)
    y += 32

    doc.font('Helvetica').fontSize(10).fillColor('#111111')
    for (const row of rows) {
      if (y > pageHeight - 180) break

      doc.text(esc(row.item || 'Item'), tx + 8, y, { width: tw.item - 16 })
      doc.text(String(row.qty || 1), tx + tw.item + 8, y, { width: tw.qty - 16, align: 'center' })
      doc.text(formatUsd(row.unitPrice || 0), tx + tw.item + tw.qty + 8, y, {
        width: tw.price - 16,
        align: 'right',
      })
      doc.text(formatUsd(row.amount || 0), tx + tw.item + tw.qty + tw.price + 8, y, {
        width: tw.amount - 16,
        align: 'right',
      })
      doc.moveTo(tx, y + 18).lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, y + 18).stroke('#E5E7EB')
      y += 24
    }

    const totalY = y + 8
    doc.font('Helvetica-Bold').fontSize(13)
    doc.text(meta.totalLabel, tx + tw.item + tw.qty + 8, totalY, { width: tw.price - 16, align: 'right' })
    doc.text(formatUsd(totalUsd), tx + tw.item + tw.qty + tw.price + 8, totalY, {
      width: tw.amount - 16,
      align: 'right',
    })
    doc.moveTo(tx, totalY - 6).lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, totalY - 6).stroke('#D1D5DB')

    const paymentY = Math.min(totalY + 56, pageHeight - 160)
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#F97316').text(meta.paymentLabel, 48, paymentY)
    doc.fillColor('#111111').font('Helvetica').fontSize(11)
    const method =
      kind === 'credit_note'
        ? d.payment_method || pay.payment_method
        : kind === 'payout_statement'
          ? d.payment_method || pay.payment_method
          : pay.payment_method
    const txn =
      kind === 'credit_note'
        ? d.transaction_id || pay.transaction_id
        : kind === 'payout_statement'
          ? d.transaction_id || pay.transaction_id
          : pay.transaction_id
    const currency =
      kind === 'credit_note'
        ? d.currency || pay.currency || 'USD'
        : kind === 'payout_statement'
          ? pay.currency || 'USD'
          : pay.currency || 'USD'
    doc.font('Helvetica-Bold').text('Payment Type  :', 48, paymentY + 24)
    doc.font('Helvetica').text(esc(method || '—'), 138, paymentY + 24)
    doc.font('Helvetica-Bold').text('Reference    :', 48, paymentY + 40)
    doc.font('Helvetica').text(esc(txn || '—'), 138, paymentY + 40, { width: 360 })
    doc.font('Helvetica-Bold').text('Currency     :', 48, paymentY + 56)
    doc.font('Helvetica').text(esc(currency), 138, paymentY + 56)
    if (fx.exchange_rate_usd_brl) {
      doc.font('Helvetica-Bold').text('FX USD/BRL :', 340, paymentY + 24)
      doc.font('Helvetica').text(esc(fx.exchange_rate_usd_brl), 420, paymentY + 24)
    }
    if (d.order_flow_type) {
      doc.font('Helvetica-Bold').text('Flow       :', 340, paymentY + 40)
      doc.font('Helvetica').text(esc(d.order_flow_type), 420, paymentY + 40)
    }
    if (d.service_fees?.service_type) {
      doc.font('Helvetica-Bold').text('Service    :', 340, paymentY + 56)
      doc.font('Helvetica').text(esc(d.service_fees.service_type), 420, paymentY + 56)
    }
    if (foot.disclaimer) {
      doc.font('Helvetica').fontSize(8).fillColor('#4B5563').text(esc(foot.disclaimer), 48, pageHeight - 58, {
        width: pageWidth - 96,
      })
    }

    doc.end()
  })
}
