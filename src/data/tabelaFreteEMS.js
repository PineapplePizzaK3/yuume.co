/**
 * Tabela de frete EMS (Express Mail Service).
 * Peso em gramas, valor em ienes (JPY).
 * Fonte: Japan Post
 */
export const TABELA_FRETE_EMS = [
  { pesoMax: 500, valor: 3600 },
  { pesoMax: 600, valor: 3900 },
  { pesoMax: 700, valor: 4200 },
  { pesoMax: 800, valor: 4500 },
  { pesoMax: 900, valor: 4800 },
  { pesoMax: 1000, valor: 5100 },
  { pesoMax: 1250, valor: 5850 },
  { pesoMax: 1500, valor: 6600 },
  { pesoMax: 1750, valor: 7350 },
  { pesoMax: 2000, valor: 8100 },
  { pesoMax: 2500, valor: 9600 },
  { pesoMax: 3000, valor: 11100 },
  { pesoMax: 3500, valor: 12600 },
  { pesoMax: 4000, valor: 14100 },
  { pesoMax: 4500, valor: 15600 },
  { pesoMax: 5000, valor: 17100 },
  { pesoMax: 5500, valor: 18600 },
  { pesoMax: 6000, valor: 20100 },
  { pesoMax: 7000, valor: 22500 },
  { pesoMax: 8000, valor: 24900 },
  { pesoMax: 9000, valor: 27300 },
  { pesoMax: 10000, valor: 29700 },
  { pesoMax: 11000, valor: 32100 },
  { pesoMax: 12000, valor: 34500 },
  { pesoMax: 13000, valor: 36900 },
  { pesoMax: 14000, valor: 39300 },
  { pesoMax: 15000, valor: 41700 },
  { pesoMax: 16000, valor: 44100 },
  { pesoMax: 17000, valor: 46500 },
  { pesoMax: 18000, valor: 48900 },
  { pesoMax: 19000, valor: 51300 },
  { pesoMax: 20000, valor: 53700 },
  { pesoMax: 21000, valor: 56100 },
  { pesoMax: 22000, valor: 58500 },
  { pesoMax: 23000, valor: 60900 },
  { pesoMax: 24000, valor: 63300 },
  { pesoMax: 25000, valor: 65700 },
  { pesoMax: 26000, valor: 68100 },
  { pesoMax: 27000, valor: 70500 },
  { pesoMax: 28000, valor: 72900 },
  { pesoMax: 29000, valor: 75300 },
  { pesoMax: 30000, valor: 77700 },
]

/**
 * Calcula o valor do frete EMS com base no peso total (gramas).
 * Para peso > 30kg, usa a faixa máxima.
 */
export function calcularFreteEMS(pesoTotalGramas) {
  const peso = Math.ceil(pesoTotalGramas)
  const faixa = TABELA_FRETE_EMS.find((f) => peso <= f.pesoMax)
  return faixa ? faixa.valor : TABELA_FRETE_EMS[TABELA_FRETE_EMS.length - 1].valor
}
