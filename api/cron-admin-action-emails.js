import { runAdminActionEmailNotifier } from '../server-lib/adminActionEmailNotifier.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await runAdminActionEmailNotifier(req)
    return res.status(result.status).json(result.body)
  } catch (e) {
    console.error('cron-admin-action-emails:', e)
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    })
  }
}
