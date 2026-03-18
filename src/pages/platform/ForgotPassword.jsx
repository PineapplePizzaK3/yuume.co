/**
 * ForgotPassword - Solicita email para reset de senha.
 * Supabase envia link; usuário clica e é redirecionado para /reset-password.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    })

    setLoading(false)
    if (err) {
      setError(err.message || 'Erro ao enviar email')
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <>
        <Helmet>
          <title>Email enviado | Esqueci minha senha</title>
        </Helmet>
        <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-earth-900">Verifique seu email</h1>
            <p className="mt-4 text-earth-700">
              Enviamos um link para <strong>{email}</strong>. Clique no link para redefinir sua senha.
            </p>
            <p className="mt-2 text-sm text-earth-600">
              Não encontrou? Verifique a pasta de spam.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-sm font-medium text-earth-900 underline hover:no-underline"
            >
              Voltar ao login
            </Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Esqueci minha senha | Plataforma</title>
      </Helmet>
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">Esqueceu sua senha?</h1>
          <p className="mt-1 text-sm text-earth-600">
            Informe seu email e enviaremos um link para redefinir
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-earth-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder="seu@email.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-earth-600">
            <Link to="/login" className="font-medium text-earth-900 hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
