export default async function handler(req, res) {
  return res.status(503).json({
    error: 'Referral system is temporarily disabled',
    code: 'REFERRAL_DISABLED',
  })
}
