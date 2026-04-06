/**
 * ForgotPassword - Solicita email para reset de senha.
 * Supabase envia link; usuário clica e é redirecionado para /reset-password.
 */
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import { getLocaleFromPathname, localizedPath } from '../../lib/localeRoutes'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const locale = getLocaleFromPathname(pathname)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const base = String(siteUrl || '').replace(/\/$/, '')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}${localizedPath('resetPassword', locale)}`,
    })

    setLoading(false)
    if (err) {
      setError(err.message || t('auth.sendLinkError'))
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <>
        <PageSeo
          routeKey="forgotPassword"
          title={t('meta.forgotPassword.title')}
          description={t('meta.forgotPassword.description')}
          noindex
        />
        <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-earth-900">{t('auth.forgotSuccessTitle')}</h1>
            <p className="mt-4 text-earth-700">
              {t('auth.forgotSuccessSentTo')} <strong>{email}</strong>. {t('auth.forgotSuccessClick')}
            </p>
            <p className="mt-2 text-sm text-earth-600">{t('auth.forgotSpam')}</p>
            <LocalizedLink
              toRoute="login"
              className="mt-6 inline-block text-sm font-medium text-earth-900 underline hover:no-underline"
            >
              {t('auth.backToLogin')}
            </LocalizedLink>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageSeo
        routeKey="forgotPassword"
        title={t('meta.forgotPassword.title')}
        description={t('meta.forgotPassword.description')}
        noindex
      />
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-earth-200 bg-earth-100 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-earth-900">{t('auth.forgotPageTitle')}</h1>
          <p className="mt-1 text-sm text-earth-600">{t('auth.forgotSubtitle')}</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-earth-700">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {loading ? t('auth.sending') : t('auth.sendLink')}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-earth-600">
            <LocalizedLink toRoute="login" className="font-medium text-earth-900 hover:underline">
              {t('auth.backToLogin')}
            </LocalizedLink>
          </p>
        </div>
      </section>
    </>
  )
}
