import { useState, useEffect, useCallback } from 'react'
import { ScanLine, Search, RefreshCw, Info } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import ImageLightbox from '../../components/common/ImageLightbox'
import MachineSelector from '../../components/inspections/MachineSelector'
import ImageUploadDropzone from '../../components/inspections/ImageUploadDropzone'
import InspectionResultCard from '../../components/inspections/InspectionResultCard'
import InspectionHistoryTable from '../../components/inspections/InspectionHistoryTable'
import InspectionDetailModal from '../../components/inspections/InspectionDetailModal'
import { useAuthContext } from '../../context/AuthContext'
import {
  getInspections, createInspection, analyzeInspection, deleteInspection,
} from '../../services/inspectionService'
import { getMachines } from '../../services/machineService'

const PAGE_SIZE = 10

function extractErrorMessage(err) {
  const data = err?.response?.data
  if (!data) return "Erreur lors de l'analyse de l'image."
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  for (const key of ['image', 'machine', 'observations', 'non_field_errors']) {
    const value = data[key]
    if (Array.isArray(value) && value.length) return value[0]
    if (typeof value === 'string') return value
  }
  const first = Object.values(data)[0]
  if (Array.isArray(first) && first.length) return first[0]
  if (typeof first === 'string') return first
  return "Erreur lors de l'analyse de l'image."
}

export default function InspectionsPage() {
  const { user } = useAuthContext()
  const role = user?.role
  const canCreate = role === 'ADMIN' || role === 'TECHNICIEN'
  const canDelete = role === 'ADMIN'

  const [machines, setMachines] = useState([])
  const [machinesError, setMachinesError] = useState(null)

  const [selectedMachine, setSelectedMachine] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [currentInspection, setCurrentInspection] = useState(null)

  const [inspections, setInspections] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [filterStatut, setFilterStatut] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [detailInspection, setDetailInspection] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)

  // ── Chargement des machines ───────────────────────────────────────────────
  useEffect(() => {
    let active = true
    getMachines({ page_size: 200 })
      .then((data) => { if (active) setMachines(data.results ?? data ?? []) })
      .catch(() => { if (active) setMachinesError('Impossible de charger la liste des machines.') })
    return () => { active = false }
  }, [])

  // ── Chargement de l'historique (paginé + filtres) ─────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (filterStatut) params.statut_analyse = filterStatut
      if (filterMachine) params.machine = filterMachine
      if (searchTerm.trim()) params.search = searchTerm.trim()
      const data = await getInspections(params)
      setInspections(data.results ?? data ?? [])
      setTotalCount(data.count ?? (Array.isArray(data) ? data.length : 0))
    } catch {
      setHistoryError("Impossible de charger l'historique des inspections.")
    } finally {
      setHistoryLoading(false)
    }
  }, [page, filterStatut, filterMachine, searchTerm])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Gestion de l'image ────────────────────────────────────────────────────
  const handleFile = (selected) => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setAnalyzeError(null)
    setCurrentInspection(null)
  }

  const handleClearFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  // ── Lancement de l'inspection + analyse IA ────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzeError(null)
    if (!selectedMachine) {
      setAnalyzeError('Veuillez sélectionner une machine.')
      return
    }
    if (!file) {
      setAnalyzeError('Veuillez importer une image.')
      return
    }

    setAnalyzing(true)
    setCurrentInspection(null)
    try {
      const formData = new FormData()
      formData.append('machine', selectedMachine)
      formData.append('image', file)
      const created = await createInspection(formData)
      const analyzed = await analyzeInspection(created.id)
      setCurrentInspection(analyzed)
      handleClearFile()
      if (page !== 1) setPage(1)
      else fetchHistory()
    } catch (err) {
      setAnalyzeError(extractErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (inspection) => {
    if (!window.confirm(`Supprimer l'inspection #${inspection.id} ?`)) return
    try {
      await deleteInspection(inspection.id)
      if (detailInspection?.id === inspection.id) setDetailInspection(null)
      fetchHistory()
    } catch {
      setHistoryError("Erreur lors de la suppression de l'inspection.")
    }
  }

  const Layout = role === 'ADMIN' ? AdminLayout
    : role === 'TECHNICIEN' ? TechnicianLayout
    : OperatorLayout

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <Layout pageTitle="Inspection visuelle par IA">
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary-600" />
            Inspection visuelle par IA
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sélectionnez une machine, importez une image et lancez l'analyse par intelligence artificielle.
          </p>
        </div>

        {machinesError && <Alert type="error" message={machinesError} />}

        {/* Lecture seule (opérateur) */}
        {!canCreate && (
          <Alert
            type="info"
            message="Votre rôle vous donne un accès en lecture seule : vous pouvez consulter l'historique et les résultats des inspections."
          />
        )}

        {/* Formulaire d'inspection (ADMIN + TECHNICIEN) */}
        {canCreate && (
          <div className="card p-5 space-y-6">
            <MachineSelector
              machines={machines}
              value={selectedMachine}
              onChange={setSelectedMachine}
              disabled={analyzing}
            />

            <ImageUploadDropzone
              file={file}
              preview={preview}
              onFile={handleFile}
              onClear={handleClearFile}
              disabled={analyzing}
            />

            <div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Spinner size="sm" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" />
                    Analyser avec l'IA
                  </>
                )}
              </button>
              {analyzeError && (
                <div className="mt-3">
                  <Alert type="error" message={analyzeError} />
                </div>
              )}
            </div>
          </div>
        )}

        {currentInspection && <InspectionResultCard inspection={currentInspection} />}

        {/* Historique */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Historique des inspections</h2>
            <button
              type="button"
              onClick={fetchHistory}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
              title="Rafraîchir"
            >
              <RefreshCw className="h-4 w-4" /> Rafraîchir
            </button>
          </div>

          <div className="card p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par machine..."
                  value={searchTerm}
                  onChange={(e) => { setPage(1); setSearchTerm(e.target.value) }}
                  className="input-field pl-9"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={filterMachine}
                  onChange={(e) => { setPage(1); setFilterMachine(e.target.value) }}
                  className="input-field"
                >
                  <option value="">Toutes les machines</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom} ({m.identifiant_interne})</option>
                  ))}
                </select>
                <select
                  value={filterStatut}
                  onChange={(e) => { setPage(1); setFilterStatut(e.target.value) }}
                  className="input-field"
                >
                  <option value="">Tous les statuts</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="EN_ANALYSE">En analyse</option>
                  <option value="TERMINEE">Terminée</option>
                  <option value="ERREUR">Erreur</option>
                </select>
              </div>
            </div>
          </div>

          <InspectionHistoryTable
            inspections={inspections}
            loading={historyLoading}
            error={historyError}
            canDelete={canDelete}
            onView={(insp) => setDetailInspection(insp)}
            onViewImage={(insp) => setLightboxImage(insp.image)}
            onViewResult={(insp) => setDetailInspection(insp)}
            onDelete={handleDelete}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Page {page} sur {totalPages} — {totalCount} inspection(s)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>

        {!canCreate && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Seuls les administrateurs et les techniciens peuvent lancer de nouvelles inspections.
          </p>
        )}

        {detailInspection && (
          <InspectionDetailModal
            inspection={detailInspection}
            onClose={() => setDetailInspection(null)}
            onViewImage={(insp) => setLightboxImage(insp.image)}
          />
        )}

        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage}
            alt="Inspection visuelle"
            onClose={() => setLightboxImage(null)}
          />
        )}
      </div>
    </Layout>
  )
}
