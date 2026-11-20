import { useEffect, useState } from 'react'
import { FileText, Activity, Wrench, Bell, Download, Info, AlertTriangle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  fetchMachineHealth, fetchAnomalies, fetchWorkOrdersSummary,
  exportMeasurements, exportEquipments, exportAlerts, exportPdf,
  arrayToCsv, downloadCsv,
} from '../../services/reportService'
import { getMachines } from '../../services/machineService'
import { formatHealthIndicator, formatNullableThreshold } from '../../utils/sensorDisplay'

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const eur = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

const woCost = (w) => {
  if (!w.rapport) return 0
  return (w.rapport.pieces || []).reduce((a, p) => a + (p.qte || 0) * (p.cout || 0), 0)
}

/* ── Composant principal ─────────────────────────────────────────────────── */

export default function RapportsPage() {
  const { user } = useAuthContext()
  const role = user?.role ?? 'OPERATEUR'
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [machines, setMachines] = useState([])
  const [kind, setKind] = useState('sante')
  const [machineId, setMachineId] = useState('')
  const [days, setDays] = useState(30)
  const [report, setReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    getMachines({ page_size: 200 })
      .then((d) => {
        const list = d.results ?? d ?? []
        setMachines(list)
        if (list.length > 0) setMachineId(String(list[0].id))
      })
      .catch(() => setMachines([]))
  }, [])

  const generate = async () => {
    setGenerating(true)
    setReport(null)
    try {
      if (kind === 'sante') {
        const data = await fetchMachineHealth(machineId, days)
        const mach = machines.find((m) => String(m.id) === String(machineId))
        setReport({ kind, machine: mach, days, ...data })
      } else if (kind === 'anom') {
        const alerts = await fetchAnomalies(days)
        setReport({ kind, days, alerts })
      } else {
        const wos = await fetchWorkOrdersSummary()
        setReport({ kind, days, wos })
      }
    } catch {
      setReport({ kind, error: true })
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (type) => {
    setExporting(type)
    setExportError('')
    try {
      let result
      if (type === 'sensors') result = await exportMeasurements()
      else if (type === 'equip') result = await exportEquipments()
      else result = await exportAlerts()
      const csv = arrayToCsv(result.headers, result.rows)
      const fileType = type === 'sensors' ? 'mesures' : type === 'equip' ? 'equipements' : 'alertes'
      downloadCsv(`smartfactory_${fileType}_${new Date().toISOString().slice(0, 10)}.csv`, csv)
    } catch (error) {
      setExportError(error.response?.data?.detail || 'Échec de l’export. Vérifie que le backend est disponible.')
    }
    finally { setExporting('') }
  }

  const handlePdfExport = async (currentReport) => {
    setExportingPdf(true)
    setPdfError('')
    try {
      const type = currentReport.kind === 'sante' ? 'sante' : currentReport.kind === 'anom' ? 'anomalies' : 'ot'
      await exportPdf({ type, days: currentReport.days, ...(type === 'sante' && { machine_id: machineId }) })
    } catch (error) {
      setPdfError(error.response?.data?.detail || 'Échec de la génération du PDF. Vérifie le backend et sa dépendance PDF.')
    } finally {
      setExportingPdf(false)
    }
  }

  const KINDS = [
    { key: 'sante', label: 'Santé machine' },
    { key: 'anom', label: 'Anomalies' },
    { key: 'ot', label: 'Récapitulatif OT' },
  ]

  return (
    <Layout pageTitle="Rapports & Exports">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          {/* Carte Rapport */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Générer un rapport</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {KINDS.map(({ key, label }) => (
                  <button key={key} onClick={() => { setKind(key); setReport(null) }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${kind === key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {kind === 'sante' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
                    <select value={machineId} onChange={(e) => setMachineId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.identifiant_interne || m.id} · {m.nom}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
                  <select value={days} onChange={(e) => setDays(+e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                    <option value={7}>Hebdomadaire (7 j)</option>
                    <option value={30}>Mensuelle (30 j)</option>
                  </select>
                </div>
              </div>
              <button onClick={generate} disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                <FileText className="h-4 w-4" /> {generating ? 'Génération…' : "Générer l'aperçu"}
              </button>
            </div>
          </div>

          {/* Carte Exports */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Exports de données</h3>
            </div>
            <div className="p-4 space-y-3">
              <button onClick={() => handleExport('sensors')} disabled={exporting === 'sensors'}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                <Activity className="h-5 w-5 text-primary-600 shrink-0" />
                <span>{exporting === 'sensors' ? 'Export…' : 'Mesures capteurs (CSV / Excel)'}</span>
              </button>
              <button onClick={() => handleExport('equip')} disabled={exporting === 'equip'}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                <Wrench className="h-5 w-5 text-primary-600 shrink-0" />
                <span>{exporting === 'equip' ? 'Export…' : 'Équipements (CSV)'}</span>
              </button>
              <button onClick={() => handleExport('alerts')} disabled={exporting === 'alerts'}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                <Bell className="h-5 w-5 text-primary-600 shrink-0" />
                <span>{exporting === 'alerts' ? 'Export…' : 'Historique des alertes (CSV / Excel)'}</span>
              </button>
              <p className="text-xs text-gray-400">Les fichiers sont téléchargés au format CSV compatible Excel.</p>
              {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
            </div>
          </div>
        </div>

        {report && <ReportPreview report={report} user={user} onExportPdf={handlePdfExport} exportingPdf={exportingPdf} pdfError={pdfError} />}
      </div>
    </Layout>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function ReportPreview({ report, user, onExportPdf, exportingPdf, pdfError }) {
  if (report.error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-center text-sm text-red-600">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        Impossible de générer le rapport.
      </div>
    )
  }
  const now = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const userName = `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Administrateur'
  const title = report.kind === 'sante' ? `Santé machine · ${report.machine?.nom || 'N/A'}` : report.kind === 'anom' ? 'Anomalies sur la période' : 'Récapitulatif des ordres de travail'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
        <p className="text-sm text-gray-600">Aperçu calculé depuis les données disponibles.</p>
        <button onClick={() => onExportPdf(report)} disabled={exportingPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          <Download className="h-4 w-4" /> {exportingPdf ? 'Génération du PDF…' : 'Télécharger le PDF'}
        </button>
        {pdfError && <p role="alert" className="w-full text-sm text-red-600">{pdfError}</p>}
      </div>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
          <div>
            <p className="text-xl font-bold text-gray-900">SmartFactory Twin</p>
            <p className="text-sm text-gray-500">Usine Tunis-Nord · rapport généré le {now} par {userName}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">Période : {report.days} derniers jours</p>
          </div>
        </div>

        {report.kind === 'sante' && <HealthReport report={report} />}
        {report.kind === 'anom' && <AnomaliesReport report={report} />}
        {report.kind === 'ot' && <OtReport report={report} />}

        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="h-4 w-4 shrink-0" />
          Les mesures, alertes et interventions de cet aperçu proviennent de la base SmartFactory Twin.
        </div>
      </div>
    </div>
  )
}

function HealthReport({ report }) {
  const health = report.sante == null || !Number.isFinite(Number(report.sante)) ? null : Number(report.sante)
  const rul = report.rul
  const circumference = 2 * Math.PI * 45
  const offset = health == null ? circumference : circumference - (health / 100) * circumference
  const color = health == null ? '#cbd5e1' : health >= 70 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6 items-center text-center">
        <div className="flex flex-col items-center">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 60 60)" />
            <text x="60" y="55" textAnchor="middle" fill="#111827" fontSize="24" fontWeight="700">{health == null ? '—' : health}</text>
            <text x="60" y="72" textAnchor="middle" fill="#6b7280" fontSize="9">INDICE SANTÉ</text>
          </svg>
          <p className="mt-1 text-xs text-gray-500">{formatHealthIndicator(report.sante)}</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-gray-900">{rul == null ? '—' : rul}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">RUL (cycles)</p>
          {rul == null && <p className="mt-1 max-w-40 text-xs text-gray-400">Non calculée pour cette machine industrielle.</p>}
        </div>
        <div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${report.statut === 'CRITIQUE' ? 'bg-red-100 text-red-800' : report.statut === 'DEGRADE' ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-800'}`}>{report.statut || 'Normal'}</span>
          <p className="text-xs text-gray-500 mt-2">{report.alertes_count ?? 0} alerte(s) · {report.ot_count ?? 0} OT</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">Indice descriptif : part des mesures valides comprises entre les seuils configurés. Ce n’est pas une prédiction de panne.</p>
      {report.nombre_mesures === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Aucune mesure valide n’a été enregistrée pour cette machine sur la période sélectionnée.</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-600">
            <tr>
              <th className="px-3 py-2 font-medium">Capteur</th>
              <th className="px-3 py-2 font-medium">Min</th>
              <th className="px-3 py-2 font-medium">Moyenne</th>
              <th className="px-3 py-2 font-medium">Max</th>
              <th className="px-3 py-2 font-medium">Seuil max</th>
            </tr>
          </thead>
          <tbody>
            {(report.capteurs || []).map((s, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-800">{s.nom} ({s.unite})</td>
                <td className="px-3 py-2 font-mono text-gray-700">{s.min == null || !Number.isFinite(Number(s.min)) ? 'Non calculable' : Number(s.min).toFixed(1)}</td>
                <td className="px-3 py-2 font-mono text-gray-700">{s.moy == null || !Number.isFinite(Number(s.moy)) ? 'Non calculable' : Number(s.moy).toFixed(1)}</td>
                <td className={`px-3 py-2 font-mono ${s.max != null && s.seuil_max != null && Number.isFinite(Number(s.max)) && Number(s.max) > Number(s.seuil_max) ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>{s.max == null || !Number.isFinite(Number(s.max)) ? 'Non calculable' : Number(s.max).toFixed(1)}</td>
                <td className="px-3 py-2 font-mono text-gray-500">{formatNullableThreshold(s.seuil_max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnomaliesReport({ report }) {
  const alerts = report.alerts || []
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-600">
            <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Machine</th><th className="px-3 py-2 font-medium">Niveau</th><th className="px-3 py-2 font-medium">Source</th><th className="px-3 py-2 font-medium">Message</th><th className="px-3 py-2 font-medium">Statut</th></tr>
          </thead>
          <tbody>
            {alerts.length === 0
              ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Aucune anomalie sur la période.</td></tr>
              : alerts.map((a, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-700">{fmtDate(a.date_declenchement)}</td>
                  <td className="px-3 py-2 text-gray-800">{a.machine_nom || a.machine}</td>
                  <td className="px-3 py-2">{a.niveau_label || a.niveau}</td>
                  <td className="px-3 py-2 text-gray-700">{a.capteur_identifiant || a.capteur || '—'}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{a.message}</td>
                  <td className="px-3 py-2">{a.statut_label || a.statut}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <p className="font-semibold text-gray-900">{alerts.length} événement(s)</p>
    </div>
  )
}

function OtReport({ report }) {
  const wos = report.wos || []
  const totalCost = wos.reduce((a, w) => a + woCost(w), 0)
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-600">
            <tr><th className="px-3 py-2 font-medium">OT</th><th className="px-3 py-2 font-medium">Machine</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Statut</th><th className="px-3 py-2 font-medium">Durée</th><th className="px-3 py-2 font-medium">Coût pièces</th></tr>
          </thead>
          <tbody>
            {wos.length === 0
              ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Aucun ordre de travail.</td></tr>
              : wos.map((w, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-700">{w.id}</td>
                  <td className="px-3 py-2 text-gray-800">{w.machine_nom}</td>
                  <td className="px-3 py-2">{w.type}</td>
                  <td className="px-3 py-2">{w.statut}</td>
                  <td className="px-3 py-2 font-mono">{w.rapport ? `${w.rapport.duree} h` : '—'}</td>
                  <td className="px-3 py-2 font-mono">{w.rapport ? eur(woCost(w)) : '—'}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <p className="font-semibold text-gray-900">Coût total des pièces : {eur(totalCost)}</p>
    </div>
  )
}
