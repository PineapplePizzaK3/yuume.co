import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { updateProfile, getOrCreateProfile } from '../../services/profileService'
import { validatePassword, PASSWORD_PLACEHOLDER } from '../../lib/passwordValidation'

export default function CompleteSocialProfile() {
  const { user, refreshProfile, needsSocialOnboarding } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null
  if (!needsSocialOnboarding) {
    navigate('/app/dashboard', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const fullName = name.trim()
    if (!fullName) {
      setError('Informe seu nome completo.')
      return
    }
    const { valid, message } = validatePassword(password)
    if (!valid) {
      setError(message)
      return
    }
    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.')
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
        },
      })
      if (authErr) {
        setError(authErr.message || 'Erro ao definir senha.')
        setLoading(false)
        return
      }

      const { data: existing } = await getOrCreateProfile(user.id, { email: user.email, name: fullName })
      if (existing) {
        const { error: profileErr } = await updateProfile(user.id, { name: fullName })
        if (profileErr) {
          setError(profileErr.message || 'Erro ao salvar nome no perfil.')
          setLoading(false)
          return
        }
      }

      await refreshProfile()
      navigate('/app/dashboard', { replace: true })
    } catch (e2) {
      setError(e2?.message || 'Erro ao concluir cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Complete seu cadastro | Plataforma</title>
      </Helmet>
      <section className="mx-auto mt-8 max-w-md rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-earth-900">Complete seu cadastro</h1>
        <p className="mt-2 text-sm text-earth-600">
          Para continuar, informe seu nome completo e crie uma senha para a conta.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-earth-700">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder="Seu nome completo"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder={PASSWORD_PLACEHOLDER}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-700">Confirmar senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              placeholder="Repita a senha"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-70"
          >
            {loading ? 'Salvando...' : 'Concluir cadastro'}
          </button>
        </form>
      </section>
    </>
  )
}
