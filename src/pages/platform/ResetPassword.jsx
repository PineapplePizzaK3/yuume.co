/**
 * ResetPassword - Página acessada após clicar no link do email.
 * Usuário define nova senha. Supabase recupera a sessão do hash na URL.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { supabase } from '../../lib/supabase'
import { validatePassword } from '../../lib/passwordValidation'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validSession, setValidSession] = useState(null)
  const navigate = useNavigate()
  const path = useLocalizedPath()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('auth.resetPasswordMismatch'))
      return
    }
    const { valid, message } = validatePassword(password)
    if (!valid) {
      setError(message)
      return
    }
    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (err) {
      setError(err.message || t('auth.resetError'))
      return
    }
    setSuccess(true)
    setTimeout(() => navigate(path('login')), 2000)
  }

  if (validSession === false) {
    return (
      <>
        <PageSeo
          routeKey="resetPassword"
          title={t('meta.resetPassword.title')}
          description={t('meta.resetPassword.description')}
          noindex
        />
        <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center">
            <p className="text-earth-700">{t('auth.resetInvalid')}</p>
            <LocalizedLink
              toRoute="forgotPassword"
              className="mt-4 inline-block font-medium text-earth-900 underline hover:no-underline"
            >
              {t('auth.forgotLink')}
            </LocalizedLink>
          </div>
        </section>
      </>
    )
  }

  if (success) {
    return (
      <>
        <PageSeo
          routeKey="resetPassword"
          title={t('meta.resetPassword.title')}
          description={t('meta.resetPassword.description')}
          noindex
        />
        <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center">
            <p className="text-earth-900">{t('auth.resetSuccess')}</p>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageSeo
        routeKey="resetPassword"
        title={t('meta.resetPassword.title')}
        description={t('meta.resetPassword.description')}
        noindex
      />
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">{t('auth.resetTitle')}</h1>
          <p className="mt-1 text-sm text-earth-600">{t('auth.resetSubtitle')}</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-earth-700">
                {t('auth.newPassword')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder={t('auth.passwordValidation.placeholder')}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-earth-700">
                {t('auth.confirmNewPassword')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? t('auth.saving') : t('auth.resetSubmit')}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
