/**
 * Minha Conta - Informações do usuário e endereços para envio.
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

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function Conta() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
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

  const loadData = async (active = () => true) => {
    if (!user?.id) {
      if (active()) setLoading(false)
      return
    }
    if (active()) setLoading(true)
    try {
      const [prof, addr] = await Promise.all([
        getProfile(user.id),
        getAddresses(user.id),
      ])
      if (!active()) return
      setProfile(prof.data ?? null)
      setAddresses(addr.data ?? [])
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
    if (!error) loadData()
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

  return (
    <>
      <Helmet>
        <title>Minha Conta | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Minha Conta</h1>
        <p className="mt-2 text-earth-600">Seus dados e endereços para envio</p>

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && (
          <div className="mt-6 space-y-8">
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
      </div>
    </>
  )
}
