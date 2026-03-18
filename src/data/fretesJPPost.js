/**
 * Tabelas de fretes Japan Post para envio ao Brasil (Zona 5).
 * Valores em ienes (¥). Fonte: Japan Post (post.japanpost.jp)
 */

/** International Parcel Post - Via aérea. Peso em kg. Zona 5. */
export const TABELA_PARCEL_AEREO = [
  // Japan Post: International Parcel Post (Airmail), Fifth Zone
  // Valores em JPY; "up to X kg" (faixa mínima é a própria faixa).
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
  { pesoMax: 11, valor: 30650 },
  { pesoMax: 12, valor: 32450 },
  { pesoMax: 13, valor: 34250 },
  { pesoMax: 14, valor: 36050 },
  { pesoMax: 15, valor: 37850 },
  { pesoMax: 16, valor: 39650 },
  { pesoMax: 17, valor: 41450 },
  { pesoMax: 18, valor: 43250 },
  { pesoMax: 19, valor: 45050 },
  { pesoMax: 20, valor: 46850 },
  { pesoMax: 21, valor: 48650 },
  { pesoMax: 22, valor: 50450 },
  { pesoMax: 23, valor: 52250 },
  { pesoMax: 24, valor: 54050 },
  { pesoMax: 25, valor: 55850 },
  { pesoMax: 26, valor: 57650 },
  { pesoMax: 27, valor: 59450 },
  { pesoMax: 28, valor: 61250 },
  { pesoMax: 29, valor: 63050 },
  { pesoMax: 30, valor: 64850 },
]

/** International Parcel Post - Via marítima. Peso em kg. Zona 5. */
export const TABELA_PARCEL_MARITIMO = [
  // Japan Post: International Parcel Post (Surface Mail), Fifth Zone
  { pesoMax: 1, valor: 2700 },
  { pesoMax: 2, valor: 3400 },
  { pesoMax: 3, valor: 4100 },
  { pesoMax: 4, valor: 4800 },
  { pesoMax: 5, valor: 5500 },
  { pesoMax: 6, valor: 6200 },
  { pesoMax: 7, valor: 6900 },
  { pesoMax: 8, valor: 7600 },
  { pesoMax: 9, valor: 8300 },
  { pesoMax: 10, valor: 9000 },
  { pesoMax: 11, valor: 9600 },
  { pesoMax: 12, valor: 10200 },
  { pesoMax: 13, valor: 10800 },
  { pesoMax: 14, valor: 11400 },
  { pesoMax: 15, valor: 12000 },
  { pesoMax: 16, valor: 12600 },
  { pesoMax: 17, valor: 13200 },
  { pesoMax: 18, valor: 13800 },
  { pesoMax: 19, valor: 14400 },
  { pesoMax: 20, valor: 15000 },
  { pesoMax: 21, valor: 15600 },
  { pesoMax: 22, valor: 16200 },
  { pesoMax: 23, valor: 16800 },
  { pesoMax: 24, valor: 17400 },
  { pesoMax: 25, valor: 18000 },
  { pesoMax: 26, valor: 18600 },
  { pesoMax: 27, valor: 19200 },
  { pesoMax: 28, valor: 19800 },
  { pesoMax: 29, valor: 20400 },
  { pesoMax: 30, valor: 21000 },
]

/** International Parcel Post - Via aérea econômica (SAL). Peso em kg. Zona 5. */
export const TABELA_PARCEL_SAL = [
  // Japan Post: International Parcel Post (Economy Air / SAL), Fifth Zone
  { pesoMax: 1, valor: 3500 },
  { pesoMax: 2, valor: 5400 },
  { pesoMax: 3, valor: 7300 },
  { pesoMax: 4, valor: 9200 },
  { pesoMax: 5, valor: 11100 },
  { pesoMax: 6, valor: 12300 },
  { pesoMax: 7, valor: 13500 },
  { pesoMax: 8, valor: 14700 },
  { pesoMax: 9, valor: 15900 },
  { pesoMax: 10, valor: 17100 },
  { pesoMax: 11, valor: 18300 },
  { pesoMax: 12, valor: 19500 },
  { pesoMax: 13, valor: 20700 },
  { pesoMax: 14, valor: 21900 },
  { pesoMax: 15, valor: 23100 },
  { pesoMax: 16, valor: 24300 },
  { pesoMax: 17, valor: 25500 },
  { pesoMax: 18, valor: 26700 },
  { pesoMax: 19, valor: 27900 },
  { pesoMax: 20, valor: 29100 },
  { pesoMax: 21, valor: 30300 },
  { pesoMax: 22, valor: 31500 },
  { pesoMax: 23, valor: 32700 },
  { pesoMax: 24, valor: 33900 },
  { pesoMax: 25, valor: 35100 },
  { pesoMax: 26, valor: 36300 },
  { pesoMax: 27, valor: 37500 },
  { pesoMax: 28, valor: 38700 },
  { pesoMax: 29, valor: 39900 },
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
