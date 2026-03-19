/**
 * Minha Conta - Informações do usuário, endereços e segurança.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getProfile, updateProfile } from '../../services/profileService'
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../services/addressService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { validatePassword, PASSWORD_PLACEHOLDER } from '../../lib/passwordValidation'
import { supabase } from '../../lib/supabase'

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function Conta() {
  const { user, refreshProfile, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('dados')
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
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)

  // MFA (Google Authenticator)
  const [mfaFactors, setMfaFactors] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaEnrollData, setMfaEnrollData] = useState(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState('')

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
        setProfile(cached.profile ?? null)
        setAddresses(cached.addresses ?? [])
        setLoading(false)
      }
      const [prof, addr] = await Promise.all([
        getProfile(user.id),
        getAddresses(user.id),
      ])
      if (!active()) return
      setProfile(prof.data ?? null)
      setAddresses(addr.data ?? [])
      writeCache(k, { profile: prof.data ?? null, addresses: addr.data ?? [] })
      if (prof.error || addr.error) {
        setMessage(prof.error?.message || addr.error?.message || 'Erro ao carregar dados')
      }
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar dados')
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
    setMessage(error ? error.message : 'Dados salvos')
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
      setMessage(error ? error.message : 'Endereço atualizado')
      if (!error) {
        resetAddressForm()
        loadData()
      }
    } else {
      const { error } = await createAddress(user.id, payload)
      setMessage(error ? error.message : 'Endereço adicionado')
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
    if (!confirm('Remover este endereço?')) return
    setSaving(true)
    const { error } = await deleteAddress(user.id, id)
    setMessage(error ? error.message : 'Endereço removido')
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

  const startMfaEnroll = async () => {
    setMfaError('')
    setMfaEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Plataforma',
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
      setMfaError('Digite o código de 6 dígitos do seu app.')
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
    if (!confirm('Tem certeza que deseja desativar a autenticação em duas etapas?')) return
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
    const { newPassword, confirm: confirmVal } = passwordForm
    const { valid, message } = validatePassword(newPassword)
    if (!valid) {
      setSecurityMessage(message)
      return
    }
    if (newPassword !== confirmVal) {
      setSecurityMessage('As senhas não coincidem')
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    setSecurityMessage(error ? error.message : 'Senha alterada com sucesso')
    if (!error) setPasswordForm({ newPassword: '', confirm: '' })
  }

  const TABS = [
    { id: 'dados', label: 'Dados pessoais', icon: '👤' },
    { id: 'seguranca', label: 'Segurança', icon: '🔐' },
  ]

  return (
    <>
      <Helmet>
        <title>Minha Conta | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Minha Conta</h1>
        <p className="mt-2 text-earth-600">Seus dados, endereços e configurações de segurança</p>

        <nav className="mt-6 border-b border-earth-200">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-earth-900 bg-earth-50 text-earth-900'
                    : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && activeTab === 'dados' && (
          <div className="mt-6 space-y-8 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            {/* Dados pessoais */}
            <section className="rounded-xl border border-earth-200 bg-earth-50 p-6">
              <h2 className="text-lg font-semibold text-earth-900">Dados pessoais</h2>
              <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-earth-700">Email</label>
                  <input
                    type="email"
                    value={profile?.email ?? user?.email ?? ''}
                    readOnly
                    className="mt-1 block w-full rounded-lg border border-earth-200 bg-earth-100 px-3 py-2 text-earth-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">Nome completo</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Seu nome completo"
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={profileForm.cpf_cnpj}
                    onChange={(e) => setProfileForm((f) => ({ ...f, cpf_cnpj: e.target.value }))}
                    placeholder="000.000.000-00"
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">Telefone</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
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
                    {saving ? 'Salvando...' : 'Salvar dados'}
                  </button>
                </div>
              </form>
            </section>

            {/* Endereços */}
            <section className="rounded-xl border border-earth-200 bg-earth-50 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-earth-900">Endereços</h2>
                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="rounded-lg bg-earth-900 px-3 py-1.5 text-sm font-medium text-earth-50 hover:bg-earth-800"
                  >
                    + Novo endereço
                  </button>
                )}
              </div>

              {showForm && (
                <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 rounded-lg border border-earth-200 bg-white p-4">
                  <div className="grid gap-3">
                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Nome do endereço</label>
                      <input
                        type="text"
                        value={addressForm.label}
                        onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Destinatário *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.recipient_name}
                        onChange={(e) => setAddressForm((f) => ({ ...f, recipient_name: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">CEP *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.postal_code}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postal_code: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Rua/Avenida *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Número *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.number}
                        onChange={(e) => setAddressForm((f) => ({ ...f, number: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Complemento</label>
                      <input
                        type="text"
                        value={addressForm.complement}
                        onChange={(e) => setAddressForm((f) => ({ ...f, complement: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Bairro *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.neighborhood}
                        onChange={(e) => setAddressForm((f) => ({ ...f, neighborhood: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">Cidade *</label>
                      <input
                        required
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">UF *</label>
                      <select
                        required
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      >
                        <option value="">Selecione</option>
                        {ESTADOS.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <label className="text-sm font-medium text-earth-700">País</label>
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
                      {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}
                    </button>
                    <button
                      type="button"
                      onClick={resetAddressForm}
                      className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-4 space-y-3">
                {addresses.length === 0 && !showForm && (
                  <p className="text-earth-600">Nenhum endereço cadastrado.</p>
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
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remover
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
              <h2 className="text-lg font-semibold text-earth-900">Alterar senha</h2>
              {isOAuthUser() ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">
                    Você entrou com um provedor externo (Google, etc). A senha é gerenciada pelo provedor.
                    Para redefinir o acesso, use a opção &quot;Esqueci minha senha&quot; na tela de login com seu email.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="mt-4 max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Nova senha</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                      minLength={8}
                      placeholder={PASSWORD_PLACEHOLDER}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Confirmar nova senha</label>
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                      minLength={8}
                      placeholder="Repita a senha"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  {securityMessage && (
                    <p className={`text-sm ${securityMessage.includes('sucesso') ? 'text-green-700' : 'text-red-600'}`}>
                      {securityMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                  >
                    {passwordSaving ? 'Salvando...' : 'Alterar senha'}
                  </button>
                </form>
              )}
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-earth-900">Autenticação em duas etapas</h2>
              <p className="mt-2 text-sm text-earth-600">
                Use o Google Authenticator ou outro app compatível para adicionar uma camada extra de segurança.
              </p>
              {mfaError && (
                <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mfaError}</p>
              )}
              {mfaLoading && <p className="mt-3 text-sm text-earth-600">Carregando...</p>}
              {!mfaLoading && !mfaEnrollData && (
                <div className="mt-4">
                  {mfaFactors?.totp?.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                        Ativado
                      </span>
                      <button
                        type="button"
                        onClick={handleMfaUnenroll}
                        disabled={mfaLoading}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-70"
                      >
                        Desativar 2FA
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startMfaEnroll}
                      disabled={mfaEnrolling}
                      className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
                    >
                      {mfaEnrolling ? 'Preparando...' : 'Ativar Google Authenticator'}
                    </button>
                  )}
                </div>
              )}
              {mfaEnrollData && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-earth-700">Escaneie o QR code com seu app ou digite o código manualmente:</p>
                  <div className="flex flex-wrap gap-6">
                    {mfaEnrollData.totp?.qr_code && (
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(mfaEnrollData.totp.qr_code)}`}
                        alt="QR Code para app autenticador"
                        width={200}
                        height={200}
                        className="rounded-lg border border-earth-200"
                      />
                    )}
                    {mfaEnrollData.totp?.secret && (
                      <div>
                        <p className="text-xs font-medium text-earth-600">Ou digite manualmente:</p>
                        <code className="mt-1 block break-all rounded bg-earth-100 px-2 py-1 text-sm">
                          {mfaEnrollData.totp.secret}
                        </code>
                      </div>
                    )}
                  </div>
                  <form onSubmit={confirmMfaEnroll} className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-sm font-medium text-earth-700">Código de 6 dígitos</label>
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
                        {mfaEnrolling ? 'Verificando...' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelMfaEnroll}
                        disabled={mfaEnrolling}
                        className="rounded-lg border border-earth-300 px-4 py-2 text-earth-700 hover:bg-earth-50 disabled:opacity-70"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-earth-900">Sessão</h2>
              <p className="mt-2 text-sm text-earth-600">
                Encerrar sessão fará com que você precise fazer login novamente neste dispositivo.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  window.location.href = '/login'
                }}
                className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Encerrar sessão
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
