import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BrainCircuit, Gauge, SlidersHorizontal, Cpu, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import { getMachines } from '../../services/machineService'
import { getCapteurs } from '../../services/sensorService'
import { getAiModels, getAnomalyAnalysis, simulateWhatIf } from '../../services/aiPredictionService'
import { getPredictiveModelStatus, predictRemainingUsefulLife } from '../../services/predictiveMaintenanceService'
import './PredictionsIaPage.css'

const TABS = [
  { id: 'anomalies', label: 'Anomalies', Icon: Activity },
  { id: 'rul', label: 'Prédiction RUL', Icon: Gauge },
  { id: 'whatif', label: 'Simulation What-If', Icon: SlidersHorizontal },
  { id: 'models', label: 'Modèles', Icon: Cpu },
]

function parseCmapss(text) {
  const groups = new Map()
  for (const line of text.split(/\r?\n/)) {
    const values = line.trim().split(/\s+/).filter(Boolean).map(Number)
    if (values.length < 26 || values.some((value) => !Number.isFinite(value))) continue
    const [unit, cycle, ...features] = values
    if (!groups.has(unit)) groups.set(unit, [])
    groups.get(unit).push({ cycle, features })
  }
  return [...groups.entries()].map(([unit, samples]) => ({ unit, samples }))
}

function TrendChart({ points, threshold }) {
  const width = 720
  const height = 210
  const coords = points.map((point, index) => `${points.length < 2 ? 0 : index / (points.length - 1) * width},${height - Math.max(0, Math.min(1, point.score)) * height}`).join(' ')
  const thresholdY = height - threshold * height
  return <svg className="sf-ai-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution du score statistique d’anomalie">
    {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="sf-ai-gridline" />)}
    <line x1="0" x2={width} y1={thresholdY} y2={thresholdY} className="sf-ai-threshold" />
    {coords && <polyline points={coords} className="sf-ai-line" />}
    {points.length === 0 && <text x={width / 2} y={height / 2} textAnchor="middle" className="sf-ai-empty-chart">Pas encore de mesures récentes</text>}
  </svg>
}

export default function PredictionsIaPage() {
  const { user } = useAuthContext()
  const Layout = user?.role === 'ADMIN' ? AdminLayout : user?.role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout
  const [tab, setTab] = useState('anomalies')
  const [machines, setMachines] = useState([])
  const [machineId, setMachineId] = useState('')
  const [sensors, setSensors] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [models, setModels] = useState(null)
  const [modelStatus, setModelStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [engines, setEngines] = useState([])
  const [engineUnit, setEngineUnit] = useState('')
  const [rul, setRul] = useState(null)
  const [sensorId, setSensorId] = useState('')
  const [variation, setVariation] = useState(10)
  const [whatIf, setWhatIf] = useState(null)
  const [selectedAlert, setSelectedAlert] = useState(null)

  useEffect(() => {
    if (!selectedAlert) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedAlert(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedAlert])

  const selectedEngine = useMemo(() => engines.find((engine) => String(engine.unit) === String(engineUnit)), [engines, engineUnit])
  const loadAnomalies = useCallback(async () => {
    if (!machineId) return
    setBusy(true)
    setError('')
    try { setAnalysis(await getAnomalyAnalysis(machineId)) }
    catch (exception) { setError(exception.response?.data?.detail || 'Impossible de charger les mesures et leur score.') }
    finally { setBusy(false) }
  }, [machineId])

  useEffect(() => {
    getMachines({ page_size: 200 }).then((data) => {
      const items = data.results ?? data ?? []
      setMachines(items)
      if (items.length) setMachineId(String(items[0].id))
    }).catch(() => setError('Impossible de charger les machines accessibles.'))
    getAiModels().then(setModels).catch(() => {})
    getPredictiveModelStatus().then(setModelStatus).catch(() => setModelStatus({ ready: false, detail: 'API RUL indisponible.' }))
  }, [])

  useEffect(() => { loadAnomalies() }, [loadAnomalies])
  useEffect(() => {
    if (!machineId) return
    getCapteurs({ machine: machineId, page_size: 200 }).then((data) => {
      const items = data.results ?? data ?? []
      setSensors(items)
      setSensorId((current) => items.some((item) => String(item.id) === String(current)) ? current : String(items[0]?.id ?? ''))
    }).catch(() => setSensors([]))
  }, [machineId])

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    setRul(null); setError(''); setFileName(file?.name || '')
    if (!file) return
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Le fichier dépasse 20 Mo.')
      const parsed = parseCmapss(await file.text())
      if (!parsed.length) throw new Error('Aucune ligne C-MAPSS valide détectée : 26 colonnes sont attendues.')
      setEngines(parsed); setEngineUnit(String(parsed[0].unit))
    } catch (exception) { setEngines([]); setEngineUnit(''); setError(exception.message) }
  }

  const runRul = async () => {
    if (!selectedEngine || !modelStatus?.ready) return
    setBusy(true); setError('')
    try {
      const samples = selectedEngine.samples.slice(-30)
      const result = await predictRemainingUsefulLife({ cycle: samples.at(-1).cycle, history: samples.map((sample) => sample.features) })
      setRul({ ...result, unit: selectedEngine.unit })
    } catch (exception) { setError(exception.response?.data?.detail || 'Échec de l’estimation RUL.') }
    finally { setBusy(false) }
  }

  const runWhatIf = async () => {
    setBusy(true); setError(''); setWhatIf(null)
    try { setWhatIf(await simulateWhatIf({ sensor_id: sensorId, variation_percent: variation })) }
    catch (exception) { setError(exception.response?.data?.detail || 'La simulation n’a pas pu être calculée.') }
    finally { setBusy(false) }
  }

  const score = analysis?.score ?? 0

  return <Layout pageTitle="Prédictions IA">
    <main className="sf-ai-page">
      <nav className="sf-ai-tabs" aria-label="Sections des prédictions IA">{TABS.map(({ id, label, Icon }) => <button key={id} onClick={() => { setTab(id); setError('') }} className={tab === id ? 'is-active' : ''}><Icon />{label}</button>)}</nav>
      {error && <p className="sf-ai-error" role="alert"><AlertTriangle />{error}</p>}

      {tab === 'anomalies' && <>
        <div className="sf-ai-toolbar"><label>Machine<select value={machineId} onChange={(event) => setMachineId(event.target.value)}>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.identifiant_interne} · {machine.nom}</option>)}</select></label><button onClick={loadAnomalies} disabled={busy}>Actualiser</button></div>
        <div className="sf-ai-grid">
          <section className="sf-ai-card"><header><h2>Score statistique d’anomalie</h2><span>Mesures réelles · 24 h</span></header><TrendChart points={analysis?.history ?? []} threshold={analysis?.threshold ?? .65} /><p className="sf-ai-method">{analysis?.method}</p></section>
          <section className="sf-ai-card sf-ai-score"><div className={`sf-ai-gauge ${analysis?.detected ? 'is-alert' : ''}`}><strong>{Math.round(score * 100)}</strong><span>SCORE ×100</span></div><b className={analysis?.detected ? 'sf-ai-danger' : 'sf-ai-good'}>{analysis?.detected ? 'Anomalie détectée' : 'Aucune anomalie au seuil configuré'}</b><p>Seuil configuré : <strong>{analysis?.threshold ?? .65}</strong></p><h3>Capteurs contributeurs</h3>{analysis?.contributors?.length ? analysis.contributors.map((item) => <div className="sf-ai-contributor" key={item.sensor}><span>{item.sensor}</span><meter min="0" max="1" value={item.score} /><small>{item.value} {item.unit}</small></div>) : <p>Aucun contributeur signalé.</p>}</section>
        </div>
        <section className="sf-ai-card sf-ai-history"><header><h2>Historique des anomalies et alertes</h2><span>Alertes enregistrées sur les dernières 24 h · score IA affiché uniquement s’il existe</span></header><div className="sf-ai-table-wrap"><table><thead><tr><th>Date</th><th>Machine</th><th>Capteur</th><th>Score</th><th>Statut</th><th>Source</th><th> </th></tr></thead><tbody>{(analysis?.alerts ?? []).length ? analysis.alerts.map((alert) => <tr key={alert.id}><td>{new Date(alert.timestamp).toLocaleString('fr-FR')}</td><td>{alert.machine}</td><td>{alert.sensor}</td><td>{alert.score == null ? '—' : Number(alert.score).toFixed(2)}</td><td>{alert.status}</td><td>{alert.source}</td><td><button className="sf-ai-detail-button" onClick={() => setSelectedAlert(alert)}>Détail</button></td></tr>) : <tr><td colSpan="7">Aucune alerte enregistrée sur les dernières 24 heures.</td></tr>}</tbody></table></div></section>
      </>}

      {tab === 'rul' && <div className="sf-ai-grid"><section className="sf-ai-card"><header><h2>Estimer la durée de vie restante</h2><span>NASA C-MAPSS · moteurs turbofan simulés</span></header><label className="sf-ai-upload"><Upload /><input type="file" accept=".txt,text/plain" onChange={onFile} />{fileName || 'Choisir un fichier test_FD00x.txt'}<small>Format NASA · 26 colonnes · 20 Mo maximum</small></label>{engines.length > 0 && <label> Moteur du fichier<select value={engineUnit} onChange={(event) => { setEngineUnit(event.target.value); setRul(null) }}>{engines.map((engine) => <option key={engine.unit} value={engine.unit}>Moteur {engine.unit} - cycle {engine.samples.at(-1).cycle}</option>)}</select></label>}<button className="sf-ai-primary" onClick={runRul} disabled={!selectedEngine || !modelStatus?.ready || busy}>{busy ? 'Calcul…' : 'Estimer la durée de vie'}</button><p className="sf-ai-method">Les séries capteurs d’usine ne sont pas converties automatiquement en format C-MAPSS.</p></section><section className="sf-ai-card sf-ai-score"><header><h2>Résultat RUL</h2></header>{rul ? <><div className="sf-ai-rul-value">{rul.predicted_rul_cycles}<small> cycles</small></div><p>Moteur {rul.unit} · cycle {rul.cycle} · {rul.health_state}</p></> : <p>{modelStatus?.ready ? 'Charge une série puis lance le calcul.' : modelStatus?.detail || 'Modèle C-MAPSS non entraîné.'}</p>}</section></div>}

      {tab === 'whatif' && <div className="sf-ai-grid"><section className="sf-ai-card"><header><h2>Simulation What-If</h2><span>Impact sur le score statistique</span></header><p className="sf-ai-method">Modifie virtuellement la dernière mesure valide du capteur. La simulation ne modifie ni la mesure enregistrée ni l’historique.</p><label>Machine<select value={machineId} onChange={(event) => { setMachineId(event.target.value); setWhatIf(null) }}>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.identifiant_interne} · {machine.nom}</option>)}</select></label><label>Capteur<select value={sensorId} onChange={(event) => { setSensorId(event.target.value); setWhatIf(null) }}>{sensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.nom} · {sensor.unite}</option>)}</select></label><label>Variation simulée (%)<input type="number" value={variation} min="-100" max="300" onChange={(event) => { setVariation(Number(event.target.value)); setWhatIf(null) }} /></label><small className="sf-ai-method">Valeurs acceptées : −100 % à +300 %.</small><button className="sf-ai-primary" disabled={!sensorId || busy || variation < -100 || variation > 300} onClick={runWhatIf}>{busy ? 'Calcul…' : 'Calculer le scénario'}</button></section><section className="sf-ai-card sf-ai-score"><header><h2>Impact simulé</h2></header>{whatIf ? <><p>{whatIf.sensor} · {whatIf.machine}</p><div className="sf-ai-whatif-scores"><span>Score avant<strong>{Number(whatIf.score_before).toFixed(2)}</strong></span><span>Score simulé<strong className={whatIf.anomaly_after ? 'sf-ai-danger' : 'sf-ai-good'}>{Number(whatIf.score_after).toFixed(2)}</strong></span></div><p>Mesure : <strong>{whatIf.value_before} {whatIf.unit}</strong> → <strong>{whatIf.value_after} {whatIf.unit}</strong></p><p>Variation : {whatIf.variation_percent}% · Seuil : {whatIf.threshold}</p><b className={whatIf.anomaly_after ? 'sf-ai-danger' : 'sf-ai-good'}>{whatIf.anomaly_after ? 'Le score simulé atteint le seuil d’anomalie' : 'Le score simulé reste sous le seuil'}</b><p className="sf-ai-method">{whatIf.method}</p></> : <p>Sélectionne une machine et un capteur, ajuste la variation, puis calcule le scénario.</p>}</section></div>}

      {tab === 'models' && <section className="sf-ai-card sf-ai-models-panel"><header><h2>Modèles et méthodes disponibles</h2><span>État réel du backend</span></header><p className="sf-ai-method">{models?.note}</p><div className="sf-ai-models">{(models?.models ?? []).map((model) => <article key={model.id}><div className="sf-ai-model-title"><BrainCircuit /><h3>{model.name}</h3><span className={`sf-ai-state state-${model.state.toLowerCase()}`}>{model.state.replaceAll('_', ' ')}</span></div><p>{model.dataset}</p>{model.id === 'cmapss-rul' && model.metrics && Object.keys(model.metrics).length > 0 ? <><h4>Évaluation officielle · test C-MAPSS</h4><div className="sf-ai-dataset-metrics">{Object.entries(model.metrics).map(([dataset, values]) => <div key={dataset}><strong>{dataset}</strong><span>MAE <b>{values.mae_cycles ?? '—'}</b> cycles</span><span>RMSE <b>{values.rmse_cycles ?? '—'}</b> cycles</span><span>Score NASA <b>{values.nasa_score ?? '—'}</b></span></div>)}</div><small>{model.details?.training_engines ?? '—'} moteurs d’entraînement · {model.details?.feature_count ?? '—'} variables d’entrée</small></> : model.id === 'cmapss-rul' ? <p className="sf-ai-model-empty">{model.detail || 'Modèle non entraîné : aucun artefact C-MAPSS disponible.'}</p> : model.state === 'ACTIF' ? <p className="sf-ai-model-empty">Calcul statistique actif sur les mesures valides de la machine sélectionnée. Ce n’est pas un modèle LSTM entraîné.</p> : <p className="sf-ai-model-empty">Aucune série temporelle industrielle annotée n’est configurée. Les métriques ne sont donc pas disponibles.</p>}</article>)}</div></section>}
    </main>
    {selectedAlert && <div className="sf-ai-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAlert(null) }}><section className="sf-ai-alert-modal" role="dialog" aria-modal="true" aria-labelledby="sf-ai-alert-title"><header><div><h2 id="sf-ai-alert-title">Alerte · {selectedAlert.machine}</h2><p>{selectedAlert.sensor} · {new Date(selectedAlert.timestamp).toLocaleString('fr-FR')}</p></div><button aria-label="Fermer" onClick={() => setSelectedAlert(null)}>×</button></header><dl><dt>Type</dt><dd>{selectedAlert.alert_type || 'Alerte capteur'}</dd><dt>Gravité</dt><dd>{selectedAlert.level || '—'}</dd><dt>Statut</dt><dd>{selectedAlert.status}</dd><dt>Valeur au déclenchement</dt><dd>{selectedAlert.value ?? '—'} {selectedAlert.unit}</dd><dt>Seuil franchi</dt><dd>{selectedAlert.threshold_value ?? '—'} {selectedAlert.unit}</dd><dt>Occurrences</dt><dd>{selectedAlert.occurrences ?? 1}</dd><dt>Score IA</dt><dd>{selectedAlert.score == null ? 'Non calculé (alerte fondée sur un seuil)' : Number(selectedAlert.score).toFixed(2)}</dd><dt>Origine</dt><dd>{selectedAlert.source}</dd><dt>Message</dt><dd>{selectedAlert.message || 'Aucun message supplémentaire.'}</dd></dl></section></div>}
  </Layout>
}
