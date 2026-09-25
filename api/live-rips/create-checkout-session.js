export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  return res.status(400).json({
    error: 'Checkout externo desativado para Live Rips. Use apenas créditos da carteira da plataforma.',
  })
}
