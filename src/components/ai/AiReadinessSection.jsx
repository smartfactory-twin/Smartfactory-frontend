import { useEffect, useState } from 'react'
import { getAiReadiness } from '../../services/aiPredictionService'

const ALLOWED_ROLES = ['ADMIN', 'TECHNICIEN']
const safeNumber = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)

export default function AiReadinessSection({ role }) {
  const allowed = ALLOWED_ROLES.includes(role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allowed) return
    let active = true
    setLoading(true)
    getAiReadiness().then((result) => { if (active) setData(result) })
      .catch((exception) => { if (active) setError(exception?.response?.data?.detail || 'Impossible de charger la disponibilité des données IA.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [allowed])

  if (!allowed) return null

  const criteria = data?.criteria || {}
  const machines = data?.machines || []
  const criteriaRows = [
    ['Historique minimum', criteria.min_history_days == null ? '—' : `${criteria.min_history_days} jours`],
    ['Mesures valides minimum', criteria.min_valid_measures ?? '—'],
    ['Taux de valeurs manquantes maximum', criteria.max_missing_rate_percent == null ? '—' : `${criteria.max_missing_rate_percent} %`],
  ]
  const missingRate = (value) => { const number = safeNumber(value); return number === null ? 'Non calculable' : `${number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %` }
  const history = (value) => { const number = safeNumber(value); return number === null ? 'Non calculable' : `${number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} jours` }

  return <section className="sf-ai-card sf-ai-readiness" aria-labelledby="ai-readiness-title">
    <header><h2 id="ai-readiness-title">Disponibilité des données pour l’IA</h2><span>État par machine</span></header>
    {loading ? <p role="status">Chargement de la disponibilité IA…</p> : error ? <p className="sf-ai-error" role="alert">{error}</p> : <>
      <div className="sf-ai-readiness-criteria"><strong>Critères de disponibilité</strong>{criteriaRows.map(([label, value]) => <span key={label}>{label} : <b>{value}</b></span>)}</div>
      <p className="sf-ai-method">Le taux de valeurs manquantes est estimé entre la première et la dernière mesure reçue.</p>
      {machines.length === 0 ? <p className="sf-ai-readiness-empty">Aucune machine n’est disponible pour évaluer la préparation IA.</p> : <div className="sf-ai-table-wrap"><table><thead><tr><th>Machine</th><th>Capteurs éligibles</th><th>Mesures valides</th><th>Historique</th><th>Valeurs manquantes</th><th>Statut</th><th>Blocages</th></tr></thead><tbody>
        {machines.map((machine) => <tr key={machine.machine_id}>
          <td>{machine.machine} <small>{machine.machine_identifiant}</small></td>
          <td>{machine.eligible_sensor_count ?? '—'}</td><td>{machine.valid_measure_count ?? '—'}</td><td>{history(machine.history_days)}</td><td>{missingRate(machine.missing_rate_percent)}</td>
          <td><span className={`sf-ai-state ${machine.ready_for_training ? 'state-actif' : 'state-non_entraine'}`}>{machine.ready_for_training || machine.status === 'ready' ? 'Prête' : 'Non prête'}</span></td>
          <td>{machine.blocking_reasons?.length ? <ul>{machine.blocking_reasons.map((reason, index) => <li key={`${machine.machine_id}-${index}`}>{reason}</li>)}</ul> : 'Aucun blocage signalé.'}</td>
        </tr>)}
      </tbody></table></div>}
    </>}
  </section>
}
