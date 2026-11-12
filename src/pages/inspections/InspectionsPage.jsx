import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScanLine, Search, RefreshCw, Info, ImagePlus } from 'lucide-react'
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
import InspectionComparison from '../../components/inspections/InspectionComparison'
import InspectionAnnotationEditor from '../../components/inspections/InspectionAnnotationEditor'
import { useAuthContext } from '../../context/AuthContext'
import {
  getInspections, createInspection, analyzeInspection, annotateInspection, deleteInspection,
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
  const [searchParams] = useSearchParams()
  const { user } = useAuthContext()
  const role = user?.role
  const canCreate = role === 'ADMIN' || role === 'TECHNICIEN'
  const canDelete = role === 'ADMIN' || role === 'TECHNICIEN'

  const [machines, setMachines] = useState([])
  const [machinesError, setMachinesError] = useState(null)

  const [selectedMachine, setSelectedMachine] = useState('')
  const [files, setFiles] = useState([])

  const [analyzing, setAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFeedback, setUploadFeedback] = useState('')
  const [analyzeError, setAnalyzeError] = useState(null)
  const [currentInspection, setCurrentInspection] = useState(null)

  const [inspections, setInspections] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [filterStatut, setFilterStatut] = useState('')
  const [filterMachine, setFilterMachine] = useState(() => searchParams.get('machine') || '')
  const [searchTerm, setSearchTerm] = useState('')

  const [detailInspection, setDetailInspection] = useState(null)
  const [annotationInspection, setAnnotationInspection] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [compareBefore, setCompareBefore] = useState('')
  const [compareAfter, setCompareAfter] = useState('')

  //  Chargement des machines ─
  useEffect(() => {
    let active = true
    getMachines({ page_size: 200 })
      .then((data) => { if (active) setMachines(data.results ?? data ?? []) })
      .catch(() => { if (active) setMachinesError('Impossible de charger la liste des machines.') })
    return () => { active = false }
  }, [])

  //  Chargement de l'historique (paginé + filtres) ─
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

  //  Gestion d'une sélection de médias (10 maximum) ─
  const handleAddFiles = (selected) => {
    setFiles((current) => [...current, ...selected].slice(0, 10))
    setAnalyzeError(null)
    setCurrentInspection(null)
    setUploadFeedback('')
  }

  const handleRemoveFile = (index) => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))

  // Lancement de l'inspection et de l'analyse IA
  const handleAnalyze = async () => {
    setAnalyzeError(null)
    if (!selectedMachine) {
      setAnalyzeError('Veuillez sélectionner une machine.')
      return
    }
    if (!files.length) {
      setAnalyzeError('Ajoutez au moins une photo.')
      return
    }

    setAnalyzing(true)
    setUploadProgress(0)
    setUploadFeedback('')
    setCurrentInspection(null)
    const completedFiles = []
    let analyzedCount = 0
    let lastAnalyzed = null
    try {
      for (const [index, file] of files.entries()) {
        const formData = new FormData()
        formData.append('machine', selectedMachine)
        formData.append('image', file)
        const created = await createInspection(formData, (event) => {
          if (!event.total) return
          const itemProgress = event.loaded / event.total
          setUploadProgress(Math.min(99, Math.round(((index + itemProgress) / files.length) * 100)))
        })
        completedFiles.push(file)
        const analyzed = await analyzeInspection(created.id)
        analyzedCount += 1
        lastAnalyzed = analyzed
      }
      setUploadProgress(100)
      setFiles((current) => current.filter((file) => !completedFiles.includes(file)))
      setCurrentInspection(lastAnalyzed)
      setUploadFeedback(`${completedFiles.length} photo(s) enregistrée(s) et ${analyzedCount} image(s) analysée(s).`)
      if (page !== 1) setPage(1)
      else await fetchHistory()
    } catch (err) {
      setFiles((current) => current.filter((file) => !completedFiles.includes(file)))
      setAnalyzeError(extractErrorMessage(err))
      if (completedFiles.length) setUploadFeedback(`${completedFiles.length} média(s) enregistré(s) avant l’erreur. Relancez l’envoi des fichiers restants.`)
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

  const handleSaveAnnotations = async (image, annotations) => {
    const formData = new FormData()
    formData.append('image', image)
    formData.append('annotations', JSON.stringify(annotations))
    const updated = await annotateInspection(annotationInspection.id, formData)
    setInspections((current) => current.map((item) => item.id === updated.id ? updated : item))
    setDetailInspection((current) => current?.id === updated.id ? updated : current)
    setAnnotationInspection(null)
    setUploadFeedback('Les annotations et l’image annotée ont été enregistrées.')
  }

  const Layout = role === 'ADMIN' ? AdminLayout
    : role === 'TECHNICIEN' ? TechnicianLayout
    : OperatorLayout

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <Layout pageTitle="Inspection visuelle par IA">
      <div className="sf-inspections space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary-600" />
            Inspection visuelle par IA
          </h1>
            <p className="mt-1 text-sm text-gray-500">
            Capturez ou importez jusqu’à 10 médias par machine, annotez les photos et consultez l’historique des analyses.
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

            <ImageUploadDropzone files={files} onFiles={handleAddFiles} onRemove={handleRemoveFile}
              machineLabel={machines.find((machine) => String(machine.id) === String(selectedMachine))?.identifiant_interne}
              technicianName={`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()}
              disabled={analyzing} maxFiles={10} maxMb={20} />

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
                    Envoi et analyse… {uploadProgress}%
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" />
                    Envoyer et analyser les médias
                  </>
                )}
              </button>
              {analyzing && <div className="sf-inspection-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}><span style={{ width: `${uploadProgress}%` }} /></div>}
              {uploadFeedback && <p className="sf-inspection-feedback" role="status">{uploadFeedback}</p>}
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
            onViewImage={(insp) => setLightboxImage(insp.image_annotee || insp.image)}
            onViewResult={(insp) => setDetailInspection(insp)}
            onDelete={handleDelete}
            onAnnotate={(insp) => setAnnotationInspection(insp)}
            onCompareBefore={(insp) => setCompareBefore(String(insp.id))}
            onCompareAfter={(insp) => setCompareAfter(String(insp.id))}
          />

          <InspectionComparison inspections={inspections} beforeId={compareBefore} afterId={compareAfter}
            onBeforeChange={setCompareBefore} onAfterChange={setCompareAfter} />

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
            onViewImage={(insp) => setLightboxImage(insp.image_annotee || insp.image)}
          />
        )}

        {annotationInspection && <InspectionAnnotationEditor inspection={annotationInspection}
          onClose={() => setAnnotationInspection(null)} onSave={handleSaveAnnotations} />}

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
