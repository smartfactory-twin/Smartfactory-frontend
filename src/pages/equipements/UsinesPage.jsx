import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Building2, ChevronRight, Search } from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import EmptyState from '../../components/common/EmptyState'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { getUsines, deleteUsine, createUsine, updateUsine } from '../../services/equipementService'

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(4)].map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
      ))}
    </tr>
  )
}

function UsineModal({ usine, onSave, onClose }) {
  const [nom, setNom]           = useState(usine?.nom ?? '')
  const [adresse, setAdresse]   = useState(usine?.adresse ?? '')
  const [desc, setDesc]         = useState(usine?.description ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nom.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true); setError(null)
    try {
      await onSave({ nom: nom.trim(), adresse: adresse.trim(), description: desc.trim() })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.nom?.[0] ?? 'Une erreur est survenue.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {usine ? 'Modifier l\'usine' : 'Ajouter une usine'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              className="input-field" placeholder="Ex: Usine Centrale Tunis" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
            <input value={adresse} onChange={e => setAdresse(e.target.value)}
              className="input-field" placeholder="Ex: Tunis, Tunisie" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              rows={3} className="input-field resize-none" placeholder="Description de l'usine…" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : usine ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDeleteDialog({ nom, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer l'usine</h3>
        <p className="text-sm text-gray-600 mb-1">
          Voulez-vous vraiment supprimer <span className="font-semibold">{nom}</span> ?
        </p>
        <p className="text-xs text-orange-600 mb-5">⚠ Toutes les zones et lignes associées seront supprimées.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsinesPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role

  const [usines, setUsines]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]       = useState(false)

  const fetch = useCallback(() => {
    setLoading(true); setError(null)
    const params = {}
    if (search) params.search = search
    getUsines(params)
      .then(d => setUsines(d.results ?? d))
      .catch(() => setError('Impossible de charger les usines.'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async (data) => {
    if (editTarget) await updateUsine(editTarget.id, data)
    else            await createUsine(data)
    fetch()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteUsine(deleteTarget.id); setDeleteTarget(null); fetch() }
    finally { setDeleting(false) }
  }

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout pageTitle="Équipements — Usines">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usines</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usines.length} usine{usines.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'ADMIN' && (
          <button onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Ajouter une usine
          </button>
        )}
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Rechercher une usine…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={fetch} className="text-sm text-primary-600 hover:underline">Réessayer</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usine</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Adresse</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zones</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <>{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</>
              ) : usines.length === 0 ? (
                <tr><td colSpan={4}>
                  <EmptyState icon={Building2} title="Aucune usine" description="Créez votre première usine." className="py-16" />
                </td></tr>
              ) : usines.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.nom}</p>
                        {u.description && <p className="text-xs text-gray-400 truncate max-w-48">{u.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.adresse || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {u.zones_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/equipements/zones?usine=${u.id}`)}
                        title="Voir les zones"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      {role === 'ADMIN' && <>
                        <button onClick={() => { setEditTarget(u); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <UsineModal usine={editTarget} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
      {deleteTarget && (
        <ConfirmDeleteDialog nom={deleteTarget.nom} onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)} loading={deleting} />
      )}
    </Layout>
  )
}
