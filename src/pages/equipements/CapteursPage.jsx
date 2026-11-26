import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Upload, FileUp, Download, Trash2, Edit, Eye, Activity } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { getCapteurs, deleteCapteur } from '../../services/sensorService'
import { getMachines } from '../../services/machineService'
import SensorAiEligibilityBadge from '../../components/equipements/SensorAiEligibilityBadge'
import { formatNullableThreshold } from '../../utils/sensorDisplay'

export default function CapteursPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role

  const [capteurs, setCapteurs] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAiEligible, setFilterAiEligible] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [capteursRes, machinesRes] = await Promise.all([
        getCapteurs({ page_size: 100 }),
        getMachines({ page_size: 100 })
      ])
      setCapteurs(capteursRes.results || capteursRes)
      setMachines(machinesRes.results || machinesRes)
    } catch (err) {
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce capteur ?')) return
    try {
      await deleteCapteur(id)
      fetchData()
    } catch (err) {
      alert('Erreur lors de la suppression.')
    }
  }

  const filtered = capteurs.filter(c => {
    const matchesSearch = (c.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.identifiant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.machine_nom?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesMachine = !filterMachine || c.machine === parseInt(filterMachine)
    const matchesType = !filterType || c.type_capteur === filterType
    const matchesStatus = !filterStatus || String(c.actif) === filterStatus
    const matchesAi = !filterAiEligible || String(Boolean(c.is_ai_eligible)) === filterAiEligible
    return matchesSearch && matchesMachine && matchesType && matchesStatus && matchesAi
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleCapteurs = filtered.slice((page - 1) * pageSize, page * pageSize)

  const sensorTypes = [
    { value: 'TEMPERATURE', label: 'Température' },
    { value: 'VIBRATION', label: 'Vibration' },
    { value: 'PRESSION', label: 'Pression' },
    { value: 'COURANT', label: 'Courant' },
    { value: 'VITESSE_RPM', label: 'Vitesse (RPM)' },
    { value: 'DEBIT', label: 'Débit' },
    { value: 'NIVEAU_SONORE', label: 'Niveau sonore' },
  ]

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary-600" />
              Gestion des Capteurs
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérer les capteurs associés aux machines et leurs données IoT
            </p>
          </div>
          {(role === 'ADMIN' || role === 'TECHNICIEN') && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/capteurs/nouveau')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un capteur
              </button>
              <button
                onClick={() => navigate('/capteurs/import-sensors')}
                className="btn-secondary flex items-center gap-2"
              >
                <FileUp className="h-4 w-4" />
                Importer des capteurs
              </button>
              <button
                onClick={() => navigate('/capteurs/import-readings')}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Importer des mesures
              </button>
            </div>
          )}
        </div>

        {error && <Alert type="error" message={error} />}

        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, identifiant ou machine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                className="input-field"
              >
                <option value="">Toutes les machines</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nom} ({m.identifiant_interne})
                  </option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field"
              >
                <option value="">Tous les types</option>
                {sensorTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field"
              >
                <option value="">Tous les statuts</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
              <select aria-label="Filtrer par éligibilité IA" value={filterAiEligible} onChange={(e) => setFilterAiEligible(e.target.value)} className="input-field">
                <option value="">Tous les capteurs IA</option><option value="true">Éligibles IA</option><option value="false">Non éligibles IA</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="sf-sensor-table min-w-[1100px] w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capteur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fréquence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seuils</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profil IA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleCapteurs.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="break-words text-sm font-medium leading-5 text-gray-900">{c.nom}</div>
                          <div className="break-all text-xs text-gray-500 font-mono leading-4">{c.identifiant}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex max-w-full items-center justify-center whitespace-normal break-words rounded-full bg-blue-100 px-2.5 py-1 text-center text-xs font-medium leading-4 text-blue-800">
                          {sensorTypes.find(t => t.value === c.type_capteur)?.label || c.type_capteur}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="break-words text-sm leading-5 text-gray-900">{c.machine_nom || '—'}</div>
                        <div className="mt-1 break-all text-xs leading-4 text-gray-500 font-mono">{c.machine_identifiant || ''}</div>
                      </td>
                      <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-gray-900">{c.unite}</td>
                      <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-gray-900">{c.frequence_mesure}s</td>
                      <td className="px-4 py-4 align-top whitespace-normal break-words text-sm text-gray-900">
                        {formatNullableThreshold(c.seuil_min)} / {formatNullableThreshold(c.seuil_max)} {c.unite}
                      </td>
                      <td className="px-3 py-4 align-top text-sm"><div className="flex max-w-full flex-wrap items-center gap-1"><span className="rounded-full bg-blue-50 text-blue-700 px-2 py-1 text-[11px] leading-none">{c.sensor_role || 'other'}</span><span className="rounded-full bg-amber-50 text-amber-800 px-2 py-1 text-[11px] leading-none">{c.criticality || 'medium'}</span><SensorAiEligibilityBadge sensor={c} /></div></td>
                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`/capteurs/${c.id}`)}
                          className="sf-action-icon sf-action-view"
                          title="Voir détails"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(role === 'ADMIN' || role === 'TECHNICIEN') && (
                          <>
                            <button
                              onClick={() => navigate(`/capteurs/${c.id}/modifier`)}
                              className="sf-action-icon sf-action-edit"
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="sf-action-icon sf-action-delete"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Aucun capteur trouvé.</p>
                </div>
              )}
            </div>
            {filtered.length > 0 && <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500"><span>Page {page} / {totalPages} · {filtered.length} capteur{filtered.length > 1 ? 's' : ''}</span><div className="flex gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40">Précédent</button><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40">Suivant</button></div></div>}
          </div>
        )}
      </div>
    </Layout>
  )
}
