import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle, Eye, ListChecks, Check,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import { importSensorsCsv, previewSensorsCsv } from '../../services/sensorService'

const CSV_SAMPLE = `sensor_id,name,machine_identifiant,type,unit,frequency_seconds,threshold_min,threshold_max,active,description
TEMP-CNC-101,Température CNC 101,CNC-101,TEMPERATURE,°C,60,10,90,true,Capteur de température
VIB-CNC-101,Vibration CNC 101,CNC-101,VIBRATION,mm/s,60,0,15,true,
PRES-CNC-102,Pression CNC 102,CNC-102,PRESSION,bar,300,0,10,true,`

function Stat({ value, label, color }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function SensorImportSummary({ data, isPreview }) {
  return (
    <div className="space-y-4">
      <div className={`border rounded-lg p-4 flex items-start gap-3 ${
        isPreview ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
      }`}>
        {isPreview ? (
          <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
        )}
        <h3 className={`text-sm font-medium ${isPreview ? 'text-blue-900' : 'text-green-900'}`}>
          {isPreview ? 'Prévisualisation — aucune donnée enregistrée' : 'Import terminé'}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat value={data.imported || 0} label="Capteurs importés" color="text-green-600" />
        <Stat value={data.rejected || 0} label="Capteurs rejetés" color="text-red-600" />
        <Stat value={data.duplicates || 0} label="Doublons" color="text-orange-600" />
      </div>

      {data.errors && data.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-900 mb-2">
            Erreurs ({data.errors.length})
          </h3>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {data.errors.slice(0, 50).map((e, idx) => (
              <p key={idx} className="text-xs text-amber-700">
                Ligne {e.row} : {e.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewTable({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
        <ListChecks className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">
          Aperçu des capteurs à créer ({items.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['sensor_id', 'name', 'machine', 'type', 'unit', 'fréquence', 'seuil min', 'seuil max', 'actif'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((it, idx) => (
              <tr key={`${it.sensor_id}-${idx}`} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-gray-900 whitespace-nowrap">{it.sensor_id}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.name}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.machine_identifiant}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.type}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.unit}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.frequency_seconds}s</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.threshold_min}</td>
                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{it.threshold_max}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    it.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {it.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SensorsImportPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const resetFeedback = () => {
    setError(null)
    setPreview(null)
    setResult(null)
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null)
    resetFeedback()
  }

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    resetFeedback()
    try {
      const formData = new FormData()
      formData.append('file', file)
      setPreview(await previewSensorsCsv(formData))
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de la prévisualisation CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      setResult(await importSensorsCsv(formData))
      setPreview(null)
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de l'import CSV")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/capteurs')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importer des capteurs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Créer plusieurs capteurs depuis un fichier CSV (aucune machine n'est créée)
            </p>
          </div>
        </div>

        <div className="card p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Format CSV attendu</h3>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">{CSV_SAMPLE}</pre>
            <p className="text-xs text-blue-800 mt-2">
              Types acceptés : TEMPERATURE, VIBRATION, PRESSION, COURANT,
              VITESSE_RPM, DEBIT, NIVEAU_SONORE. La fréquence est exprimée en
              secondes (<code>frequency_seconds</code>) ; l'ancien en-tête{' '}
              <code>frequence_minutes</code> est aussi accepté et converti en
              secondes. La machine doit exister au préalable (via son identifiant interne).
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {file && <p className="text-sm text-gray-600">Fichier sélectionné : {file.name}</p>}

            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Eye className="h-4 w-4" /> Prévisualiser
              </button>
              <button
                onClick={handleConfirm}
                disabled={!file || !preview || loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? 'Traitement...' : <><Upload className="h-4 w-4" /> Confirmer l'import</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {preview && (
            <>
              <SensorImportSummary data={preview} isPreview />
              {preview.columns && preview.columns.length > 0 && (
                <p className="text-xs text-gray-500">
                  Colonnes détectées : {' '}
                  <span className="font-mono">{preview.columns.join(', ')}</span>
                </p>
              )}
              <PreviewTable items={preview.preview_items} />
            </>
          )}

          {result && (
            <>
              <SensorImportSummary data={result} isPreview={false} />
              <button
                onClick={() => navigate('/capteurs')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" /> Voir la liste des capteurs
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
