import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Download, Search, Pencil, Trash2, Eye, Wrench } from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { MachineStatusBadge } from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import Spinner from '../../components/common/Spinner'
import CsvImportModal from '../../components/machines/CsvImportModal'
import { getMachines, deleteMachine, getZones } from '../../services/machineService'

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function ConfirmDeleteDialog({ machine, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer la machine</h3>
        <p className="text-sm text-gray-600 mb-5">
          Voulez-vous vraiment supprimer <span className="font-semibold text-gray-900">{machine.nom}</span> ?
          Cette action est irréversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MachinesListPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role

  const [machines, setMachines]     = useState([])
  const [zones, setZones]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [searchDebounced, setDebounced] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [page, setPage]             = useState(1)
  const [count, setCount]           = useState(0)
  const [showCsv, setShowCsv]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(count / PAGE_SIZE) || 1
  const debounceRef = useRef(null)

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  // Charger zones pour le filtre
  useEffect(() => {
    getZones({ page_size: 100 }).then(d => setZones(d.results ?? d)).catch(() => {})
  }, [])

  const fetchMachines = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = { page }
    if (searchDebounced) params.search = searchDebounced
    if (filterStatut)    params.statut = filterStatut
    if (filterZone)      params['ligne_production__zone'] = filterZone
    getMachines(params)
      .then(data => { setMachines(data.results ?? data); setCount(data.count ?? 0) })
      .catch(() => setError('Impossible de charger les machines.'))
      .finally(() => setLoading(false))
  }, [page, searchDebounced, filterStatut, filterZone])

  useEffect(() => { fetchMachines() }, [fetchMachines])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteMachine(deleteTarget.id)
      setDeleteTarget(null)
      fetchMachines()
    } catch {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    if (!machines.length) return
    const headers = ['Nom', 'Identifiant', 'N° Série', 'Marque', 'Modèle', 'Statut', 'Zone', 'Ligne', 'Date installation']
    const rows = machines.map(m => [
      m.nom,
      m.identifiant_interne,
      m.numero_serie || '',
      m.marque || '',
      m.modele || '',
      m.statut,
      m.zone_nom || '',
      m.ligne_production_nom || '',
      m.date_installation || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `machines_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout pageTitle="Machines">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des machines</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count} machine{count !== 1 ? 's' : ''} au total</p>
        </div>
        {role === 'ADMIN' && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={machines.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              title="Exporter la liste en CSV"
            >
              <Download className="h-4 w-4" /> Exporter
            </button>
            <button
              onClick={() => setShowCsv(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Importer CSV
            </button>
            <button
              onClick={() => navigate('/machines/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, identifiant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterStatut}
          onChange={e => { setFilterStatut(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tous les statuts</option>
          <option value="NORMAL">Normal</option>
          <option value="DEGRADE">Dégradé</option>
          <option value="CRITIQUE">Critique</option>
          <option value="HORS_LIGNE">Hors ligne</option>
        </select>
        <select
          value={filterZone}
          onChange={e => { setFilterZone(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Toutes les zones</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
        </select>
        {(filterStatut || filterZone || search) && (
          <button
            onClick={() => { setSearch(''); setFilterStatut(''); setFilterZone(''); setPage(1) }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={fetchMachines} className="text-sm text-primary-600 hover:underline">Réessayer</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Machine</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Série</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone / Ligne</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Installation</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <>{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</>
                ) : machines.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Wrench} title="Aucune machine" description="Aucune machine ne correspond à votre recherche." className="py-16" />
                    </td>
                  </tr>
                ) : machines.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.nom}</p>
                      <p className="text-xs text-gray-400">{m.identifiant_interne}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.numero_serie || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{m.zone_nom ?? '—'}</p>
                      <p className="text-xs text-gray-400">{m.ligne_production_nom ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3"><MachineStatusBadge status={m.statut} /></td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(m.date_installation)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/machines/${m.id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(role === 'ADMIN' || role === 'TECHNICIEN') && (
                          <button
                            onClick={() => navigate(`/machines/${m.id}/edit`)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {role === 'ADMIN' && (
                          <button
                            onClick={() => setDeleteTarget(m)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && machines.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} de {totalPages} · {count} résultat{count !== 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCsv && <CsvImportModal onClose={() => { setShowCsv(false); fetchMachines() }} />}
      {deleteTarget && (
        <ConfirmDeleteDialog
          machine={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Layout>
  )
}
