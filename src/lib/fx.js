const DEFAULT_FX_BRL_PER_JPY = 0.033

export function getFxBrlPerJpy() {
  const v = Number(import.meta.env.VITE_FX_BRL_PER_JPY)
  return v && v > 0 ? v : DEFAULT_FX_BRL_PER_JPY
}

export function brlToJpy(brl) {
  const fx = getFxBrlPerJpy()
  const n = Number(brl) || 0
  return n / fx
}

export function jpyToBrl(jpy) {
  const fx = getFxBrlPerJpy()
  const n = Number(jpy) || 0
  return n * fx
}

export function formatJPY(v) {
  return Number(v)?.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' }) ?? '—'
}

export function formatBRL(v) {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
}

/** Formata peso em kg para exibição (usa g se < 1 kg). */
export function formatWeight(weightKg) {
  const kg = Number(weightKg)
  if (!Number.isFinite(kg) || kg <= 0) return '—'
  if (kg < 1) return `${Math.round(kg * 1000)} g`
  return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`
}

