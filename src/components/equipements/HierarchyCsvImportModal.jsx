import { useState, useRef } from 'react'
import {
  Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet,
  Building2, Layers, GitBranch, Wrench, Package, ArrowRight,
  Download, AlertTriangle
} from 'lucide-react'
import Spinner from '../common/Spinner'
import { previewHierarchyCsv, importHierarchyCsv } from '../../services/equipementService'

const CSV_HIERARCHY_SAMPLE = `usine_nom,usine_adresse,usine_description,zone_nom,zone_description,ligne_nom,ligne_description,machine_identifiant,machine_nom,machine_numero_serie,machine_marque,machine_modele,machine_date_installation,machine_statut,machine_description,composant_nom,composant_numero_piece,composant_description
Usine Centrale,Zone Industrielle Alger,Site de production principal,Zone Assemblage,Atelier assemblage,Ligne 01,Ligne rapide,MCH-001,Presse Hydraulique 50T,SN-1001,SmartTech,ST-500,2024-01-15,NORMAL,Presse principale,Moteur 5kW,MOT-01,Moteur d'entraînement
Usine Centrale,Zone Industrielle Alger,Site de production principal,Zone Assemblage,Atelier assemblage,Ligne 01,Ligne rapide,MCH-001,Presse Hydraulique 50T,SN-1001,SmartTech,ST-500,2024-01-15,NORMAL,Presse principale,Vanne Pression,VN-01,Vanne de régulation
Usine Centrale,Zone Industrielle Alger,Site de production principal,Zone Assemblage,Atelier assemblage,Ligne 02,Ligne finition,MCH-002,Robot Peintre,SN-1002,Kuka,KR-6,2024-02-20,NORMAL,Robot peinture,Buse haute pression,BS-01,Buse pulvérisation`

export default function HierarchyCsvImportModal({ onClose, onSuccess }) {
  const [file, setFile]             = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [importing, setImporting]   = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [errorMsg, setErrorMsg]     = useState(null)
  const inputRef = useRef(null)

  const downloadSampleTemplate = () => {
    const blob = new Blob([`\ufeff${CSV_HIERARCHY_SAMPLE}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele_hierarchie_equipements.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Veuillez sélectionner un fichier au format .csv')
      return
    }

    setFile(selectedFile)
    setErrorMsg(null)
    setAnalyzing(true)
    setPreviewData(null)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const data = await previewHierarchyCsv(formData)
      setPreviewData(data)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Erreur lors de l’analyse du fichier CSV.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!file || !previewData) return
    setImporting(true)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await importHierarchyCsv(formData)
      setImportResult(res)
      if (onSuccess) {
        onSuccess(res)
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Erreur lors de l’importation des équipements.')
    } finally {
      setImporting(false)
    }
  }

  const resetSelection = () => {
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setErrorMsg(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Importer la hiérarchie des équipements</h2>
              <p className="text-xs text-gray-500">Usine → Zone → Ligne → Machine → Composant (CSV)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* SUCCESS RESULT SCREEN */}
          {importResult ? (
            <div className="space-y-5 py-2">
              <div className="text-center py-4 bg-green-50/70 border border-green-200 rounded-xl">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <h3 className="text-base font-bold text-green-900">Importation réussie avec succès !</h3>
                <p className="text-xs text-green-700 mt-1">
                  La hiérarchie des équipements a été mise à jour dans la base de données.
                </p>
              </div>

              {/* Stats Summary */}
              {importResult.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium">Usines</p>
                    <p className="text-lg font-bold text-gray-900">
                      {importResult.stats.usines_created} <span className="text-xs text-gray-400 font-normal">créée(s)</span>
                    </p>
                    {importResult.stats.usines_reused > 0 && (
                      <p className="text-[11px] text-gray-400">{importResult.stats.usines_reused} réutilisée(s)</p>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium">Zones</p>
                    <p className="text-lg font-bold text-gray-900">
                      {importResult.stats.zones_created} <span className="text-xs text-gray-400 font-normal">créée(s)</span>
                    </p>
                    {importResult.stats.zones_reused > 0 && (
                      <p className="text-[11px] text-gray-400">{importResult.stats.zones_reused} réutilisée(s)</p>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium">Lignes</p>
                    <p className="text-lg font-bold text-gray-900">
                      {importResult.stats.lignes_created} <span className="text-xs text-gray-400 font-normal">créée(s)</span>
                    </p>
                    {importResult.stats.lignes_reused > 0 && (
                      <p className="text-[11px] text-gray-400">{importResult.stats.lignes_reused} réutilisée(s)</p>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium">Machines</p>
                    <p className="text-lg font-bold text-gray-900">
                      {importResult.stats.machines_created} <span className="text-xs text-gray-400 font-normal">créée(s)</span>
                    </p>
                    {importResult.stats.machines_updated > 0 && (
                      <p className="text-[11px] text-primary-600">{importResult.stats.machines_updated} mise(s) à jour</p>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl col-span-2 sm:col-span-2">
                    <p className="text-xs text-gray-500 font-medium">Composants</p>
                    <p className="text-lg font-bold text-gray-900">
                      {importResult.stats.composants_created} <span className="text-xs text-gray-400 font-normal">créé(s)</span>
                    </p>
                    {importResult.stats.composants_reused > 0 && (
                      <p className="text-[11px] text-gray-400">{importResult.stats.composants_reused} réutilisé(s)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Non-fatal Errors from skipped invalid rows */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-2 text-amber-800 font-medium text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>{importResult.errors.length} ligne(s) non importée(s) en raison d'erreurs :</span>
                  </div>
                  <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto pl-6 list-disc">
                    {importResult.errors.map((e, idx) => (
                      <li key={idx}>Ligne {e.row} : {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : !file ? (
            /* STEP 1: FILE DROP / SELECT */
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleFileSelect(e.dataTransfer.files?.[0])
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                  ${dragOver ? 'border-primary-500 bg-primary-50/50 scale-[1.01]' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50/80'}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Glissez et déposez votre fichier CSV ici
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">ou cliquez pour parcourir votre ordinateur</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600">
                    Format .CSV (délimiteur virgule ou point-virgule)
                  </span>
                </div>
              </div>

              {/* Template Download & Format Guide */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800">Besoin d'un modèle conforme ?</p>
                  <p className="text-[11px] text-gray-500">
                    Colonnes: usine_nom, zone_nom, ligne_nom, machine_identifiant, machine_nom, composant_nom…
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors flex-shrink-0"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger l'exemple CSV
                </button>
              </div>
            </div>
          ) : analyzing ? (
            /* ANALYZING STATE */
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <Spinner size="lg" />
              <p className="text-sm font-semibold text-gray-700">Analyse et validation du fichier CSV…</p>
              <p className="text-xs text-gray-400">Vérification de la structure et détection des doublons</p>
            </div>
          ) : previewData ? (
            /* STEP 2: PREVIEW & VALIDATION RESULTS */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary-600" />
                  <span className="text-xs font-semibold text-gray-800">{file.name}</span>
                  <span className="text-[11px] text-gray-400">({(file.size / 1024).toFixed(1)} Ko)</span>
                </div>
                <button
                  type="button"
                  onClick={resetSelection}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Changer de fichier
                </button>
              </div>

              {/* Preview Counters */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aperçu des éléments détectés
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="bg-primary-50/60 border border-primary-100 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-primary-600 mb-0.5">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-semibold">Usines</span>
                    </div>
                    <p className="text-base font-bold text-primary-900">{previewData.summary?.usines_count ?? 0}</p>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-100 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
                      <Layers className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-semibold">Zones</span>
                    </div>
                    <p className="text-base font-bold text-blue-900">{previewData.summary?.zones_count ?? 0}</p>
                  </div>
                  <div className="bg-green-50/60 border border-green-100 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 mb-0.5">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-semibold">Lignes</span>
                    </div>
                    <p className="text-base font-bold text-green-900">{previewData.summary?.lignes_count ?? 0}</p>
                  </div>
                  <div className="bg-orange-50/60 border border-orange-100 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-orange-600 mb-0.5">
                      <Wrench className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-semibold">Machines</span>
                    </div>
                    <p className="text-base font-bold text-orange-900">{previewData.summary?.machines_count ?? 0}</p>
                  </div>
                  <div className="bg-purple-50/60 border border-purple-100 p-2.5 rounded-xl text-center col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-center gap-1 text-purple-600 mb-0.5">
                      <Package className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-semibold">Composants</span>
                    </div>
                    <p className="text-base font-bold text-purple-900">{previewData.summary?.composants_count ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Rows Validity Status */}
              <div className="flex items-center gap-3 text-xs bg-gray-50 border border-gray-200 p-3 rounded-xl">
                <span className="font-semibold text-gray-700">Total lignes CSV : {previewData.total_rows_count}</span>
                <span className="text-gray-300">|</span>
                <span className="text-green-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  {previewData.valid_rows_count} valide{(previewData.valid_rows_count ?? 0) > 1 ? 's' : ''}
                </span>
                {previewData.invalid_rows_count > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      {previewData.invalid_rows_count} invalide{(previewData.invalid_rows_count ?? 0) > 1 ? 's' : ''} (ignorée{previewData.invalid_rows_count > 1 ? 's' : ''})
                    </span>
                  </>
                )}
              </div>

              {/* Errors Breakdown (if any) */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div className="border border-red-200 bg-red-50/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <span>Erreurs de validation détectées ({previewData.errors.length}) :</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {previewData.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-700 bg-white/80 border border-red-100 rounded-lg px-2.5 py-1 flex items-start gap-2">
                        <span className="font-mono font-bold text-red-800 bg-red-100 px-1 rounded text-[10px] mt-0.5">
                          Ligne {err.row}
                        </span>
                        <span className="flex-1">{err.message}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-red-600 italic">
                    Note : Les lignes avec erreurs ne seront pas importées. Seules les lignes valides seront intégrées.
                  </p>
                </div>
              )}

              {/* Sample Preview Rows */}
              {previewData.preview_items && previewData.preview_items.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-gray-700">Aperçu des données valides :</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5">Usine</th>
                          <th className="px-3 py-1.5">Zone</th>
                          <th className="px-3 py-1.5">Ligne</th>
                          <th className="px-3 py-1.5">Machine</th>
                          <th className="px-3 py-1.5">Composant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.preview_items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1 font-medium text-gray-900">{item.usine}</td>
                            <td className="px-3 py-1 text-gray-600">{item.zone || '—'}</td>
                            <td className="px-3 py-1 text-gray-600">{item.ligne || '—'}</td>
                            <td className="px-3 py-1 text-gray-800">
                              {item.machine_nom ? `${item.machine_nom} (${item.machine_identifiant})` : (item.machine_identifiant || '—')}
                            </td>
                            <td className="px-3 py-1 text-gray-500">{item.composant_nom || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          {importResult ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
              >
                Terminer
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>

              {previewData && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || (previewData.valid_rows_count ?? 0) === 0}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Spinner size="sm" />
                      <span>Importation en cours…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmer l'importation ({previewData.valid_rows_count} lignes)</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
