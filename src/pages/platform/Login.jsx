/**
 * Login page - Supabase Auth sign in.
 */
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signInWithOAuth, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/app/dashboard'

  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  const handleOAuth = async (provider) => {
    setError('')
    const { error: err } = await signInWithOAuth(provider)
    if (err) setError(err.message || `Erro ao conectar com ${provider}`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: err } = await signIn(email, password)

    setLoading(false)
    if (err) {
      setError(err.message || 'Erro ao fazer login')
      return
    }
    if (data?.user) {
      navigate(from, { replace: true })
    }
  }

  return (
    <>
      <Helmet>
        <title>Login | Plataforma</title>
      </Helmet>
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">Entrar</h1>
          <p className="mt-1 text-sm text-earth-600">
            Acesse sua conta na plataforma
          </p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-earth-300 bg-white px-4 py-3 font-medium text-earth-900 transition hover:bg-earth-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('facebook')}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-earth-300 bg-[#1877F2] px-4 py-3 font-medium text-white transition hover:bg-[#166FE5]"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continuar com Facebook
            </button>
          </div>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-earth-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-earth-100 px-2 text-earth-600">ou com email</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-earth-700">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-earth-600 hover:text-earth-900 hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-earth-600">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-earth-900 hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
