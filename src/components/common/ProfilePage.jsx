import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  User, Mail, Shield, Phone, KeyRound,
  CheckCircle, Eye, EyeOff, Pencil, Camera,
} from 'lucide-react'
import Alert from './Alert'
import Button from './Button'
import { useAuthContext } from '../../context/AuthContext'
import { updateProfile, changePassword } from '../../services/profileService'

const ROLE_COLORS = {
  ADMIN:      'bg-purple-100 text-purple-700',
  TECHNICIEN: 'bg-blue-100   text-blue-700',
  OPERATEUR:  'bg-green-100  text-green-700',
}

/* ── Section informations personnelles ────────────────────────────── */
function PersonalInfoSection({ user, onUpdated }) {
  const [editing, setEditing]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error,   setError]         = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  useEffect(() => {
    if (user) {
      reset({ nom: user.nom, prenom: user.prenom, telephone: user.telephone ?? '' })
      setPhotoPreview(null)
    }
  }, [user, reset])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées (JPG, PNG, WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La photo ne doit pas dépasser 5 Mo.')
      return
    }
    setPhotoPreview(URL.createObjectURL(file))
    setValue('photo', file)
  }

  const onSubmit = async (data) => {
    setLoading(true); setError(null)
    try {
      const formData = new FormData()
      if (data.nom)       formData.append('nom', data.nom)
      if (data.prenom)    formData.append('prenom', data.prenom)
      if (data.telephone !== undefined) formData.append('telephone', data.telephone)
      if (data.photo instanceof File)   formData.append('photo', data.photo)

      const updated = await updateProfile(formData)
      onUpdated(updated)
      setSuccess(true)
      setEditing(false)
      setPhotoPreview(null)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      const msg = err.response?.data?.detail
        || Object.values(err.response?.data ?? {})?.[0]?.[0]
        || 'Erreur lors de la mise à jour.'
      setError(msg)
    } finally { setLoading(false) }
  }

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase()
  const avatarSrc = photoPreview || (user?.photo ? user.photo : null)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <User className="h-4 w-4 text-primary-500" /> Informations personnelles
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
      </div>

      {/* Avatar avec bouton upload */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Photo de profil"
              className="h-16 w-16 rounded-2xl object-cover border-2 border-gray-100" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-primary-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{initials}</span>
            </div>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center border-2 border-white shadow hover:bg-primary-700 transition-colors"
              title="Changer la photo"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{user?.prenom} {user?.nom}</p>
          <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user?.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {user?.role_label ?? user?.role}
          </span>
          {editing && photoPreview && (
            <p className="text-xs text-primary-600 mt-1">✓ Nouvelle photo sélectionnée</p>
          )}
        </div>
      </div>

      {success && <Alert type="success" message="Profil mis à jour avec succès." className="mb-4" />}
      {error   && <Alert type="error"   message={error} dismissible className="mb-4" />}

      {!editing ? (
        <div className="space-y-3">
          <InfoRow icon={User}   label="Prénom"    value={user?.prenom} />
          <InfoRow icon={User}   label="Nom"       value={user?.nom} />
          <InfoRow icon={Mail}   label="Email"     value={user?.email} />
          <InfoRow icon={Phone}  label="Téléphone" value={user?.telephone || '—'} />
          <InfoRow icon={Shield} label="Rôle"      value={user?.role_label ?? user?.role} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Prénom</label>
              <input className={`input-field text-sm ${errors.prenom ? 'input-error' : ''}`}
                {...register('prenom', { required: 'Obligatoire.' })} />
              {errors.prenom && <p className="mt-1 text-xs text-red-600">{errors.prenom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom</label>
              <input className={`input-field text-sm ${errors.nom ? 'input-error' : ''}`}
                {...register('nom', { required: 'Obligatoire.' })} />
              {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Téléphone <span className="text-gray-400">(optionnel)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className={`input-field pl-9 text-sm ${errors.telephone ? 'input-error' : ''}`}
                placeholder="+213 555 123 456"
                {...register('telephone')}
              />
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email (non modifiable)</p>
              <p className="text-sm font-medium text-gray-600">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => { setEditing(false); setError(null); setPhotoPreview(null) }} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" loading={loading} className="flex-1">Enregistrer</Button>
          </div>
        </form>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

/* ── Section changement de mot de passe ───────────────────────────── */
function ChangePasswordSection() {
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm()
  const newPass = watch('new_password')

  const onSubmit = async (data) => {
    setLoading(true)
    setError(null)
    try {
      await changePassword(data)
      setSuccess(true)
      reset()
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      const msg = err.response?.data?.current_password?.[0]
        || err.response?.data?.new_password?.[0]
        || err.response?.data?.detail
        || Object.values(err.response?.data ?? {})?.[0]?.[0]
        || 'Erreur lors du changement.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary-500" /> Changer le mot de passe
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        Saisissez votre mot de passe actuel puis choisissez-en un nouveau.
      </p>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">Mot de passe changé avec succès !</p>
        </div>
      )}
      {error && <Alert type="error" message={error} dismissible className="mb-4" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Mot de passe actuel */}
        <PasswordField
          label="Mot de passe actuel"
          show={showCurrent}
          onToggle={() => setShowCurrent(v => !v)}
          error={errors.current_password?.message}
          registration={register('current_password', { required: 'Obligatoire.' })}
        />

        {/* Nouveau mot de passe */}
        <PasswordField
          label="Nouveau mot de passe"
          show={showNew}
          onToggle={() => setShowNew(v => !v)}
          error={errors.new_password?.message}
          registration={register('new_password', {
            required: 'Obligatoire.',
            minLength: { value: 8, message: 'Minimum 8 caractères.' },
          })}
        />

        {/* Confirmation */}
        <PasswordField
          label="Confirmer le nouveau mot de passe"
          show={showConfirm}
          onToggle={() => setShowConfirm(v => !v)}
          error={errors.new_password_confirm?.message}
          registration={register('new_password_confirm', {
            required: 'Obligatoire.',
            validate: v => v === newPass || 'Les mots de passe ne correspondent pas.',
          })}
        />

        {/* Règles */}
        <ul className="text-xs text-gray-400 space-y-1 pl-1">
          <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-gray-300" /> Minimum 8 caractères</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-gray-300" /> Ne doit pas être un mot de passe courant</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-gray-300" /> Ne doit pas être uniquement numérique</li>
        </ul>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Changer le mot de passe
        </Button>
      </form>
    </div>
  )
}

function PasswordField({ label, show, onToggle, error, registration }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          className={`input-field pr-12 text-sm ${error ? 'input-error' : ''}`}
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/* ── Composant principal exporté ──────────────────────────────────── */
export default function ProfilePage() {
  const { user, refreshUser } = useAuthContext()

  const handleUpdated = async () => {
    // Re-hydrate le user dans le contexte global après mise à jour
    await refreshUser()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos informations personnelles et votre sécurité.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
        <PersonalInfoSection user={user} onUpdated={handleUpdated} />
        <ChangePasswordSection />
      </div>
    </div>
  )
}
