import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import Alert from '../../components/common/Alert'
import { passwordResetConfirm } from '../../services/authService'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [searchParams] = useSearchParams()

  // uid + token depuis router state (premier login) ou query params (email link)
  const uid   = state?.uid   || searchParams.get('uid')
  const token = state?.token || searchParams.get('token')

  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const newPassword = watch('new_password')

  if (!uid || !token) {
    return (
      <AuthLayout>
        <Alert type="error" message="Lien de réinitialisation invalide ou manquant. Refaites la demande depuis la page de connexion." />
      </AuthLayout>
    )
  }

  const onSubmit = async ({ new_password, new_password_confirm }) => {
    setLoading(true)
    setError(null)
    try {
      await passwordResetConfirm(uid, token, new_password, new_password_confirm)
      navigate('/reset-success', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.error || err.response?.data?.detail
      setError(detail || 'Lien invalide ou expiré. Refaites la demande.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-2 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 mb-4">
          <ShieldCheck className="h-6 w-6 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Nouveau mot de passe</h1>
        <p className="text-gray-500">Choisissez un mot de passe fort d'au moins 8 caractères.</p>
      </div>

      {error && <Alert type="error" message={error} dismissible className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label="Nouveau mot de passe"
          type={showNew ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.new_password?.message}
          rightIcon={
            <button type="button" onClick={() => setShowNew((v) => !v)}
              className="text-gray-400 hover:text-gray-600" aria-label="Afficher">
              {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          {...register('new_password', {
            required: 'Le mot de passe est obligatoire.',
            minLength: { value: 8, message: 'Minimum 8 caractères.' },
          })}
        />

        <Input
          label="Confirmer le mot de passe"
          type={showConfirm ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.new_password_confirm?.message}
          rightIcon={
            <button type="button" onClick={() => setShowConfirm((v) => !v)}
              className="text-gray-400 hover:text-gray-600" aria-label="Afficher">
              {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          {...register('new_password_confirm', {
            required: 'La confirmation est obligatoire.',
            validate: (v) => v === newPassword || 'Les mots de passe ne correspondent pas.',
          })}
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Réinitialiser le mot de passe
        </Button>
      </form>
    </AuthLayout>
  )
}
