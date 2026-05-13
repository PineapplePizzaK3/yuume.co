/**
 * Minha Conta - Informações do usuário, endereços e segurança.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { PageSeo } from '../../components/PageSeo'
import { PasswordInput } from '../../components/PasswordInput'
import { localizedPath } from '../../lib/localeRoutes'
import {
  getProfile,
  updateProfile,
  uploadKycDocument,
  removeKycDocumentFromStorage,
} from '../../services/profileService'
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../services/addressService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { validatePassword } from '../../lib/passwordValidation'
import { supabase } from '../../lib/supabase'

const MAX_KYC_FILES = 5
const CONTA_TAB_ORDER_STORAGE_KEY = 'conta_tabs_order_v1'

function normalizeKycDocuments(raw) {
  if (!raw) return []
  if (!Array.isArray(raw)) return []
  return raw.filter((d) => d && typeof d.path === 'string')
}

function normalizeProfileRow(p) {
  if (!p) return null
  return { ...p, kyc_documents: normalizeKycDocuments(p.kyc_documents) }
}

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const TAB_IDS = ['dados', 'seguranca']
const TAB_ICONS = { dados: '👤', seguranca: '🔐' }

export default function Conta() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const { user, refreshProfile, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('dados')
  const [draggingTabId, setDraggingTabId] = useState('')
  const tabs = useMemo(
    () =>
      TAB_IDS.map((id) => ({
        id,
        icon: TAB_ICONS[id],
        label: id === 'dados' ? t('platform.conta.tabPersonal') : t('platform.conta.tabSecurity'),
      })),
    [t],
  )
  const [tabOrder, setTabOrder] = useState(() => [...TAB_IDS])
  const [profileForm, setProfileForm] = useState({ name: '', cpf_cnpj: '', phone: '' })
  const [addressForm, setAddressForm] = useState({
    label: '',
    recipient_name: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Brasil',
  })
  const [securityMessage, setSecurityMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)

  // MFA (Google Authenticator)
  const [mfaFactors, setMfaFactors] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaEnrollData, setMfaEnrollData] = useState(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState('')

  const [kycMessage, setKycMessage] = useState('')
  const [kycUploading, setKycUploading] = useState(false)
  const [kycPreviewUrls, setKycPreviewUrls] = useState({})

  const loadData = async (active = () => true) => {
    if (!user?.id) {
      if (active()) setLoading(false)
      return
    }
    if (active()) setLoading(true)
    try {
      const k = cacheKey(user.id, 'conta_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && active()) {
        setProfile(normalizeProfileRow(cached.profile))
        setAddresses(cached.addresses ?? [])
        setLoading(false)
      }
      const [prof, addr] = await Promise.all([
        getProfile(user.id),
        getAddresses(user.id),
      ])
      if (!active()) return
      const profNorm = normalizeProfileRow(prof.data ?? null)
      setProfile(profNorm)
      setAddresses(addr.data ?? [])
      writeCache(k, { profile: profNorm, addresses: addr.data ?? [] })
      if (prof.error || addr.error) {
        setMessage(prof.error?.message || addr.error?.message || t('platform.conta.loadError'))
      }
    } catch (e) {
      if (active()) setMessage(e?.message || t('platform.conta.loadError'))
    } finally {
      if (active()) setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    loadData(() => isActive)
    return () => {
      isActive = false
    }
  }, [user?.id])

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name ?? '',
        cpf_cnpj: profile.cpf_cnpj ?? '',
        phone: profile.phone ?? '',
      })
    }
  }, [profile])

  const normalizeTabOrder = (raw) => {
    const allowed = [...TAB_IDS]
    const base = Array.isArray(raw) ? raw : []
    const safe = base.filter((id) => allowed.includes(id))
    for (const id of allowed) {
      if (!safe.includes(id)) safe.push(id)
    }
    return safe
  }

  const orderedTabs = normalizeTabOrder(tabOrder)

  const handleTabReorder = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    setTabOrder((prev) => {
      const current = normalizeTabOrder(prev)
      const draggedIndex = current.indexOf(draggedId)
      const targetIndex = current.indexOf(targetId)
      if (draggedIndex < 0 || targetIndex < 0) return current
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedId)
      return current
    })
  }

  useEffect(() => {
    if (!user?.id) {
      setTabOrder([...TAB_IDS])
      return
    }
    try {
      const raw = localStorage.getItem(CONTA_TAB_ORDER_STORAGE_KEY)
      if (!raw) {
        setTabOrder([...TAB_IDS])
        return
      }
      const all = JSON.parse(raw)
      setTabOrder(normalizeTabOrder(all?.[user.id]))
    } catch {
      setTabOrder([...TAB_IDS])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(CONTA_TAB_ORDER_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      all[user.id] = normalizeTabOrder(tabOrder)
      localStorage.setItem(CONTA_TAB_ORDER_STORAGE_KEY, JSON.stringify(all))
    } catch {
      // ignore
    }
  }, [user?.id, tabOrder])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      name: profileForm.name,
      cpf_cnpj: profileForm.cpf_cnpj,
      phone: profileForm.phone,
    }
    const { error } = await updateProfile(user.id, payload)
    setSaving(false)
    setMessage(error ? error.message : t('platform.conta.profileSaved'))
    if (!error) {
      // Atualiza o estado local e o AuthContext (Navbar/menu/dashboard) imediatamente.
      setProfile((p) => (p ? { ...p, ...payload } : p))
      await refreshProfile()
      loadData()
    }
  }

  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      recipient_name: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Brasil',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      label: addressForm.label,
      recipient_name: addressForm.recipient_name,
      street: addressForm.street,
      number: addressForm.number,
      complement: addressForm.complement,
      neighborhood: addressForm.neighborhood,
      city: addressForm.city,
      state: addressForm.state,
      postal_code: addressForm.postal_code,
      country: addressForm.country,
    }
    if (editingId) {
      const { error } = await updateAddress(user.id, editingId, payload)
      setMessage(error ? error.message : t('platform.conta.addressUpdated'))
      if (!error) {
        resetAddressForm()
        loadData()
      }
    } else {
      const { error } = await createAddress(user.id, payload)
      setMessage(error ? error.message : t('platform.conta.addressAdded'))
      if (!error) {
        resetAddressForm()
        loadData()
      }
    }
    setSaving(false)
  }

  const handleEditAddress = (addr) => {
    setAddressForm({
      label: addr.label ?? '',
      recipient_name: addr.recipient_name,
      street: addr.street,
      number: addr.number,
      complement: addr.complement ?? '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      country: addr.country ?? 'Brasil',
    })
    setEditingId(addr.id)
    setShowForm(true)
  }

  const handleDeleteAddress = async (id) => {
    if (!confirm(t('platform.conta.confirmRemoveAddress'))) return
    setSaving(true)
    const { error } = await deleteAddress(user.id, id)
    setMessage(error ? error.message : t('platform.conta.addressRemoved'))
    if (!error) loadData()
    setSaving(false)
  }

  const isOAuthUser = () => {
    const identities = user?.identities ?? []
    const hasEmail = identities.some((i) => i?.provider === 'email')
    return !hasEmail && identities.length > 0
  }

  const loadMfaFactors = async () => {
    if (!user?.id) return
    setMfaLoading(true)
    setMfaError('')
    const { data, error } = await supabase.auth.mfa.listFactors()
    setMfaLoading(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaFactors(data)
  }

  useEffect(() => {
    if (activeTab === 'seguranca' && user?.id) loadMfaFactors()
  }, [activeTab, user?.id])

  useEffect(() => {
    const docs = normalizeKycDocuments(profile?.kyc_documents)
    if (docs.length === 0) {
      setKycPreviewUrls({})
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const map = {}
      for (const doc of docs) {
        const { data, error } = await supabase.storage
          .from('kyc-documents')
          .createSignedUrl(doc.path, 3600)
        if (!cancelled && !error && data?.signedUrl) map[doc.path] = data.signedUrl
      }
      if (!cancelled) setKycPreviewUrls(map)
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.kyc_documents])

  const isKycPdf = (doc) => {
    const n = (doc.original_name || doc.path || '').toLowerCase()
    return n.endsWith('.pdf')
  }

  const handleKycUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user?.id) return
    const current = normalizeKycDocuments(profile?.kyc_documents)
    if (current.length >= MAX_KYC_FILES) {
      setKycMessage(t('platform.conta.kycMaxFiles', { max: MAX_KYC_FILES }))
      return
    }
    setKycUploading(true)
    setKycMessage('')
    const { data: docMeta, error: upErr } = await uploadKycDocument(file, user.id)
    if (upErr) {
      setKycUploading(false)
      setKycMessage(upErr.message || t('platform.conta.kycUploadFail'))
      return
    }
    const nextDocs = [...current, docMeta]
    const { error: saveErr } = await updateProfile(user.id, { kyc_documents: nextDocs })
    if (saveErr) {
      await removeKycDocumentFromStorage([docMeta.path])
      setKycUploading(false)
      setKycMessage(saveErr.message || t('platform.conta.kycSaveFail'))
      return
    }
    setProfile((p) => (p ? { ...p, kyc_documents: nextDocs } : p))
    const k = cacheKey(user.id, 'conta_v1')
    const cached = readCache(k, 1000 * 60 * 30)
    if (cached?.profile) {
      writeCache(k, {
        ...cached,
        profile: { ...normalizeProfileRow(cached.profile), kyc_documents: nextDocs },
      })
    }
    setKycUploading(false)
    setKycMessage(t('platform.conta.kycUploadSuccess'))
  }

  const handleRemoveKyc = async (path) => {
    if (!path || !user?.id) return
    if (!confirm(t('platform.conta.confirmRemoveKyc'))) return
    setKycUploading(true)
    setKycMessage('')
    const { error: rmErr } = await removeKycDocumentFromStorage([path])
    if (rmErr) {
      setKycUploading(false)
      setKycMessage(rmErr.message || t('platform.conta.kycRemoveStorageFail'))
      return
    }
    const nextDocs = normalizeKycDocuments(profile?.kyc_documents).filter((d) => d.path !== path)
    const { error: saveErr } = await updateProfile(user.id, { kyc_documents: nextDocs })
    if (saveErr) {
      setKycUploading(false)
      setKycMessage(saveErr.message || t('platform.conta.kycProfileUpdateFail'))
      return
    }
    setProfile((p) => (p ? { ...p, kyc_documents: nextDocs } : p))
    const k = cacheKey(user.id, 'conta_v1')
    const cached = readCache(k, 1000 * 60 * 30)
    if (cached?.profile) {
      writeCache(k, {
        ...cached,
        profile: { ...normalizeProfileRow(cached.profile), kyc_documents: nextDocs },
      })
    }
    setKycUploading(false)
    setKycMessage(t('platform.conta.kycRemoved'))
  }

  const startMfaEnroll = async () => {
    setMfaError('')
    setMfaEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: t('platform.conta.mfaFriendlyName'),
    })
    setMfaEnrolling(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaEnrollData(data)
    setMfaVerifyCode('')
  }

  const cancelMfaEnroll = () => {
    setMfaEnrollData(null)
    setMfaVerifyCode('')
    setMfaError('')
  }

  const confirmMfaEnroll = async (e) => {
    e.preventDefault()
    if (!mfaEnrollData) return
    setMfaError('')
    const code = mfaVerifyCode.trim()
    if (!code || code.length !== 6) {
      setMfaError(t('platform.conta.mfaCodeHint'))
      return
    }
    setMfaEnrolling(true)
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id })
    if (challenge.error) {
      setMfaError(challenge.error.message)
      setMfaEnrolling(false)
      return
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: mfaEnrollData.id,
      challengeId: challenge.data.id,
      code,
    })
    setMfaEnrolling(false)
    if (verify.error) {
      setMfaError(verify.error.message)
      return
    }
    setMfaEnrollData(null)
    setMfaVerifyCode('')
    loadMfaFactors()
  }

  const handleMfaUnenroll = async () => {
    const totp = mfaFactors?.totp?.[0]
    if (!totp) return
    if (!confirm(t('platform.conta.mfaUnenrollConfirm'))) return
    setMfaError('')
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id })
    setMfaLoading(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    loadMfaFactors()
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setSecurityMessage('')
    const { currentPassword, newPassword, confirm: confirmVal } = passwordForm
    if (!currentPassword) {
      setSecurityMessage(t('platform.conta.passwordCurrentRequired'))
      return
    }
    const { valid, message } = validatePassword(newPassword)
    if (!valid) {
      setSecurityMessage(message)
      return
    }
    if (newPassword !== confirmVal) {
      setSecurityMessage(t('platform.conta.passwordMismatch'))
      return
    }
    setPasswordSaving(true)
    const email = user?.email || profile?.email
    if (!email) {
      setPasswordSaving(false)
      setSecurityMessage(t('platform.conta.passwordReauthFail'))
      return
    }
    // Reautentica com senha atual antes de permitir a troca.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauthError) {
      setPasswordSaving(false)
      setSecurityMessage(t('platform.conta.passwordWrongCurrent'))
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    setSecurityMessage(error ? error.message : t('platform.conta.passwordChanged'))
    if (!error) setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' })
  }

  return (
    <>
      <PageSeo
        routeKey="appConta"
        title={t('meta.appConta.title')}
        description={t('meta.appConta.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.conta.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.conta.subtitle')}</p>

        <nav className="mt-6 border-b border-earth-200">
          <div className="flex gap-1">
            {orderedTabs.map((tabId) => {
              const tab = tabs.find((entry) => entry.id === tabId)
              if (!tab) return null
              return (
              <button
                key={tab.id}
                type="button"
                draggable
                onClick={() => setActiveTab(tab.id)}
                onDragStart={(e) => {
                  setDraggingTabId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                  handleTabReorder(draggingTabId, tab.id)
                }}
                onDragEnd={() => setDraggingTabId('')}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-earth-900 bg-earth-50 text-earth-900'
                    : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
              )
            })}
          </div>
        </nav>

        {loading && <p className="mt-6 text-earth-600">{t('platform.conta.loading')}</p>}

        {!loading && activeTab === 'dados' && (
          <div className="mt-6 space-y-8 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            {/* Dados pessoais */}
            <section className="rounded-xl border border-earth-200 bg-earth-50 p-6">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.personalData')}</h2>
              <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-earth-700">{t('platform.conta.email')}</label>
                  <input
                    type="email"
                    value={profile?.email ?? user?.email ?? ''}
                    readOnly
                    className="mt-1 block w-full rounded-lg border border-earth-200 bg-earth-100 px-3 py-2 text-earth-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">{t('platform.conta.fullName')}</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('platform.conta.fullNamePlaceholder')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">{t('platform.conta.cpfCnpj')}</label>
                  <input
                    type="text"
                    value={profileForm.cpf_cnpj}
                    onChange={(e) => setProfileForm((f) => ({ ...f, cpf_cnpj: e.target.value }))}
                    placeholder={t('platform.conta.cpfPlaceholder')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">{t('platform.conta.phone')}</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder={t('platform.conta.phonePlaceholder')}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  {message && <p className="mb-2 text-sm text-earth-600">{message}</p>}
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                  >
                    {saving ? t('platform.conta.saving') : t('platform.conta.saveData')}
                  </button>
                </div>
              </form>
            </section>

            {/* Verificação de identidade (KYC) */}
            <section className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.kycTitle')}</h2>
              <p className="mt-2 text-sm text-earth-600">{t('platform.conta.kycIntro')}</p>
              <p className="mt-2 text-xs text-earth-500">
                {t('platform.conta.kycFormats', { max: MAX_KYC_FILES })}
              </p>

              {kycMessage && (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                    /success|removed|sucesso|removido/i.test(kycMessage)
                      ? 'bg-green-50 text-green-800'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {kycMessage}
                </p>
              )}

              <div className="mt-4">
                <label className="inline-flex cursor-pointer items-center rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {kycUploading ? t('platform.conta.kycUploading') : t('platform.conta.kycUpload')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    disabled={kycUploading || normalizeKycDocuments(profile?.kyc_documents).length >= MAX_KYC_FILES}
                    onChange={handleKycUpload}
                  />
                </label>
                <span className="ml-3 text-sm text-earth-500">
                  {t('platform.conta.kycUploaded', {
                    current: normalizeKycDocuments(profile?.kyc_documents).length,
                    max: MAX_KYC_FILES,
                  })}
                </span>
              </div>

              {normalizeKycDocuments(profile?.kyc_documents).length > 0 && (
                <ul className="mt-4 space-y-3">
                  {normalizeKycDocuments(profile?.kyc_documents).map((doc) => (
                    <li
                      key={doc.path}
                      className="flex flex-col gap-3 rounded-lg border border-earth-200 bg-earth-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex flex-1 items-start gap-3">
                        {!isKycPdf(doc) && kycPreviewUrls[doc.path] ? (
                          <img
                            src={kycPreviewUrls[doc.path]}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded border border-earth-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-earth-200 bg-earth-100 text-2xl">
                            {isKycPdf(doc) ? '📄' : '🖼️'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-earth-900">
                            {doc.original_name || doc.path.split('/').pop()}
                          </p>
                          {doc.uploaded_at && (
                            <p className="text-xs text-earth-500">
                              {t('platform.conta.kycUploadedAt')}{' '}
                              {new Date(doc.uploaded_at).toLocaleString(dateLocale, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </p>
                          )}
                          {isKycPdf(doc) && kycPreviewUrls[doc.path] && (
                            <a
                              href={kycPreviewUrls[doc.path]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-sm font-medium text-earth-800 underline hover:no-underline"
                            >
                              {t('platform.conta.kycOpenPdf')}
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveKyc(doc.path)}
                        disabled={kycUploading}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {t('platform.conta.kycRemove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Endereços */}
            <section className="rounded-xl border border-earth-200 bg-earth-50 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.addresses')}</h2>
                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="rounded-lg bg-earth-900 px-3 py-1.5 text-sm font-medium text-earth-50 hover:bg-earth-800"
                  >
                    {t('platform.conta.newAddress')}
                  </button>
                )}
              </div>

              {showForm && (
                <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 rounded-lg border border-earth-200 bg-white p-4">
                  <div className="grid gap-3">
                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.addressLabel')}</label>
                      <input
                        type="text"
                        value={addressForm.label}
                        onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.recipient')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.recipient_name}
                        onChange={(e) => setAddressForm((f) => ({ ...f, recipient_name: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.postalCode')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.postal_code}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postal_code: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.street')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.number')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.number}
                        onChange={(e) => setAddressForm((f) => ({ ...f, number: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.complement')}</label>
                      <input
                        type="text"
                        value={addressForm.complement}
                        onChange={(e) => setAddressForm((f) => ({ ...f, complement: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.neighborhood')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.neighborhood}
                        onChange={(e) => setAddressForm((f) => ({ ...f, neighborhood: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.city')}</label>
                      <input
                        required
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.state')}</label>
                      <select
                        required
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      >
                        <option value="">{t('platform.conta.selectState')}</option>
                        {ESTADOS.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">{t('platform.conta.country')}</label>
                      <input
                        type="text"
                        value={addressForm.country}
                        onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                    >
                      {saving ? t('platform.conta.saving') : editingId ? t('platform.conta.update') : t('platform.conta.add')}
                    </button>
                    <button
                      type="button"
                      onClick={resetAddressForm}
                      className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      {t('platform.conta.cancel')}
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-4 space-y-3">
                {addresses.length === 0 && !showForm && (
                  <p className="text-earth-600">{t('platform.conta.noAddresses')}</p>
                )}
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="flex items-start justify-between rounded-lg border border-earth-200 bg-white p-4"
                  >
                    <div>
                      {addr.label && (
                        <span className="text-sm font-medium text-earth-900">{addr.label}</span>
                      )}
                      <p className="text-earth-800">
                        {addr.recipient_name}, {addr.street}, {addr.number}
                        {addr.complement ? `, ${addr.complement}` : ''}
                      </p>
                      <p className="text-sm text-earth-600">
                        {addr.neighborhood}, {addr.city} - {addr.state} {addr.postal_code}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditAddress(addr)}
                        className="text-sm font-medium text-earth-600 hover:text-earth-900"
                      >
                        {t('platform.conta.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        {t('platform.conta.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {!loading && activeTab === 'seguranca' && (
          <div className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            <section className="rounded-xl border border-earth-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.changePassword')}</h2>
              {isOAuthUser() ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">{t('platform.conta.oauthPasswordNote')}</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="mt-4 max-w-md space-y-4">
                  <div>
                    <label htmlFor="conta-current-password" className="block text-sm font-medium text-earth-700">
                      {t('platform.conta.currentPassword')}
                    </label>
                    <PasswordInput
                      id="conta-current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                      autoComplete="current-password"
                      placeholder={t('platform.conta.currentPasswordPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="conta-new-password" className="block text-sm font-medium text-earth-700">
                      {t('platform.conta.newPassword')}
                    </label>
                    <PasswordInput
                      id="conta-new-password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={t('auth.passwordValidation.placeholder')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="conta-confirm-password" className="block text-sm font-medium text-earth-700">
                      {t('platform.conta.confirmNewPassword')}
                    </label>
                    <PasswordInput
                      id="conta-confirm-password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={t('platform.conta.repeatPasswordPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                  {securityMessage && (
                    <p
                      className={`text-sm ${
                        /success|sucesso/i.test(securityMessage) ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {securityMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                  >
                    {passwordSaving ? t('platform.conta.saving') : t('platform.conta.changePasswordSubmit')}
                  </button>
                </form>
              )}
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.mfaTitle')}</h2>
              <p className="mt-2 text-sm text-earth-600">{t('platform.conta.mfaIntro')}</p>
              {mfaError && (
                <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mfaError}</p>
              )}
              {mfaLoading && <p className="mt-3 text-sm text-earth-600">{t('platform.conta.loading')}</p>}
              {!mfaLoading && !mfaEnrollData && (
                <div className="mt-4">
                  {mfaFactors?.totp?.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                        {t('platform.conta.mfaStatusOn')}
                      </span>
                      <button
                        type="button"
                        onClick={handleMfaUnenroll}
                        disabled={mfaLoading}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-70"
                      >
                        {t('platform.conta.mfaDisable')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startMfaEnroll}
                      disabled={mfaEnrolling}
                      className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                    >
                      {mfaEnrolling ? t('platform.conta.mfaPreparing') : t('platform.conta.mfaActivate')}
                    </button>
                  )}
                </div>
              )}
              {mfaEnrollData && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-earth-700">{t('platform.conta.mfaScanHint')}</p>
                  <div className="flex flex-wrap gap-6">
                    {mfaEnrollData.totp?.qr_code && (
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(mfaEnrollData.totp.qr_code)}`}
                        alt={t('platform.conta.mfaQrAlt')}
                        width={200}
                        height={200}
                        className="rounded-lg border border-earth-200"
                      />
                    )}
                    {mfaEnrollData.totp?.secret && (
                      <div>
                        <p className="text-xs font-medium text-earth-600">{t('platform.conta.mfaManualSecret')}</p>
                        <code className="mt-1 block break-all rounded bg-earth-100 px-2 py-1 text-sm">
                          {mfaEnrollData.totp.secret}
                        </code>
                      </div>
                    )}
                  </div>
                  <form onSubmit={confirmMfaEnroll} className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-sm font-medium text-earth-700">{t('platform.conta.mfaCode6')}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mfaVerifyCode}
                        onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="mt-1 w-32 rounded-lg border border-earth-300 px-3 py-2 text-center tracking-widest"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={mfaEnrolling || mfaVerifyCode.length !== 6}
                        className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                      >
                        {mfaEnrolling ? t('platform.conta.mfaVerifying') : t('platform.conta.mfaConfirm')}
                      </button>
                      <button
                        type="button"
                        onClick={cancelMfaEnroll}
                        disabled={mfaEnrolling}
                        className="rounded-lg border border-earth-300 px-4 py-2 text-earth-700 hover:bg-earth-50 disabled:opacity-70"
                      >
                        {t('platform.conta.mfaCancelEnroll')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.conta.sessionTitle')}</h2>
              <p className="mt-2 text-sm text-earth-600">{t('platform.conta.sessionIntro')}</p>
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  window.location.href = localizedPath('login', locale)
                }}
                className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {t('platform.conta.signOut')}
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
