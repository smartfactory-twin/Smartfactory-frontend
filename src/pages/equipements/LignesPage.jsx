import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, GitBranch, ChevronRight, Search } from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import EmptyState from '../../components/common/EmptyState'
import Alert from '../../components/common/Alert'
import {
  getLignes, createLigne, updateLigne, deleteLigne,
  getUsines, getZones,
} from '../../services/equipementService'

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
      ))}
    </tr>
  )
}

function LigneModal({ ligne, onSave, onClose }) {
  const [nom, setNom]             = useState(ligne?.nom ?? '')
  const [usineId, setUsineId]     = useState('')
  const [zoneId, setZoneId]       = useState(ligne?.zone ?? '')
  const [desc, setDesc]           = useState(ligne?.description ?? '')
  const [usines, setUsines]       = useState([])
  const [zones, setZones]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    getUsines({ page_size: 200 }).then(d => setUsines(d.results ?? d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!usineId) { setZones([]); return }
    getZones({ usine: usineId, page_size: 200 }).then(d => setZones(d.results ?? d)).catch(() => {})
  }, [usineId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nom.trim()) { setError('Le nom est obligatoire.'); return }
    if (!zoneId)     { setError('La zone est obligatoire.'); return }
    setSaving(true); setError(null)
    try {
      await onSave({ nom: nom.trim(), zone: zoneId, description: desc.trim() })
      onClose()
    } catch (err) {
      const d = err?.response?.data
      setError(d?.nom?.[0] ?? d?.zone?.[0] ?? 'Une erreur est survenue.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {ligne ? 'Modifier la ligne' : 'Ajouter une ligne de production'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              className="input-field" placeholder="Ex: Ligne Production 01" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Usine</label>
            <select value={usineId} onChange={e => { setUsineId(e.target.value); setZoneId('') }} className="input-field">
              <option value="">— Sélectionner une usine —</option>
              {usines.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zone / Atelier *</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              disabled={!usineId} className="input-field disabled:opacity-50">
              <option value="">— Sélectionner une zone —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              rows={3} className="input-field resize-none" placeholder="Description de la ligne…" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : ligne ? 'Mettre à jour' : 'Créer'}
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
        <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer la ligne</h3>
        <p className="text-sm text-gray-600 mb-1">
          Voulez-vous vraiment supprimer <span className="font-semibold">{nom}</span> ?
        </p>
        <p className="text-xs text-orange-600 mb-5">⚠ Les machines assignées perdront leur ligne de production.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LignesPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const role = user?.role

  const [lignes, setLignes]           = useState([])
  const [usines, setUsines]           = useState([])
  const [zones, setZones]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [filterUsine, setFilterUsine] = useState('')
  const [filterZone, setFilterZone]   = useState(searchParams.get('zone') ?? '')
  const [showModal, setShowModal]     = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => {
    getUsines({ page_size: 200 }).then(d => setUsines(d.results ?? d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!filterUsine) { setZones([]); setFilterZone(''); return }
    getZones({ usine: filterUsine, page_size: 200 }).then(d => setZones(d.results ?? d)).catch(() => {})
  }, [filterUsine])

  const fetch = useCallback(() => {
    setLoading(true); setError(null)
    const params = {}
    if (search)      params.search        = search
    if (filterZone)  params.zone          = filterZone
    if (filterUsine && !filterZone) params['zone__usine'] = filterUsine
    getLignes(params)
      .then(d => setLignes(d.results ?? d))
      .catch(() => setError('Impossible de charger les lignes.'))
      .finally(() => setLoading(false))
  }, [search, filterZone, filterUsine])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async (data) => {
    if (editTarget) await updateLigne(editTarget.id, data)
    else            await createLigne(data)
    fetch()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteLigne(deleteTarget.id); setDeleteTarget(null); fetch() }
    finally { setDeleting(false) }
  }

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout pageTitle="Équipements — Lignes de production">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lignes de production</h1>
          <p className="text-sm text-gray-500 mt-0.5">{lignes.length} ligne{lignes.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'ADMIN' && (
          <button onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Ajouter une ligne
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Rechercher une ligne…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filterUsine} onChange={e => { setFilterUsine(e.target.value); setFilterZone('') }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Toutes les usines</option>
          {usines.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
          disabled={!filterUsine}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50">
          <option value="">Toutes les zones</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
        </select>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ligne</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usine</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Machines</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <>{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</>
              ) : lignes.length === 0 ? (
                <tr><td colSpan={5}>
                  <EmptyState icon={GitBranch} title="Aucune ligne" description="Créez votre première ligne de production." className="py-16" />
                </td></tr>
              ) : lignes.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <GitBranch className="h-4 w-4 text-green-600" />
                      </div>
                      <p className="font-medium text-gray-900">{l.nom}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.zone_nom ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{l.usine_nom ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      {l.machines_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/machines?ligne=${l.id}`)}
                        title="Voir les machines"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      {role === 'ADMIN' && <>
                        <button onClick={() => { setEditTarget(l); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(l)}
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

      {showModal && <LigneModal ligne={editTarget} onSave={handleSave} onClose={() => setShowModal(false)} />}
      {deleteTarget && (
        <ConfirmDeleteDialog nom={deleteTarget.nom} onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)} loading={deleting} />
      )}
    </Layout>
  )
}
