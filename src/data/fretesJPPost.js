/**
 * Tabelas de fretes Japan Post para envio ao Brasil (Zona 5).
 * Valores em ienes (¥). Fonte: Japan Post (post.japanpost.jp)
 */

/** International Parcel Post - Via aérea. Peso em kg. Zona 5. */
export const TABELA_PARCEL_AEREO = [
  { pesoMax: 1, valor: 4550 },
  { pesoMax: 2, valor: 7250 },
  { pesoMax: 3, valor: 9950 },
  { pesoMax: 4, valor: 12650 },
  { pesoMax: 5, valor: 15350 },
  { pesoMax: 6, valor: 18050 },
  { pesoMax: 7, valor: 20750 },
  { pesoMax: 8, valor: 23450 },
  { pesoMax: 9, valor: 26150 },
  { pesoMax: 10, valor: 28850 },
  { pesoMax: 15, valor: 37850 },
  { pesoMax: 20, valor: 46850 },
  { pesoMax: 25, valor: 55850 },
  { pesoMax: 30, valor: 64850 },
]

/** International Parcel Post - Via marítima. Peso em kg. Zona 5. */
export const TABELA_PARCEL_MARITIMO = [
  { pesoMax: 1, valor: 2700 },
  { pesoMax: 2, valor: 3400 },
  { pesoMax: 3, valor: 4100 },
  { pesoMax: 4, valor: 4800 },
  { pesoMax: 5, valor: 5500 },
  { pesoMax: 10, valor: 9000 },
  { pesoMax: 15, valor: 12000 },
  { pesoMax: 20, valor: 15000 },
  { pesoMax: 25, valor: 18000 },
  { pesoMax: 30, valor: 21000 },
]

/** International Parcel Post - Via aérea econômica (SAL). Peso em kg. Zona 5. */
export const TABELA_PARCEL_SAL = [
  { pesoMax: 1, valor: 3500 },
  { pesoMax: 2, valor: 5400 },
  { pesoMax: 3, valor: 7300 },
  { pesoMax: 4, valor: 9200 },
  { pesoMax: 5, valor: 11100 },
  { pesoMax: 10, valor: 17100 },
  { pesoMax: 15, valor: 23100 },
  { pesoMax: 20, valor: 29100 },
  { pesoMax: 25, valor: 35100 },
  { pesoMax: 30, valor: 41100 },
]

/** ePacket Light - Zona 5 (Brasil). Peso em gramas. Até 2kg. */
export const TABELA_EPACKET = [
  { pesoMax: 100, valor: 920 },
  { pesoMax: 200, valor: 1180 },
  { pesoMax: 300, valor: 1440 },
  { pesoMax: 400, valor: 1700 },
  { pesoMax: 500, valor: 1960 },
  { pesoMax: 600, valor: 2220 },
  { pesoMax: 700, valor: 2480 },
  { pesoMax: 800, valor: 2740 },
  { pesoMax: 900, valor: 3000 },
  { pesoMax: 1000, valor: 3260 },
  { pesoMax: 1200, valor: 3780 },
  { pesoMax: 1400, valor: 4300 },
  { pesoMax: 1600, valor: 4820 },
  { pesoMax: 1800, valor: 5340 },
  { pesoMax: 2000, valor: 5860 },
]

/** Calcula frete Parcel (aéreo, marítimo ou SAL). Peso em gramas. */
export function calcularFreteParcel(pesoGramas, tipo) {
  const tabelas = {
    aereo: TABELA_PARCEL_AEREO,
    maritimo: TABELA_PARCEL_MARITIMO,
    sal: TABELA_PARCEL_SAL,
  }
  const tabela = tabelas[tipo] || TABELA_PARCEL_AEREO
  const pesoKg = Math.ceil(pesoGramas / 1000)
  const faixa = tabela.find((f) => pesoKg <= f.pesoMax)
  return faixa ? faixa.valor : tabela[tabela.length - 1].valor
}

/** Calcula frete ePacket Light. Peso em gramas. Máx 2kg. */
export function calcularFreteEPacket(pesoGramas) {
  const peso = Math.ceil(Math.min(pesoGramas, 2000))
  const faixa = TABELA_EPACKET.find((f) => peso <= f.pesoMax)
  return faixa ? faixa.valor : TABELA_EPACKET[TABELA_EPACKET.length - 1].valor
}
