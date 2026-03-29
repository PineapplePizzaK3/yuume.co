/**
 * Register page - Supabase Auth sign up.
 * Com confirmação por email: usuário deve clicar no link recebido antes de acessar.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getOrCreateProfile } from '../../services/profileService'
import { validatePassword, PASSWORD_PLACEHOLDER } from '../../lib/passwordValidation'
import { LEGAL_CONFIG } from '../../data/legalConfig'
import { TermsOfUsePtBrBody } from '../../legal/TermsOfUsePtBrBody'

const TERMS_CFG = {
  BUSINESS_NAME: LEGAL_CONFIG.BUSINESS_NAME,
  SUPPORT_EMAIL: LEGAL_CONFIG.SUPPORT_EMAIL,
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [canAgreeTerms, setCanAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const { signUp, signInWithOAuth, isAuthenticated, needsSocialOnboarding } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    navigate(needsSocialOnboarding ? '/app/complete-social-profile' : '/app/dashboard', { replace: true })
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
    if (!canAgreeTerms) {
      setError('Role até o final dos Termos de Uso para liberar o aceite.')
      return
    }
    if (!agreeTerms) {
      setError('É necessário concordar com os Termos de Uso para se cadastrar.')
      return
    }
    const { valid, message } = validatePassword(password)
    if (!valid) {
      setError(message)
      return
    }
    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    setNeedsConfirmation(false)

    const referralCode = (localStorage.getItem('referral_signup_code') || '').trim().toUpperCase()
    const metadata = { name }
    if (referralCode) metadata.referral_code = referralCode

    const { data, error: err } = await signUp(email, password, {
      userMetadata: metadata,
    })

    setLoading(false)
    if (err) {
      setError(err.message || 'Erro ao criar conta')
      return
    }
    if (data?.user) {
      if (referralCode && data.user.id) {
        localStorage.removeItem('referral_signup_code')
      }
      if (data?.session) {
        await getOrCreateProfile(data.user.id, { email, name })
        setSuccess(true)
        setTimeout(() => navigate('/app/dashboard', { replace: true }), 1500)
      } else {
        setNeedsConfirmation(true)
      }
    }
  }

  const unlockOnScrollEnd = (event, unlock) => {
    const el = event.currentTarget
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining <= 8) unlock(true)
  }

  if (success) {
    return (
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="rounded-lg border border-earth-200 bg-earth-100 p-6 text-center">
          <p className="text-earth-900">Conta criada com sucesso. Redirecionando...</p>
        </div>
      </section>
    )
  }

  if (needsConfirmation) {
    return (
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md rounded-lg border border-earth-200 bg-earth-100 p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">Verifique seu email</h1>
          <p className="mt-4 text-earth-700">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Clique no link para ativar sua conta.
          </p>
          <p className="mt-2 text-sm text-earth-600">
            Não encontrou o email? Verifique a pasta de spam.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-earth-900 px-6 py-3 font-medium text-earth-50 hover:bg-earth-800"
          >
            Ir para login
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <Helmet>
        <title>Cadastre-se | Plataforma</title>
      </Helmet>
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-2xl rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">Cadastre-se</h1>
          <p className="mt-1 text-sm text-earth-600">
            Crie sua conta na plataforma
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
              <label htmlFor="name" className="block text-sm font-medium text-earth-700">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder="Seu nome"
              />
            </div>
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
              <label htmlFor="password" className="block text-sm font-medium text-earth-700">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder={PASSWORD_PLACEHOLDER}
              />
            </div>
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-earth-700">
                Confirmar senha
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder="Digite a senha novamente"
              />
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <p className="mt-1 text-xs text-red-600">As senhas não coincidem.</p>
              )}
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-earth-300 bg-white p-3">
                <p className="text-sm font-medium text-earth-800">Termos de Uso (texto integral)</p>
                <p className="mt-1 text-xs text-earth-600">Role até o final para habilitar o aceite.</p>
                <div
                  className="mt-2 max-h-[min(14rem,38vh)] overflow-y-auto rounded border border-earth-200 bg-earth-50 p-3"
                  onScroll={(e) => unlockOnScrollEnd(e, setCanAgreeTerms)}
                >
                  <div className="space-y-6">
                    <TermsOfUsePtBrBody cfg={TERMS_CFG} compact />
                  </div>
                </div>
                <p className="mt-2 text-xs text-earth-600">
                  Versão também em{' '}
                  <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                    /legal/terms
                  </Link>
                  .
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  disabled={!canAgreeTerms}
                  className="mt-1 rounded border-earth-300 text-earth-900"
                />
                <span className="text-sm text-earth-700">
                  Li e concordo com os{' '}
                  <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                    Termos de Uso
                  </Link>{' '}
                  acima.
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={
                loading ||
                !agreeTerms ||
                !canAgreeTerms ||
                !password.trim() ||
                !passwordConfirm.trim() ||
                password !== passwordConfirm
              }
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? 'Criando conta...' : 'Cadastrar'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-earth-600">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-earth-900 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
