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

function flowLabel(flow, locale) {
  const f = String(flow || '').trim().toLowerCase()
  if (f === 'assisted_redirect') return t(locale, 'Redirecionamento assistido', 'Assisted redirect')
  if (f === 'classic_redirect') return t(locale, 'Redirecionamento padrão', 'Standard redirect')
  if (f === 'personal_shopping') return t(locale, 'Personal shopper', 'Personal shopping')
  if (f === 'group_purchase') return t(locale, 'Grupo de compras', 'Group purchase')
  if (f === 'virtual_store') return t(locale, 'Loja virtual', 'Virtual store')
  return String(flow || '—')
}

function humanizePaymentToken(token, locale) {
  const raw = String(token || '').trim()
  if (!raw) return '—'
  const low = raw.toLowerCase()

  if (low === 'wallet_jpy' || /wallet/.test(low)) return t(locale, 'Carteira (JPY)', 'Wallet (JPY)')
  if (low === 'referral_discount') return t(locale, 'Desconto de indicação', 'Referral discount')
  if (low === 'coupon_discount') return t(locale, 'Cupom de desconto', 'Coupon discount')
  if (low.startsWith('parcelow_') || low === 'parcelow') return 'Parcelow'
  if (/pix/.test(low)) return 'PIX'
  if (low.startsWith('pi_') || low.startsWith('ch_') || low.startsWith('cs_')) return 'Stripe'
  if (low === 'wise') return 'Wise'
  if (low === 'internal_transfer') return t(locale, 'Transferência interna', 'Internal transfer')

  return raw
}

function humanizeMethodLabel(method, locale) {
  const parts = String(method || '')
    .split(/\s*\+\s*/)
    .map((p) => humanizePaymentToken(p, locale))
    .filter(Boolean)
  if (parts.length === 0) return '—'
  return parts.join(' + ')
}

function humanizeTransactionRef(txn, locale) {
  const raw = String(txn || '').trim()
  if (!raw) return '—'
  const parts = raw
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return '—'

  return parts
    .map((p) => {
      const low = p.toLowerCase()
      if (low === 'wallet_jpy') return t(locale, 'Débito em carteira (JPY)', 'Wallet debit (JPY)')
      if (low === 'referral_discount') return t(locale, 'Desconto por indicação', 'Referral discount')
      if (low === 'coupon_discount') return t(locale, 'Desconto por cupom', 'Coupon discount')
      if (low.startsWith('parcelow_')) return `Parcelow #${p.slice('parcelow_'.length)}`
      return p
    })
    .join(' | ')
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
  doc.text(t(locale, 'Descrição', 'Description'), x + 8, y + 8, { width: widths.item - 16, lineBreak: false })
  doc.text(t(locale, 'Qtd', 'Qty'), x + widths.item + 8, y + 8, {
    width: widths.qty - 16,
    align: 'center',
    lineBreak: false,
  })
  doc.text(t(locale, 'Preço unit.', 'Unit price'), x + widths.item + widths.qty + 8, y + 8, {
    width: widths.price - 16,
    align: 'right',
    lineBreak: false,
  })
  doc.text(t(locale, 'Valor total', 'Total amount'), x + widths.item + widths.qty + widths.price + 8, y + 8, {
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
      title: t(locale, 'NOTA DE CRÉDITO', 'CREDIT NOTE'),
      totalLabel: t(locale, 'Total crédito', 'Credit total'),
      paymentLabel: t(locale, 'Método de reembolso :', 'Refund method :'),
    }
  }
  if (kind === 'payout_statement') {
    return {
      title: t(locale, 'COMPROVANTE DE REPASSE', 'PAYOUT STATEMENT'),
      totalLabel: t(locale, 'Total repasse', 'Payout total'),
      paymentLabel: t(locale, 'Método de repasse :', 'Payout method :'),
    }
  }
  if (kind === 'consolidation_invoice') {
    return {
      title: t(locale, 'FATURA DE CONSOLIDAÇÃO', 'CONSOLIDATION INVOICE'),
      totalLabel: 'Total',
      paymentLabel: t(locale, 'Método de pagamento :', 'Payment method :'),
    }
  }
  return {
    title: t(locale, 'FATURA', 'INVOICE'),
    totalLabel: 'Total',
    paymentLabel: t(locale, 'Método de pagamento :', 'Payment method :'),
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
        item: `${t(locale, 'Comissão de afiliado', 'Affiliate commission')}${d?.affiliate_id ? ` (${String(d.affiliate_id).slice(0, 8)})` : ''}`,
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
      doc.text(`${t(locale, 'Referência do pedido', 'Order reference')}: ${esc(String(orderRef).slice(0, 22))}`, 48 + boxW + 18, boxY + 50, {
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
    const rowMinHeight = 24
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const itemText = esc(String(row.item || 'Item'))
      const itemHeight = Math.ceil(doc.heightOfString(itemText, { width: tw.item - 16 }))
      const rowHeight = Math.max(rowMinHeight, itemHeight + 6)
      if (y + rowHeight > pageHeight - 60) {
        doc.addPage()
        drawTopDecoration(doc, pageWidth)
        drawBottomDecoration(doc, pageWidth, pageHeight)
        y = 70
        drawTableHeader(doc, tx, y, tw, locale)
        y += 32
      }

      doc.text(itemText, tx + 8, y, { width: tw.item - 16 })
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
      doc.moveTo(tx, y + rowHeight - 6)
        .lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, y + rowHeight - 6)
        .stroke('#E5E7EB')
      y += rowHeight
    }

    if (y + 50 > pageHeight - 60) {
      doc.addPage()
      drawTopDecoration(doc, pageWidth)
      drawBottomDecoration(doc, pageWidth, pageHeight)
      y = 70
    }

    const totalY = y + 8
    doc.font('Helvetica-Bold').fontSize(13)
    doc.text(meta.totalLabel, tx + tw.item + tw.qty + 8, totalY, { width: tw.price - 16, align: 'right' })
    doc.text(formatUsd(totalUsd), tx + tw.item + tw.qty + tw.price + 8, totalY, {
      width: tw.amount - 16,
      align: 'right',
    })
    doc.moveTo(tx, totalY - 6).lineTo(tx + tw.item + tw.qty + tw.price + tw.amount, totalY - 6).stroke('#D1D5DB')
    y = totalY + 22

    const components = normalizeBreakdownComponents(breakdown)
    if (components.length > 0) {
      if (y + 40 > pageHeight - 60) {
        doc.addPage()
        drawTopDecoration(doc, pageWidth)
        drawBottomDecoration(doc, pageWidth, pageHeight)
        y = 70
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
      doc.text(t(locale, 'Como este valor foi calculado', 'How this amount was calculated'), 48, y, {
        width: 330,
      })
      y += 14
      doc.font('Helvetica').fontSize(8).fillColor('#111111')
      for (const c of components) {
        if (y + 12 > pageHeight - 60) {
          doc.addPage()
          drawTopDecoration(doc, pageWidth)
          drawBottomDecoration(doc, pageWidth, pageHeight)
          y = 70
        }
        const label = locale === 'en'
          ? c?.label_en || c?.label_pt || c?.code || 'Item'
          : c?.label_pt || c?.label_en || c?.code || 'Item'
        doc.text(`- ${esc(label)}`, 48, y, { width: 260 })
        doc.text(formatUsd(c?.amount_usd || 0), 310, y, { width: 95, align: 'right' })
        y += 11
      }
      y += 8
    }

    if (y + 110 > pageHeight - 60) {
      doc.addPage()
      drawTopDecoration(doc, pageWidth)
      drawBottomDecoration(doc, pageWidth, pageHeight)
      y = 70
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#F97316').text(meta.paymentLabel, 48, y)
    y += 22
    doc.fillColor('#111111').font('Helvetica').fontSize(10)
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
    const leftPairs = [
      { label: t(locale, 'Forma de pagamento', 'Payment method'), value: humanizeMethodLabel(method, locale) },
      { label: t(locale, 'ID da transação', 'Transaction ID'), value: humanizeTransactionRef(txn, locale) },
      { label: t(locale, 'Moeda de referência', 'Reference currency'), value: currency || '—' },
    ]
    const rightPairs = []
    if (fx.exchange_rate_usd_brl) rightPairs.push({ label: t(locale, 'Cotação USD/BRL', 'USD/BRL rate'), value: fx.exchange_rate_usd_brl })
    const flowText = breakdown.flow_type || d.order_flow_type
    if (flowText) {
      rightPairs.push({ label: t(locale, 'Modalidade', 'Service mode'), value: flowLabel(flowText, locale) })
    }
    const formulaText = breakdown.formula_summary_pt || d.service_fees?.service_type
    if (formulaText) {
      const localizedFormula = locale === 'en' ? breakdown.formula_summary_en || formulaText : formulaText
      rightPairs.push({ label: t(locale, 'Regra de cobrança', 'Charging rule'), value: localizedFormula })
    }

    const drawPairColumn = (x, startY, pairs, labelWidth, valueWidth) => {
      let cy = startY
      for (const pair of pairs) {
        const labelText = `${pair.label}:`
        const valueText = esc(String(pair.value || '—'))
        doc.font('Helvetica-Bold').fontSize(10)
        const hLabel = doc.heightOfString(labelText, { width: labelWidth, lineGap: 1 })
        doc.font('Helvetica').fontSize(10)
        const hValue = doc.heightOfString(valueText, { width: valueWidth, lineGap: 1 })
        const rowHeight = Math.max(hLabel, hValue)

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111111')
          .text(labelText, x, cy, { width: labelWidth, lineGap: 1 })
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#111111')
          .text(valueText, x + labelWidth + 8, cy, { width: valueWidth, lineGap: 1 })

        cy += rowHeight + 8
      }
      return cy
    }

    const leftEndY = drawPairColumn(48, y, leftPairs, 132, 150)
    const rightEndY = drawPairColumn(330, y, rightPairs, 110, 110)
    y = Math.max(leftEndY, rightEndY)

    doc.end()
  })
}
