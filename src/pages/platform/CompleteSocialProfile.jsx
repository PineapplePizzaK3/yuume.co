import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { updateProfile, getOrCreateProfile } from '../../services/profileService'
import { validatePassword } from '../../lib/passwordValidation'
import { LEGAL_CONFIG } from '../../data/legalConfig'
import { TermsOfUsePtBrBody } from '../../legal/TermsOfUsePtBrBody'
import { getLocaleFromPathname, localizedPath } from '../../lib/localeRoutes'

const TERMS_CFG = {
  BUSINESS_NAME: LEGAL_CONFIG.BUSINESS_NAME,
  SUPPORT_EMAIL: LEGAL_CONFIG.SUPPORT_EMAIL,
  SUPPORT_PHONE: LEGAL_CONFIG.SUPPORT_PHONE,
}

export default function CompleteSocialProfile() {
  const { t } = useTranslation()
  const { user, refreshProfile, needsSocialOnboarding } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const locale = getLocaleFromPathname(pathname)
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [canAgreeTerms, setCanAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null
  if (!needsSocialOnboarding) {
    navigate(localizedPath('appDashboard', locale), { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const fullName = name.trim()
    if (!fullName) {
      setError(t('auth.nameRequired'))
      return
    }
    const { valid, message } = validatePassword(password)
    if (!valid) {
      setError(message)
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.confirmMismatch'))
      return
    }
    if (!canAgreeTerms) {
      setError(t('auth.mustScrollTerms'))
      return
    }
    if (!agreeTerms) {
      setError(t('auth.mustAgreeTermsComplete'))
      return
    }

    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        password,
        data: {
          ...user.user_metadata,
          name: fullName,
          social_onboarding_completed: true,
          accepted_terms: true,
          accepted_terms_at: new Date().toISOString(),
        },
      })
      if (authErr) {
        setError(authErr.message || t('auth.setPasswordError'))
        setLoading(false)
        return
      }

      const { data: existing } = await getOrCreateProfile(user.id, { email: user.email, name: fullName })
      if (existing) {
        const { error: profileErr } = await updateProfile(user.id, { name: fullName })
        if (profileErr) {
          setError(profileErr.message || t('auth.profileNameError'))
          setLoading(false)
          return
        }
      }

      await refreshProfile()
      navigate(localizedPath('appDashboard', locale), { replace: true })
    } catch (e2) {
      setError(e2?.message || t('auth.completeError'))
    } finally {
      setLoading(false)
    }
  }

  const unlockOnScrollEnd = (event, unlock) => {
    const el = event.currentTarget
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining <= 8) unlock(true)
  }

  return (
    <>
      <PageSeo
        routeKey="appCompleteSocial"
        title={t('meta.completeSocial.title')}
        description={t('meta.completeSocial.description')}
        noindex
      />
      <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-earth-900">{t('auth.completeTitle')}</h1>
        <p className="mt-2 text-sm text-earth-600">{t('auth.completeSubtitle')}</p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-earth-700">{t('auth.fullName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder={t('auth.fullNamePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-700">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder={t('auth.passwordValidation.placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-700">{t('auth.confirmPasswordShort')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder={t('auth.repeatPasswordPlaceholder')}
              required
            />
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-earth-300 bg-white p-3">
              <p className="text-sm font-medium text-earth-800">{t('auth.termsFullTitle')}</p>
              <p className="mt-1 text-xs text-earth-600">{t('auth.termsScrollHint')}</p>
              <div
                className="mt-2 max-h-[min(14rem,38vh)] overflow-y-auto rounded border border-earth-200 bg-earth-50 p-3"
                onScroll={(e) => unlockOnScrollEnd(e, setCanAgreeTerms)}
              >
                <div className="space-y-6">
                  <TermsOfUsePtBrBody cfg={TERMS_CFG} compact />
                </div>
              </div>
              <p className="mt-2 text-xs text-earth-600">
                {t('auth.termsAlsoAt')}{' '}
                <LocalizedLink toRoute="legalTerms" target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                  /legal/terms
                </LocalizedLink>
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
                {t('auth.agreeTermsBefore')}{' '}
                <LocalizedLink toRoute="legalTerms" target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                  {t('auth.agreeTermsLink')}
                </LocalizedLink>{' '}
                {t('auth.agreeTermsAfter')}
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !agreeTerms || !canAgreeTerms}
            className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
          >
            {loading ? t('auth.completeSaving') : t('auth.completeSubmit')}
          </button>
        </form>
      </section>
    </>
  )
}
