/**
 * Profile - User profile management.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getProfile, updateProfile } from '../../services/profileService'

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      try {
        const { data, error } = await getProfile(user.id)
        if (!isActive) return
        setProfile(data ?? null)
        setName(data?.name ?? '')
        if (error) setMessage(error.message || 'Erro ao carregar perfil')
      } catch (e) {
        if (isActive) setMessage(e?.message || 'Erro ao carregar perfil')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await updateProfile(user.id, { name })
    setSaving(false)
    setMessage(error ? error.message : 'Perfil atualizado')
  }

  return (
    <>
      <Helmet>
        <title>Perfil | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Perfil</h1>
        <p className="mt-2 text-earth-600">
          Gerencie suas informações
        </p>
        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}
        {!loading && (
          <form onSubmit={handleSave} className="mt-6 max-w-md space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-earth-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profile?.email ?? user?.email ?? ''}
                readOnly
                className="mt-1 block w-full rounded-lg border border-earth-200 bg-earth-100 px-3 py-2 text-earth-600"
              />
            </div>
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
              />
            </div>
            {message && (
              <p className="text-sm text-earth-600">{message}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
