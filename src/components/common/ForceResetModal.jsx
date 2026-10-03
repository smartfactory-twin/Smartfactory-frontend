import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, LockKeyhole, AlertTriangle } from 'lucide-react'
import Button from './Button'
import Alert from './Alert'
import { passwordResetConfirm } from '../../services/authService'
import { useNavigate } from 'react-router-dom'

/**
 * Popup non-fermable qui force l'utilisateur à changer son mot de passe
 * lors du premier login (must_reset_password = true).
 * Props: uid, token, onSuccess (callback appelé après reset réussi)
 */
export default function ForceResetModal({ uid, token, onSuccess }) {
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const newPassword = watch('new_password')

  const onSubmit = async ({ new_password, new_password_confirm }) => {
    setLoading(true)
    setError(null)
    try {
      await passwordResetConfirm(uid, token, new_password, new_password_confirm)
      onSuccess()
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.new_password?.[0]
        || 'Lien invalide ou expiré. Reconnectez-vous.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop non-cliquable */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 z-10">
        {/* Icône + Titre */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-4">
            <LockKeyhole className="h-7 w-7 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Changez votre mot de passe</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xs">
            Pour des raisons de sécurité, vous devez définir un nouveau mot de passe
            avant d'accéder à l'application.
          </p>
        </div>

        {/* Badge non-ignorable */}
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Cette étape est obligatoire et ne peut pas être ignorée.
          </p>
        </div>

        {error && <Alert type="error" message={error} className="mb-4" />}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`input-field pr-10 text-sm ${errors.new_password ? 'input-error' : ''}`}
                {...register('new_password', {
                  required: 'Obligatoire.',
                  minLength: { value: 8, message: 'Minimum 8 caractères.' },
                })}
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.new_password && (
              <p className="mt-1 text-xs text-red-600">{errors.new_password.message}</p>
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`input-field pr-10 text-sm ${errors.new_password_confirm ? 'input-error' : ''}`}
                {...register('new_password_confirm', {
                  required: 'Obligatoire.',
                  validate: v => v === newPassword || 'Les mots de passe ne correspondent pas.',
                })}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.new_password_confirm && (
              <p className="mt-1 text-xs text-red-600">{errors.new_password_confirm.message}</p>
            )}
          </div>

          <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
            Confirmer le nouveau mot de passe
          </Button>
        </form>
      </div>
    </div>
  )
}
