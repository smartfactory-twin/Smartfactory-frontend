import { useCallback, useEffect, useRef, useState } from 'react'
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

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18Z" />
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.2c1.6-4.7 6-8.1 11.2-8.1Z" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuthContext()
  const googleButtonRef = useRef(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [forceReset, setForceReset]     = useState(null) // { uid, token }
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) return
    setGoogleLoading(true)
    setError(null)
    try {
      const result = await loginWithGoogle(response.credential)
      navigate(ROLE_REDIRECTS[result.role] || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Connexion Google impossible. Réessayez ou utilisez votre e-mail.')
    } finally {
      setGoogleLoading(false)
    }
  }, [loginWithGoogle, navigate])

  useEffect(() => {
    if (!googleClientId) return undefined
    let cancelled = false
    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.max(240, Math.min(googleButtonRef.current.clientWidth || 360, 400)),
        locale: 'fr',
      })
    }

    let script = document.querySelector('script[data-google-identity]')
    if (window.google?.accounts?.id) {
      renderGoogleButton()
    } else {
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.dataset.googleIdentity = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', renderGoogleButton)
    }

    return () => {
      cancelled = true
      script?.removeEventListener('load', renderGoogleButton)
    }
  }, [googleClientId, handleGoogleCredential])

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
        setForceReset({ uid: result.uid, token: result.token, email, mustUpdateProfile: result.mustUpdateProfile })
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
          initialEmail={forceReset.email}
          showProfileFields={forceReset.mustUpdateProfile}
          onSuccess={handleResetSuccess}
        />
      )}

      <AuthLayout variant="login">
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
          placeholder="Saisissez votre adresse e-mail"
          autoComplete="email"
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

      <div className="mt-6">
          <div className="relative mb-5 flex items-center justify-center">
            <span className="absolute inset-x-0 border-t border-gray-200" />
            <span className="relative bg-white px-3 text-xs text-gray-400">ou continuer avec</span>
          </div>
          {googleClientId ? (
            <div ref={googleButtonRef} className={`flex min-h-10 justify-center ${googleLoading ? 'pointer-events-none opacity-60' : ''}`} aria-label="Connexion avec Google" />
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-label="Connexion avec Google — configuration requise"
                className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-500 opacity-80"
                title="Configurez VITE_GOOGLE_CLIENT_ID et GOOGLE_OAUTH_CLIENT_ID pour activer Google."
              >
                <GoogleMark />
                Continuer avec Google
              </button>
              <p className="mt-2 text-center text-xs text-gray-400">
                Connexion Google à configurer par l’administrateur.
              </p>
            </>
          )}
      </div>

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
