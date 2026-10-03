import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle, Eye } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  importReadingsCsv,
  importReadingsJson,
  previewReadingsCsv,
  previewReadingsJson,
} from '../../services/sensorService'

function Stat({ value, label, color }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function ImportSummary({ data, isPreview }) {
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
        <div>
          <h3 className={`text-sm font-medium ${isPreview ? 'text-blue-900' : 'text-green-900'}`}>
            {isPreview ? 'Prévisualisation — aucune donnée enregistrée' : 'Import terminé'}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat value={data.imported || 0} label="Mesures importées" color="text-green-600" />
        <Stat value={data.rejected || 0} label="Mesures rejetées" color="text-red-600" />
        <Stat value={data.duplicates || data.duplicated || 0} label="Doublons" color="text-orange-600" />
      </div>

      {data.errors && data.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-900 mb-2">Erreurs ({data.errors.length})</h3>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {data.errors.slice(0, 20).map((e, idx) => (
              <p key={idx} className="text-xs text-amber-700">Ligne {e.row}: {e.message}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReadingsImportPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [activeTab, setActiveTab] = useState('csv')
  const [file, setFile] = useState(null)
  const [jsonData, setJsonData] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  const CSV_SAMPLE = `sensor_id,timestamp,value
TEMP-001,2026-10-03T10:00:00Z,65.2
TEMP-001,2026-10-03T10:01:00Z,66.1
TEMP-001,2026-10-03T10:02:00Z,67.4`

  const JSON_SAMPLE = `[
  {
    "sensor_id": "TEMP-001",
    "timestamp": "2026-10-03T10:00:00Z",
    "value": 65.2
  },
  {
    "sensor_id": "TEMP-001",
    "timestamp": "2026-10-03T10:01:00Z",
    "value": 66.1
  }
]`

  const resetFeedback = () => {
    setError(null)
    setResult(null)
    setPreview(null)
  }

  const handleCsvPreview = async () => {
    if (!file) return
    setLoading(true)
    resetFeedback()
    try {
      const formData = new FormData()
      formData.append('file', file)
      setPreview(await previewReadingsCsv(formData))
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de la prévisualisation CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImport = async () => {
    if (!file) return
    setLoading(true)
    resetFeedback()
    try {
      const formData = new FormData()
      formData.append('file', file)
      setResult(await importReadingsCsv(formData))
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de l\'import CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleJsonPreview = async () => {
    if (!jsonData) return
    setLoading(true)
    resetFeedback()
    try {
      setPreview(await previewReadingsJson(JSON.parse(jsonData)))
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON invalide: ' + err.message)
      } else {
        setError(err?.response?.data?.detail || 'Erreur lors de la prévisualisation JSON')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleJsonImport = async () => {
    if (!jsonData) return
    setLoading(true)
    resetFeedback()
    try {
      setResult(await importReadingsJson(JSON.parse(jsonData)))
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON invalide: ' + err.message)
      } else {
        setError(err?.response?.data?.detail || 'Erreur lors de l\'import JSON')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/capteurs')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importer des mesures historiques</h1>
            <p className="text-sm text-gray-500 mt-1">Importer des lectures de capteurs au format CSV ou JSON</p>
          </div>
        </div>

        <div className="card">
          <div className="border-b border-gray-200 flex">
            <button
              className={`px-6 py-3 text-sm font-medium ${activeTab === 'csv' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('csv')}
            >
              Import CSV
            </button>
            <button
              className={`px-6 py-3 text-sm font-medium ${activeTab === 'json' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('json')}
            >
              Import JSON
            </button>
          </div>

          <div className="p-6 space-y-6">
            {activeTab === 'csv' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Format CSV attendu</h3>
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">{CSV_SAMPLE}</pre>
                </div>
                <div className="space-y-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {file && <p className="text-sm text-gray-600">Fichier sélectionné: {file.name}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCsvPreview}
                      disabled={!file || loading}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" /> Prévisualiser
                    </button>
                    <button
                      onClick={handleCsvImport}
                      disabled={!file || loading}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Traitement...' : <><Upload className="h-4 w-4" /> Importer CSV</>}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'json' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Format JSON attendu</h3>
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">{JSON_SAMPLE}</pre>
                </div>
                <div className="space-y-4">
                  <textarea
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    rows={8}
                    className="input-field font-mono text-xs"
                    placeholder="Collez votre JSON ici..."
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleJsonPreview}
                      disabled={!jsonData || loading}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" /> Prévisualiser
                    </button>
                    <button
                      onClick={handleJsonImport}
                      disabled={!jsonData || loading}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Traitement...' : <><Upload className="h-4 w-4" /> Importer JSON</>}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {preview && <ImportSummary data={preview} isPreview />}
            {result && <ImportSummary data={result} isPreview={false} />}
          </div>
        </div>
      </div>
    </Layout>
  )
}
