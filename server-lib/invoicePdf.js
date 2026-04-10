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

function truncateText(value, max = 48) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 3))}...`
}

function resolveRenderLocale(d = {}) {
  const raw = String(d?.document_locale || d?.locale || '').toLowerCase()
  return raw.startsWith('en') ? 'en' : 'pt-BR'
}

function t(locale, pt, en) {
  return locale === 'en' ? en : pt
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

function drawTableHeader(doc, x, y, widths, locale) {
  doc.save()
  doc.rect(x, y, widths.item + widths.qty + widths.price + widths.amount, 26).fill('#F3F4F6')
  doc.fillColor('#1F2937').font('Helvetica-Bold').fontSize(10)
  doc.text(t(locale, 'Item', 'Item'), x + 8, y + 8, { width: widths.item - 16, lineBreak: false })
  doc.text(t(locale, 'Qtd', 'Qty'), x + widths.item + 8, y + 8, {
    width: widths.qty - 16,
    align: 'center',
    lineBreak: false,
  })
  doc.text(t(locale, 'Preco', 'Price'), x + widths.item + widths.qty + 8, y + 8, {
    width: widths.price - 16,
    align: 'right',
    lineBreak: false,
  })
  doc.text(t(locale, 'Valor', 'Amount'), x + widths.item + widths.qty + widths.price + 8, y + 8, {
    width: widths.amount - 16,
    align: 'right',
    lineBreak: false,
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
  companyName = "Eiko's Delivery Service",
  supportContact = 'support@eiko-dls.com'
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
  const rawName = String(companyName || '').trim() || "Eiko's Delivery Service"
  const parts = rawName.split(/\s+/).filter(Boolean)
  const line1 = parts.slice(0, 2).join(' ') || 'EIKO'
  const line2 = parts.slice(2).join(' ') || 'DLS'
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text(esc(line1), x + 42, y + 6)
  doc.font('Helvetica-Bold').fontSize(12).text(esc(line2), x + 42, y + 20)
  const support = String(supportContact || 'support@eiko-dls.com').trim()
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

function documentMeta(kind, locale) {
  if (kind === 'credit_note') {
    return {
      title: t(locale, 'NOTA DE CREDITO', 'CREDIT NOTE'),
      totalLabel: t(locale, 'Total credito', 'Credit total'),
      paymentLabel: t(locale, 'Metodo de reembolso :', 'Refund method :'),
    }
  }
  if (kind === 'payout_statement') {
    return {
      title: t(locale, 'COMPROVANTE DE REPASSE', 'PAYOUT STATEMENT'),
      totalLabel: t(locale, 'Total repasse', 'Payout total'),
      paymentLabel: t(locale, 'Metodo de repasse :', 'Payout method :'),
    }
  }
  if (kind === 'consolidation_invoice') {
    return {
      title: t(locale, 'FATURA DE CONSOLIDACAO', 'CONSOLIDATION INVOICE'),
      totalLabel: 'Total',
      paymentLabel: t(locale, 'Metodo de pagamento :', 'Payment method :'),
    }
  }
  return {
    title: t(locale, 'FATURA', 'INVOICE'),
    totalLabel: 'Total',
    paymentLabel: t(locale, 'Metodo de pagamento :', 'Payment method :'),
  }
}

function buildRows(d, kind, totalUsd, locale) {
  if (kind === 'credit_note') {
    return [
      {
        item: d?.reason || d?.document_subtype || t(locale, 'Reembolso ou ajuste', 'Refund or adjustment'),
        qty: 1,
        unitPrice: num(d?.amount_credited_usd),
        amount: num(d?.amount_credited_usd),
      },
    ]
  }
  if (kind === 'payout_statement') {
    return [
      {
        item: `${t(locale, 'Comissao de afiliado', 'Affiliate commission')}${d?.affiliate_id ? ` (${String(d.affiliate_id).slice(0, 8)})` : ''}`,
        qty: 1,
        unitPrice: num(d?.commission_usd),
        amount: num(d?.commission_usd),
      },
    ]
  }
  const items = Array.isArray(d?.items) ? d.items : []
  if (!items.length) {
    return [{ item: t(locale, 'Sem itens', 'No items'), qty: 1, unitPrice: totalUsd, amount: totalUsd }]
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

function normalizeBreakdownComponents(breakdown) {
  const list = Array.isArray(breakdown?.components) ? breakdown.components : []
  const priority = {
    products_subtotal: 10,
    service_fee_assisted: 20,
    service_fee_personal: 20,
    service_fee_group: 20,
    service_fee_redirect: 20,
    store_service_or_markup: 20,
    service_fee_assisted_formula_estimate: 30,
    service_fee_personal_formula_estimate: 30,
    service_fee_group_formula_estimate: 30,
    service_fee_redirect_formula_estimate: 30,
    shipping_fee: 40,
    discount: 50,
    wallet_credit: 60,
  }
  return [...list]
    .filter(Boolean)
    .sort((a, b) => (priority[a?.code] || 999) - (priority[b?.code] || 999))
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
    const breakdown = d.billing_breakdown || {}
    const kind = resolveDocumentKind(d)
    const locale = resolveRenderLocale(d)
    const meta = documentMeta(kind, locale)
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
    const rows = buildRows(d, kind, totalUsd, locale)

    drawBrandMark(
      doc,
      48,
      54,
      logoPath,
      foot.company_name || "Eiko's Delivery Service",
      foot.support_contact || 'support@eiko-dls.com'
    )
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(29).text(meta.title, 48, 116, {
      width: 390,
      lineBreak: false,
    })
    doc.font('Helvetica-Bold').fontSize(12).text(`NO. ${esc(d.invoice_number || '000001')}`, 420, 96, {
      width: 130,
      align: 'right',
      lineBreak: false,
    })
    doc.font('Helvetica-Bold').fontSize(10).text(t(locale, 'Data :', 'Date :'), 48, 184, { lineBreak: false })
    doc.font('Helvetica').fontSize(11).text(formatDate(d.issue_date), 126, 183, { lineBreak: false })
    doc.moveTo(48, 206).lineTo(pageWidth - 48, 206).stroke('#E5E7EB')

    const boxY = 218
    const boxW = (pageWidth - 96 - 18) / 2
    doc.font('Helvetica-Bold').fontSize(11).text(t(locale, 'Cobrado para:', 'Billed to:'), 48, boxY, { lineBreak: false })
    doc.font('Helvetica').fontSize(10)
    doc.text(esc(truncateText(cust.name || t(locale, 'Cliente', 'Customer'), 30)), 48, boxY + 18, {
      width: boxW,
      lineBreak: false,
    })
    doc.text(esc(truncateText(cust.email || '—', 32)), 48, boxY + 34, { width: boxW, lineBreak: false })
    doc.text(esc(truncateText(cust.country || 'Brazil', 24)), 48, boxY + 50, {
      width: boxW,
      lineBreak: false,
    })

    doc.font('Helvetica-Bold').fontSize(11).text(t(locale, 'Emitido por:', 'From:'), 48 + boxW + 18, boxY, {
      lineBreak: false,
    })
    doc.font('Helvetica').fontSize(10)
    doc.text(esc(truncateText(foot.company_name || "Eiko's Delivery Service", 30)), 48 + boxW + 18, boxY + 18, {
      width: boxW,
      lineBreak: false,
    })
    doc.text(esc(truncateText(foot.support_contact || 'support@eiko-dls.com', 32)), 48 + boxW + 18, boxY + 34, {
      width: boxW,
      lineBreak: false,
    })
    const orderRef = d.order_id || d.original_invoice_id || d.statement_id || d.credit_note_id
    if (orderRef) {
      doc.text(`${t(locale, 'Referencia', 'Reference')}: ${esc(String(orderRef).slice(0, 22))}`, 48 + boxW + 18, boxY + 50, {
        width: boxW,
        lineBreak: false,
      })
    }

    let y = 304
    const tx = 48
    const tw = { item: 260, qty: 80, price: 95, amount: 95 }
    drawTableHeader(doc, tx, y, tw, locale)
    y += 32

    doc.font('Helvetica').fontSize(10).fillColor('#111111')
    const rowHeight = 24
    const rowsLimitBySpace = Math.max(1, Math.floor((pageHeight - 430 - y) / rowHeight))
    const maxRows = Math.min(8, rowsLimitBySpace)
    const hiddenRows = Math.max(0, rows.length - maxRows)
    const rowsToRender = rows.slice(0, maxRows)
    if (hiddenRows > 0 && rowsToRender.length > 0) {
      const last = rowsToRender[rowsToRender.length - 1]
      rowsToRender[rowsToRender.length - 1] = {
        ...last,
        item: `${truncateText(last.item, 28)} (+${hiddenRows} ${t(locale, 'itens', 'items')})`,
      }
    }
    for (const row of rowsToRender) {

      doc.text(esc(truncateText(row.item || 'Item', 38)), tx + 8, y, { width: tw.item - 16, lineBreak: false })
      doc.text(String(row.qty || 1), tx + tw.item + 8, y, { width: tw.qty - 16, align: 'center', lineBreak: false })
      doc.text(formatUsd(row.unitPrice || 0), tx + tw.item + tw.qty + 8, y, {
        width: tw.price - 16,
        align: 'right',
        lineBreak: false,
      })
      doc.text(formatUsd(row.amount || 0), tx + tw.item + tw.qty + tw.price + 8, y, {
        width: tw.amount - 16,
        align: 'right',
        lineBreak: false,
      })
      doc.moveTo(tx, y + 18).lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, y + 18).stroke('#E5E7EB')
      y += rowHeight
    }

    const totalY = y + 8
    doc.font('Helvetica-Bold').fontSize(13)
    doc.text(meta.totalLabel, tx + tw.item + tw.qty + 8, totalY, { width: tw.price - 16, align: 'right' })
    doc.text(formatUsd(totalUsd), tx + tw.item + tw.qty + tw.price + 8, totalY, {
      width: tw.amount - 16,
      align: 'right',
    })
    doc.moveTo(tx, totalY - 6).lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, totalY - 6).stroke('#D1D5DB')

    const paymentY = pageHeight - 154
    const components = normalizeBreakdownComponents(breakdown)
    const breakdownTitleY = totalY + 20
    const breakdownRowStartY = breakdownTitleY + 12
    const maxBreakdownRowsBySpace = Math.max(
      0,
      Math.floor((paymentY - 8 - breakdownRowStartY) / 10)
    )
    const maxBreakdownRows = Math.min(6, maxBreakdownRowsBySpace)
    if (components.length > 0 && maxBreakdownRows > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
      doc.text(t(locale, 'Composicao da cobranca', 'Charge breakdown'), 48, breakdownTitleY, {
        width: 300,
        lineBreak: false,
      })
      doc.font('Helvetica').fontSize(8).fillColor('#111111')
      const visible = components.slice(0, maxBreakdownRows)
      visible.forEach((c, idx) => {
        const yy = breakdownRowStartY + idx * 10
        const label = truncateText(
          locale === 'en' ? c?.label_en || c?.label_pt || c?.code : c?.label_pt || c?.label_en || c?.code || 'Item',
          38
        )
        doc.text(`- ${esc(label)}`, 48, yy, { width: 225, lineBreak: false })
        doc.text(formatUsd(c?.amount_usd || 0), 236, yy, {
          width: 110,
          align: 'right',
          lineBreak: false,
        })
      })
      if (components.length > maxBreakdownRows) {
        doc.fillColor('#6B7280').fontSize(8).text(
          `+${components.length - maxBreakdownRows} ${t(locale, 'itens adicionais', 'additional items')}`,
          48,
          breakdownRowStartY + maxBreakdownRows * 10,
          { width: 300, lineBreak: false }
        )
      }
    }

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
    doc.font('Helvetica-Bold').text(`${t(locale, 'Tipo', 'Type')}    :`, 48, paymentY + 24, { lineBreak: false })
    doc.font('Helvetica').text(esc(truncateText(method || '—', 26)), 138, paymentY + 24, { lineBreak: false })
    doc.font('Helvetica-Bold').text(`${t(locale, 'Ref', 'Reference')}:`, 48, paymentY + 40, { lineBreak: false })
    doc.font('Helvetica').text(esc(truncateText(txn || '—', 40)), 138, paymentY + 40, {
      width: 360,
      lineBreak: false,
    })
    doc.font('Helvetica-Bold').text(`${t(locale, 'Moeda', 'Currency')}:`, 48, paymentY + 56, { lineBreak: false })
    doc.font('Helvetica').text(esc(currency), 138, paymentY + 56, { lineBreak: false })
    if (fx.exchange_rate_usd_brl) {
      doc.font('Helvetica-Bold').text(t(locale, 'Cambio :', 'FX :'), 340, paymentY + 24, { lineBreak: false })
      doc.font('Helvetica').text(esc(fx.exchange_rate_usd_brl), 420, paymentY + 24, { lineBreak: false })
    }
    const flowText = breakdown.flow_type || d.order_flow_type
    if (flowText) {
      doc.font('Helvetica-Bold').text(t(locale, 'Fluxo :', 'Flow :'), 340, paymentY + 40, { lineBreak: false })
      doc.font('Helvetica').text(esc(truncateText(flowText, 16)), 420, paymentY + 40, { lineBreak: false })
    }
    const formulaText = breakdown.formula_summary_pt || d.service_fees?.service_type
    if (formulaText) {
      const localizedFormula = locale === 'en' ? breakdown.formula_summary_en || formulaText : formulaText
      doc.font('Helvetica-Bold').text(t(locale, 'Formula :', 'Formula :'), 340, paymentY + 56, { lineBreak: false })
      doc.font('Helvetica').text(esc(truncateText(localizedFormula, 24)), 420, paymentY + 56, {
        lineBreak: false,
      })
    }
    if (foot.disclaimer) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#4B5563')
        .text(esc(truncateText(foot.disclaimer, 150)), 48, pageHeight - 58, {
          width: pageWidth - 96,
          lineBreak: false,
        })
    }

    doc.end()
  })
}
