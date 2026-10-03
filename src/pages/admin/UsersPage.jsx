import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  UserPlus, Download, Search, X, Loader2,
  Eye, Trash2, Mail, Shield, Phone, Calendar,
  AlertTriangle, CheckCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import { adminCreateUser, listUsers, deleteUser } from '../../services/authService'

const ROLE_LABELS = { ADMIN: 'Administrateur', TECHNICIEN: 'Technicien', OPERATEUR: 'Opérateur' }
const ROLE_COLORS = {
  ADMIN:      'bg-purple-100 text-purple-700',
  TECHNICIEN: 'bg-blue-100   text-blue-700',
  OPERATEUR:  'bg-gray-100   text-gray-700',
}

/* ── Modal Ajouter Utilisateur ─────────────────────────────────────── */
function AddUserModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { nom: '', prenom: '', email: '', role: 'OPERATEUR' },
  })

  const onSubmit = async (data) => {
    setLoading(true); setError(null)
    try {
      await adminCreateUser(data)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.detail || 'Erreur lors de la création.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Ajouter un utilisateur</h2>
            <p className="text-sm text-gray-500 mt-0.5">Un email avec ses identifiants lui sera envoyé.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {error && <Alert type="error" message={error} dismissible className="mb-4" />}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
              <input className={`input-field text-sm ${errors.prenom ? 'input-error' : ''}`} placeholder="Ali" {...register('prenom', { required: 'Obligatoire' })} />
              {errors.prenom && <p className="mt-1 text-xs text-red-600">{errors.prenom.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
              <input className={`input-field text-sm ${errors.nom ? 'input-error' : ''}`} placeholder="Benali" {...register('nom', { required: 'Obligatoire' })} />
              {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse e-mail</label>
            <input type="email" className={`input-field text-sm ${errors.email ? 'input-error' : ''}`} placeholder="ali.benali@smartfactory.dz"
              {...register('email', { required: 'Obligatoire.', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide.' } })} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rôle</label>
            <select className="input-field text-sm" {...register('role')}>
              <option value="OPERATEUR">Opérateur</option>
              <option value="TECHNICIEN">Technicien</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <span className="text-blue-500 text-sm mt-0.5">ℹ️</span>
            <p className="text-xs text-blue-700 leading-relaxed">Un mot de passe temporaire sécurisé sera généré et envoyé par email. L'utilisateur devra le changer à sa première connexion.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">Annuler</Button>
            <Button type="submit" loading={loading} className="flex-1">Créer et envoyer l'email</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal Détails Utilisateur ─────────────────────────────────────── */
function UserDetailModal({ user: u, onClose }) {
  if (!u) return null
  const initials = `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Détails utilisateur</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        {/* Avatar + nom */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-white">{initials}</span>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{u.prenom} {u.nom}</p>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
              {ROLE_LABELS[u.role] ?? u.role}
            </span>
          </div>
        </div>

        {/* Infos */}
        <div className="space-y-2.5">
          <InfoRow icon={Mail}     label="Email"     value={u.email} />
          <InfoRow icon={Shield}   label="Rôle"      value={ROLE_LABELS[u.role] ?? u.role} />
          <InfoRow icon={Phone}    label="Téléphone" value={u.telephone || '—'} />
          <InfoRow icon={Calendar} label="Inscrit le" value={u.date_joined ? new Date(u.date_joined).toLocaleDateString('fr-FR') : '—'} />
          <InfoRow icon={Calendar} label="Dernière connexion" value={u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais'} />
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {u.actif
              ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              : <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
            <div>
              <p className="text-[11px] text-gray-400">Statut du compte</p>
              <p className={`text-sm font-semibold ${u.actif ? 'text-green-700' : 'text-red-600'}`}>
                {u.actif ? 'Actif' : 'Inactif'}
              </p>
            </div>
          </div>
          {u.must_reset_password && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-700">Cet utilisateur n'a pas encore changé son mot de passe temporaire.</p>
            </div>
          )}
        </div>

        <Button variant="secondary" onClick={onClose} className="w-full mt-5">Fermer</Button>
      </div>
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

/* ── Modal Confirmation Suppression ───────────────────────────────── */
function DeleteConfirmModal({ user: u, onClose, onConfirm, loading }) {
  if (!u) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 z-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Supprimer l'utilisateur</h2>
        <p className="text-sm text-gray-500 mb-1">Voulez-vous vraiment supprimer</p>
        <p className="text-sm font-semibold text-gray-800 mb-1">{u.prenom} {u.nom}</p>
        <p className="text-sm text-gray-400 mb-6">{u.email}</p>
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">
          Cette action est irréversible. Toutes les données liées à cet utilisateur seront supprimées.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Annuler</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">Supprimer</Button>
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ───────────────────────────────────────────────── */
export default function UsersPage() {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showAddModal, setShowAdd]  = useState(false)
  const [detailUser, setDetailUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [success, setSuccess]       = useState(null)
  const [error, setError]           = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await listUsers({ search, ordering: '-date_joined' })
      setUsers(data.results ?? data)
    } catch {
      setError('Erreur lors du chargement des utilisateurs.')
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  const handleAddSuccess = () => {
    setShowAdd(false)
    setSuccess('Utilisateur créé avec succès. Un email avec ses identifiants lui a été envoyé.')
    fetchUsers()
    setTimeout(() => setSuccess(null), 6000)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      setSuccess(`L'utilisateur ${deleteTarget.prenom} ${deleteTarget.nom} a été supprimé.`)
      fetchUsers()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression.')
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  const handleExport = () => {
    if (!users.length) return
    const csv = ['Prénom,Nom,Email,Rôle,Actif,Téléphone',
      ...users.map(u => `${u.prenom},${u.nom},${u.email},${u.role},${u.actif ? 'Oui' : 'Non'},${u.telephone ?? ''}`)
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `utilisateurs_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout>
      {showAddModal    && <AddUserModal      onClose={() => setShowAdd(false)} onSuccess={handleAddSuccess} />}
      {detailUser      && <UserDetailModal   user={detailUser} onClose={() => setDetailUser(null)} />}
      {deleteTarget    && <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} loading={deleting} />}

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les comptes et les accès de votre équipe.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={!users.length}>
            <Download className="h-4 w-4 mr-1.5" /> Exporter
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Ajouter
          </Button>
        </div>
      </div>

      {success && <Alert type="success" message={success} dismissible className="mb-4" />}
      {error   && <Alert type="error"   message={error}   dismissible className="mb-4" />}

      {/* Recherche */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="search" placeholder="Rechercher un utilisateur…" value={search}
          onChange={e => setSearch(e.target.value)} className="input-field pl-9 text-sm" />
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Utilisateur</th>
              <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Rôle</th>
              <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Statut</th>
              <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Chargement…
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">
                <p className="font-medium">Aucun utilisateur trouvé</p>
                <p className="text-xs mt-1">Créez le premier utilisateur avec le bouton "Ajouter".</p>
              </td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary-700">{u.prenom?.[0]}{u.nom?.[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{u.prenom} {u.nom}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.actif ? 'text-green-700' : 'text-red-600'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.actif ? 'bg-green-500' : 'bg-red-500'}`} />
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      {/* Voir détails */}
                      <button
                        onClick={() => setDetailUser(u)}
                        title="Voir les détails"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {/* Supprimer */}
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
