import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import Alert from '../../components/common/Alert'
import ForceResetModal from '../../components/common/ForceResetModal'
import { useAuthContext } from '../../context/AuthContext'

const ROLE_REDIRECTS = {
  ADMIN:      '/admin/dashboard',
  TECHNICIEN: '/technician/dashboard',
  OPERATEUR:  '/operator/dashboard',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthContext()

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [forceReset, setForceReset]     = useState(null) // { uid, token }

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '', remember: false },
  })

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    setError(null)
    try {
      const result = await login(email, password)

      if (result.mustReset) {
        // Affiche le popup forcé au lieu de rediriger
        setForceReset({ uid: result.uid, token: result.token })
        return
      }

      const redirect = ROLE_REDIRECTS[result.role] || '/dashboard'
      navigate(redirect, { replace: true })
    } catch (err) {
      const status = err.response?.status
      const serverMsg = err.response?.data?.error || err.response?.data?.detail
      if (serverMsg) setError(serverMsg)
      else if (status === 401) setError('Identifiants invalides. Vérifiez votre email et mot de passe.')
      else if (status === 403) setError('Votre compte est inactif. Contactez un administrateur.')
      else if (status === 429) setError('Trop de tentatives. Réessayez dans quelques minutes.')
      else setError('Erreur de connexion. Vérifiez votre connexion réseau.')
    } finally {

      setLoading(false)
    }
  }

  const handleResetSuccess = () => {
    setForceReset(null)
    setError(null)
    navigate('/login', { replace: true })
    // Petit message pour guider l'utilisateur
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  return (
    <>
      {/* Popup forcé reset mot de passe (non-fermable) */}
      {forceReset && (
        <ForceResetModal
          uid={forceReset.uid}
          token={forceReset.token}
          onSuccess={handleResetSuccess}
        />
      )}

      <AuthLayout>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bienvenue</h1>
        <p className="text-gray-500">Connectez-vous à votre espace de supervision.</p>
      </div>

      {error && <Alert type="error" message={error} dismissible className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Email */}
        <Input
          label="Adresse e-mail"
          type="email"
          placeholder="s.laurent@smartfactory.fr"
          error={errors.email?.message}
          {...register('email', {
            required: 'L\'adresse e-mail est obligatoire.',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Adresse e-mail invalide.',
            },
          })}
        />

        {/* Mot de passe */}
        <Input
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.password?.message}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          {...register('password', {
            required: 'Le mot de passe est obligatoire.',
            minLength: { value: 6, message: 'Au moins 6 caractères.' },
          })}
        />

        {/* Remember me + forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('remember')}
            />
            <span className="text-sm text-gray-600">Se souvenir de moi</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        {/* Bouton connexion */}
        <Button
          type="submit"
          loading={loading}
          className="w-full gap-2"
          size="lg"
        >
          Se connecter
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      {/* Support */}
      <p className="mt-6 text-center text-sm text-gray-400">
        Besoin d'aide ?{' '}
        <a
          href="mailto:support@smartfactory.dz"
          className="text-primary-600 hover:underline font-medium"
        >
          Contacter le support
        </a>
      </p>
    </AuthLayout>
    </>
  )
}
