export const BRAZIL_STATE_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/**
 * Alíquotas internas de referência (2026) para estimativa de ICMS na importação.
 * Fonte agregada: Conta Azul (tabela ICMS 2026 por UF).
 * A aplicação real depende de NCM, benefícios e regras do RICMS de cada estado.
 */
export const ICMS_INTERNAL_RATE_BY_STATE_2026 = {
  AC: 19,
  AL: 20.5,
  AP: 18,
  AM: 20,
  BA: 20.5,
  CE: 20,
  DF: 20,
  ES: 17,
  GO: 19,
  MA: 23,
  MT: 17,
  MS: 17,
  MG: 18,
  PA: 19,
  PB: 20,
  PR: 19.5,
  PE: 20.5,
  PI: 22.5,
  RJ: 20,
  RN: 20,
  RS: 17,
  RO: 19.5,
  RR: 20,
  SC: 17,
  SP: 18,
  SE: 19,
  TO: 20,
}

export const ICMS_REFERENCE_LABEL = 'ICMS interno por UF (referência 2026)'
