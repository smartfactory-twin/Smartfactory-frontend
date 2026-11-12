import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BrainCircuit, CheckCircle2, Clock3, Database, LoaderCircle, Upload, Wrench } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import { getPredictiveModelStatus, predictRemainingUsefulLife } from '../../services/predictiveMaintenanceService'

function readEngines(file) {
  return file.text().then((content) => {
    const engines = new Map()
    const rows = content.split(/\r?\n/).filter((line) => line.trim())
    for (let index = 0; index < rows.length; index += 1) {
      const values = rows[index].trim().split(/\s+/).map(Number)
      if (values.length !== 26 || values.some((value) => !Number.isFinite(value))) {
        throw new Error(`Ligne ${index + 1} invalide : 26 nombres sont attendus.`)
      }
      const [unit, cycle] = values
      if (!Number.isInteger(unit) || !Number.isInteger(cycle) || cycle < 1) {
        throw new Error(`Ligne ${index + 1} : identifiant moteur ou cycle invalide.`)
      }
      if (!engines.has(unit)) engines.set(unit, [])
      engines.get(unit).push({ cycle, features: values.slice(2) })
    }
    if (!engines.size) throw new Error('Le fichier ne contient aucune ligne C-MAPSS.')
    return [...engines.entries()].map(([unit, samples]) => ({
      unit,
      samples: samples.sort((a, b) => a.cycle - b.cycle),
    }))
  })
}

function Metric({ icon: Icon, label, value, note }) {
  return <div className="sf-rul-metric"><span className="sf-rul-metric-icon"><Icon /></span><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></div>
}

export default function PredictiveMaintenancePage() {
  const { user } = useAuthContext()
  const [modelStatus, setModelStatus] = useState(null)
  const [engines, setEngines] = useState([])
  const [selectedUnit, setSelectedUnit] = useState('')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [loadingModel, setLoadingModel] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPredictiveModelStatus()
      .then(setModelStatus)
      .catch(() => setModelStatus({ ready: false, detail: 'API de maintenance prédictive indisponible.' }))
      .finally(() => setLoadingModel(false))
  }, [])

  const selectedEngine = useMemo(
    () => engines.find((engine) => String(engine.unit) === String(selectedUnit)),
    [engines, selectedUnit],
  )

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    setResult(null)
    setError('')
    setEngines([])
    setSelectedUnit('')
    setFileName(file?.name || '')
    if (!file) return
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Le fichier doit faire moins de 20 Mo.')
      const nextEngines = await readEngines(file)
      setEngines(nextEngines)
      setSelectedUnit(String(nextEngines[0].unit))
    } catch (exception) {
      setError(exception.message || 'Impossible de lire ce fichier C-MAPSS.')
    }
  }

  const runPrediction = async () => {
    if (!selectedEngine) return
    setPredicting(true)
    setError('')
    try {
      const samples = selectedEngine.samples.slice(-30)
      const response = await predictRemainingUsefulLife({
        cycle: samples.at(-1).cycle,
        history: samples.map((sample) => sample.features),
      })
      setResult({ ...response, unit: selectedEngine.unit })
    } catch (exception) {
      setError(exception.response?.data?.detail || 'L’estimation a échoué. Vérifie que le modèle est entraîné et disponible.')
    } finally {
      setPredicting(false)
    }
  }

  const statusLabel = result?.health_state === 'CRITIQUE' ? 'Critique' : result?.health_state === 'DEGRADE' ? 'Dégradé' : 'Normal'
  const testScores = modelStatus?.metadata?.official_test || {}
  const Layout = user?.role === 'ADMIN' ? AdminLayout : user?.role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout pageTitle="Maintenance prédictive">
      <main className="sf-rul-page">
        <header className="sf-rul-heading">
          <div><span className="sf-rul-eyebrow">INTELLIGENCE ARTIFICIELLE · RUL</span><h1>Maintenance prédictive</h1><p>Estimation de la durée de vie restante à partir de séries de capteurs.</p></div>
          <span className={`sf-rul-model-pill${modelStatus?.ready ? ' is-ready' : ''}`}><BrainCircuit />{loadingModel ? 'Vérification du modèle' : modelStatus?.ready ? 'Modèle entraîné disponible' : 'Modèle à entraîner'}</span>
        </header>

        <section className="sf-rul-notice">
          <AlertTriangle />
          <p><b>Portée du modèle :</b> entraîné sur NASA C-MAPSS, un simulateur de moteurs turbofan avec 21 voies capteurs. Ce jeu n’est pas une mesure réelle d’usine. Les capteurs actuels de SmartFactory ne sont pas automatiquement compatibles; cette page sert à analyser les fichiers C-MAPSS.</p>
        </section>

        <section className="sf-rul-grid">
          <article className="sf-rul-card sf-rul-upload-card">
            <div className="sf-rul-card-title"><Database /><div><h2>Charger une série de test</h2><p>Choisis un fichier test_FD00x.txt depuis le dossier CMAPSSData.</p></div></div>
            <label className="sf-rul-dropzone">
              <input type="file" accept=".txt,text/plain" onChange={onFile} />
              <Upload />
              <strong>{fileName || 'Sélectionner un fichier C-MAPSS'}</strong>
              <span>Format standard NASA · 26 colonnes · max. 20 Mo</span>
            </label>
            {engines.length > 0 && <label className="sf-rul-select-label">Moteur du fichier<select value={selectedUnit} onChange={(event) => { setSelectedUnit(event.target.value); setResult(null) }}>{engines.map((engine) => <option key={engine.unit} value={engine.unit}>Moteur {engine.unit} · cycle {engine.samples.at(-1).cycle}</option>)}</select></label>}
            <button className="sf-rul-primary" disabled={!selectedEngine || !modelStatus?.ready || predicting} onClick={runPrediction}>
              {predicting ? <LoaderCircle className="sf-rul-spin" /> : <BrainCircuit />}
              {predicting ? 'Calcul en cours…' : 'Estimer la durée de vie'}
            </button>
            {error && <p className="sf-rul-error" role="alert">{error}</p>}
            {!modelStatus?.ready && !loadingModel && <p className="sf-rul-help">{modelStatus?.detail || 'Entraîne d’abord le modèle avec ml/train_cmapss.py.'}</p>}
          </article>

          <article className="sf-rul-card sf-rul-result-card">
            <div className="sf-rul-card-title"><Clock3 /><div><h2>Résultat de l’estimation</h2><p>Une estimation pour le dernier cycle du moteur sélectionné.</p></div></div>
            {result ? <div className="sf-rul-result">
              <span className="sf-rul-result-label">DURÉE DE VIE RESTANTE · MOTEUR {result.unit}</span>
              <strong>{result.predicted_rul_cycles}<small> cycles</small></strong>
              <span className={`sf-rul-state state-${result.health_state.toLowerCase()}`}>{result.health_state === 'CRITIQUE' ? <AlertTriangle /> : <CheckCircle2 />}{statusLabel}</span>
              <p>Cycle analysé : {result.cycle}. Le statut est un repère simple dérivé de la RUL prédite, pas une classe apprise séparément.</p>
            </div> : <div className="sf-rul-empty"><Wrench /><span>Charge un fichier de test et lance l’estimation pour afficher les cycles restants.</span></div>}
          </article>
        </section>

        <section className="sf-rul-card sf-rul-evaluation">
          <div className="sf-rul-card-title"><CheckCircle2 /><div><h2>Évaluation sur les moteurs de test NASA</h2><p>MAE calculée sur la RUL plafonnée à 125 cycles; le rapport complet est généré lors de l’entraînement.</p></div></div>
          {Object.keys(testScores).length ? <div className="sf-rul-score-grid">{Object.entries(testScores).map(([dataset, metrics]) => <div key={dataset}><b>{dataset}</b><strong>{metrics.mae_cycles} cycles</strong><span>MAE · {metrics.engines} moteurs</span></div>)}</div> : <p className="sf-rul-help">{modelStatus?.ready ? 'Les métriques seront visibles ici après nouvel entraînement avec le rapport.' : 'Aucun rapport chargé. Les scores seront affichés ici après l’entraînement du modèle.'}</p>}
        </section>
      </main>
    </Layout>
  )
}
