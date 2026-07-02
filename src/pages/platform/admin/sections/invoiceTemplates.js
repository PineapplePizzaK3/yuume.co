/**
 * Templates para criação de documentos financeiros no admin.
 * Passo 1: escolher template → Passo 2: preencher campos do template.
 */
export const INVOICE_CREATE_TEMPLATES = [
  {
    id: 'manual_invoice',
    label: 'Fatura manual',
    subtitle: 'Pedido externo',
    description: 'Cliente, itens e pagamento preenchidos manualmente. Não usa pedido na plataforma.',
    mode: 'manual',
    invoiceKind: 'invoice',
    accentClass: 'border-orange-300 bg-orange-50/60 ring-orange-400',
  },
  {
    id: 'manual_consolidation',
    label: 'Consolidação manual',
    subtitle: 'Frete / fase 2',
    description: 'Fatura de consolidação ou frete internacional, sem pedido na plataforma.',
    mode: 'manual',
    invoiceKind: 'consolidation_invoice',
    accentClass: 'border-amber-300 bg-amber-50/60 ring-amber-400',
    defaults: {
      items: [{ itemName: 'Frete internacional', quantity: '1', unitPriceUsd: '' }],
    },
  },
  {
    id: 'from_order',
    label: 'A partir de pedido',
    subtitle: 'Plataforma',
    description: 'Gera snapshot automático de um pedido pago existente (requer orderId).',
    mode: 'order',
    accentClass: 'border-earth-300 bg-white ring-earth-500',
  },
  {
    id: 'credit_note',
    label: 'Nota de crédito',
    subtitle: 'Estorno / ajuste',
    description: 'Documento de crédito vinculado a fatura ou pedido.',
    mode: 'credit_note',
    accentClass: 'border-earth-300 bg-white ring-earth-500',
  },
  {
    id: 'payout_statement',
    label: 'Repasse de afiliado',
    subtitle: 'Payout',
    description: 'Comprovante de repasse de comissão.',
    mode: 'payout',
    accentClass: 'border-earth-300 bg-white ring-earth-500',
  },
]

export function getInvoiceTemplate(id) {
  return INVOICE_CREATE_TEMPLATES.find((t) => t.id === id) || null
}

export const ORDER_INVOICE_SKIP_MESSAGES = {
  order_not_found: 'Pedido não encontrado. Verifique o orderId ou use o template "Fatura manual" para pedidos externos.',
  not_eligible_status: 'Pedido encontrado, mas ainda não está pago (status deve ser paid ou products_paid).',
  missing_params: 'Informe o orderId do pedido na plataforma.',
  duplicate: 'Já existe documento deste tipo para este pedido.',
}
