import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ArrowLeft, Settings, Clock, CheckCircle } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import Alert from '../../components/common/Alert'
import { passwordReset } from '../../services/authService'

export default function ForgotPasswordPage() {
  const [loading, setLoading]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [sentEmail, setSentEmail]   = useState('')
  const [resending, setResending]   = useState(false)
  const [error, setError]           = useState(null)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm()

  const onSubmit = async ({ email }) => {
    setLoading(true)
    setError(null)
    try {
      await passwordReset(email)
      setSentEmail(email)
      setSent(true)
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await passwordReset(sentEmail)
    } catch {
      // silencieux côté client (le backend répond toujours 200)
    } finally {
      setResending(false)
    }
  }

  /* ── État après envoi ─────────────────────────────────────────────── */
  if (sent) {
    return (
      <AuthLayout>
        {/* Icône succès */}
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Consultez votre boîte mail
          </h1>
          <p className="text-gray-500 text-sm">
            Nous avons envoyé un lien de réinitialisation à :
          </p>
        </div>

        {/* Email envoyé */}
        <div className="border border-gray-200 rounded-lg px-4 py-3 text-center mb-5">
          <span className="font-medium text-gray-800 text-sm">{sentEmail}</span>
        </div>

        {/* Message spam */}
        <p className="text-center text-sm text-gray-500 mb-6">
          Vous n'avez rien reçu ?{' '}
          Vérifiez votre dossier de courriers indésirables ou demandez un{' '}
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-primary-600 hover:underline font-medium disabled:opacity-50"
          >
            {resending ? 'Envoi…' : 'nouvel envoi'}
          </button>
          .
        </p>

        {/* Bouton renvoyer */}
        <Button
          variant="secondary"
          onClick={handleResend}
          loading={resending}
          className="w-full mb-4"
          size="lg"
        >
          Renvoyer l'e-mail
        </Button>

        {/* Retour connexion */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </div>

        {/* Support */}
        <p className="mt-6 text-center text-sm text-gray-400">
          Besoin d'aide ?{' '}
          <a href="mailto:support@smartfactory.dz"
            className="text-primary-600 hover:underline font-medium">
            Contacter le support
          </a>
        </p>
      </AuthLayout>
    )
  }

  /* ── Formulaire initial ───────────────────────────────────────────── */
  return (
    <AuthLayout>
      {/* Retour */}
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la connexion
      </Link>

      {/* Icône engrenage */}
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 mb-6">
        <Settings className="h-7 w-7 text-primary-500" />
      </div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mot de passe oublié ?</h1>
        <p className="text-gray-500 text-sm">
          Pas d'inquiétude. Saisissez l'adresse e-mail associée à votre compte et
          nous vous enverrons un lien sécurisé.
        </p>
      </div>

      {error && <Alert type="error" message={error} dismissible className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label="Adresse e-mail"
          type="email"
          placeholder="s.laurent@smartfactory.fr"
          error={errors.email?.message}
          {...register('email', {
            required: "L'adresse e-mail est obligatoire.",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Adresse e-mail invalide.',
            },
          })}
        />

        <Button type="submit" loading={loading} className="w-full gap-2" size="lg">
          Envoyer le lien de réinitialisation
          {!loading && <span>→</span>}
        </Button>
      </form>

      {/* Info lien 30 min */}
      <div className="mt-5 flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <Clock className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-700">Lien valable 30 minutes</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Pour votre sécurité, le lien ne pourra être utilisé qu'une seule fois.
          </p>
        </div>
      </div>

      {/* Support */}
      <p className="mt-6 text-center text-sm text-gray-400">
        Besoin d'aide ?{' '}
        <a href="mailto:support@smartfactory.dz"
          className="text-primary-600 hover:underline font-medium">
          Contacter le support
        </a>
      </p>
    </AuthLayout>
  )
}
