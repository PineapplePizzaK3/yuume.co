/**
 * ResetPassword - Página acessada após clicar no link do email.
 * Usuário define nova senha. Supabase recupera a sessão do hash na URL.
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validSession, setValidSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (err) {
      setError(err.message || 'Erro ao redefinir senha')
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/login'), 2000)
  }

  if (validSession === false) {
    return (
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center">
          <p className="text-earth-700">Link inválido ou expirado. Solicite um novo.</p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block font-medium text-earth-900 underline hover:no-underline"
          >
            Esqueci minha senha
          </Link>
        </div>
      </section>
    )
  }

  if (success) {
    return (
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center">
          <p className="text-earth-900">Senha alterada com sucesso. Redirecionando para o login...</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <Helmet>
        <title>Nova senha | Plataforma</title>
      </Helmet>
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">Nova senha</h1>
          <p className="mt-1 text-sm text-earth-600">
            Digite e confirme sua nova senha
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-earth-700">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-earth-700">
                Confirmar senha
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
