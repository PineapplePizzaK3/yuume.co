export const PRODUCT_CONDITION_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'sealed', label: 'Nao aberto (lacrado)' },
  { value: 'used', label: 'Usado' },
  { value: 'refurbished', label: 'Recondicionado' },
  { value: 'for_parts', label: 'Para pecas' },
]

const CONDITION_SET = new Set(PRODUCT_CONDITION_OPTIONS.map((item) => item.value))

export function normalizeProductCondition(value) {
  const raw = String(value || '').trim().toLowerCase()
  return CONDITION_SET.has(raw) ? raw : 'new'
}

export function getProductConditionMeta(value) {
  const normalized = normalizeProductCondition(value)
  const option = PRODUCT_CONDITION_OPTIONS.find((item) => item.value === normalized)

  const styleByCondition = {
    new: 'bg-green-100 text-green-800 border-green-200',
    sealed: 'bg-blue-100 text-blue-800 border-blue-200',
    used: 'bg-amber-100 text-amber-800 border-amber-200',
    refurbished: 'bg-violet-100 text-violet-800 border-violet-200',
    for_parts: 'bg-rose-100 text-rose-800 border-rose-200',
  }

  return {
    value: normalized,
    label: option?.label || 'Novo',
    className: styleByCondition[normalized] || styleByCondition.new,
  }
}
