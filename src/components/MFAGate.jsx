/**
 * MFAGate - Exibe tela de verificação TOTP quando o usuário precisa completar 2FA.
 * Usado quando AAL nextLevel é aal2 mas currentLevel é aal1.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function MFAGate({ onVerified }) {
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error

      const totpFactor = factors.data?.totp?.[0]
      if (!totpFactor) {
        setError('Nenhum fator de autenticação configurado.')
        setLoading(false)
        return
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: verifyCode.trim(),
      })
      if (verify.error) throw verify.error

      onVerified?.()
    } catch (err) {
      setError(err?.message || 'Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-earth-900">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-earth-600">
          Digite o código de 6 dígitos do seu app autenticador (Google Authenticator, etc).
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-earth-700">
              Código
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-4 py-3 text-center text-lg tracking-[0.5em] text-earth-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading || verifyCode.length !== 6}
            className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
      </div>
    </div>
  )
}
