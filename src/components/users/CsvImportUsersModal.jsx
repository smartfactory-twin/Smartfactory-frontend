import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, FileText, AlertTriangle } from 'lucide-react'
import { adminCreateUser } from '../../services/authService'

const CSV_TEMPLATE = [
  'prenom,nom,email,role',
  'Ali,Benali,ali.benali@smartfactory.dz,OPERATEUR',
  'Sirine,Rezgui,sirine.rezgui@smartfactory.dz,TECHNICIEN',
].join('\n')

const VALID_ROLES = ['TECHNICIEN', 'OPERATEUR']

export default function CsvImportUsersModal({ onClose, onSuccess }) {
  const [step, setStep]         = useState(1)
  const [file, setFile]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (f && f.name.endsWith('.csv')) setFile(f)
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'template_utilisateurs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.replace(/\r/, ''))
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    return lines.slice(1).map((line, i) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
      row._line = i + 2
      return row
    })
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      let created = 0
      const errors = []

      for (const row of rows) {
        const { prenom, nom, email, role, _line } = row

        if (!prenom?.trim()) { errors.push({ row: _line, field: 'prenom', message: 'Prénom requis' }); continue }
        if (!nom?.trim())    { errors.push({ row: _line, field: 'nom',    message: 'Nom requis' }); continue }
        if (!email?.trim())  { errors.push({ row: _line, field: 'email',  message: 'Email requis' }); continue }
        if (!email.includes('@')) { errors.push({ row: _line, field: 'email', message: 'Email invalide' }); continue }
        const roleUpper = (role ?? 'OPERATEUR').toUpperCase()
        if (!VALID_ROLES.includes(roleUpper)) {
          errors.push({ row: _line, field: 'role', message: `Rôle invalide "${role}". Valeurs : ${VALID_ROLES.join(', ')}` }); continue
        }

        try {
          await adminCreateUser({ prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), role: roleUpper })
          created++
        } catch (err) {
          const detail = err?.response?.data
          const msg = detail?.email?.[0] ?? detail?.detail ?? 'Erreur serveur'
          errors.push({ row: _line, field: 'email', message: msg })
        }
      }

      setResult({ created, errors, total: rows.length })
      setStep(2)
      if (created > 0) onSuccess()
    } catch {
      setResult({ created: 0, errors: [{ row: '—', field: '—', message: 'Impossible de lire le fichier.' }], total: 0 })
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-gray-900">Importer des utilisateurs (CSV)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Un email avec un mot de passe temporaire sera envoyé à chaque utilisateur créé.
                  Les doublons d'email seront signalés comme erreurs.
                </p>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
                  ${file ? 'border-green-400 bg-green-50' : ''}`}
              >
                <input ref={inputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium text-green-700">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} Ko</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">Glisser-déposer ou cliquer</p>
                    <p className="text-xs text-gray-400">Colonnes : prenom, nom, email, role</p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-400">Format attendu ?</p>
                <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline">
                  Télécharger le template
                </button>
              </div>

              <div className="mt-5 flex gap-3 justify-end">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={handleImport} disabled={!file || loading}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {loading ? 'Import en cours…' : 'Importer'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">compte{result.created !== 1 ? 's' : ''} créé{result.created !== 1 ? 's' : ''}</p>
                </div>
                <div className={`flex-1 border rounded-xl p-4 text-center ${result.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <AlertCircle className={`h-6 w-6 mx-auto mb-1 ${result.errors.length > 0 ? 'text-red-400' : 'text-gray-300'}`} />
                  <p className={`text-2xl font-bold ${result.errors.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {result.errors.length}
                  </p>
                  <p className={`text-xs ${result.errors.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    erreur{result.errors.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="border border-red-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto mb-5">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-red-600">Ligne</th>
                        <th className="text-left px-3 py-2 font-semibold text-red-600">Champ</th>
                        <th className="text-left px-3 py-2 font-semibold text-red-600">Erreur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {result.errors.map((e, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2 text-gray-600">{e.row}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{e.field}</td>
                          <td className="px-3 py-2 text-red-700">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button onClick={() => { setStep(1); setFile(null); setResult(null) }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Réessayer
                </button>
                <button onClick={onClose}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
