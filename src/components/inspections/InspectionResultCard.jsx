import { CheckCircle2, AlertTriangle, MapPin, Calendar, Wrench } from 'lucide-react'
import { InspectionStatusBadge } from '../common/StatusBadge'

export function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return value
  }
}

/**
 * Carte de résultat d'analyse : défaut détecté, type, score, observation,
 * date et machine inspectée.
 */
export default function InspectionResultCard({ inspection }) {
  if (!inspection) return null

  const result = inspection.resultat_analyse
  const detected = result?.defect_detected
  const confidence = inspection.score_confiance ?? result?.confidence
  const pct = confidence != null ? Math.round(confidence * 100) : null
  const erreur = inspection.statut_analyse === 'ERREUR'

  return (
    <div className="card p-5 space-y-4" data-testid="inspection-result-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Résultat de l'analyse</h3>
        <InspectionStatusBadge status={inspection.statut_analyse} />
      </div>

      {erreur && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {inspection.erreur_message || "L'analyse a échoué."}
        </div>
      )}

      {result && (
        <>
          <div className={`flex items-center gap-3 rounded-lg border p-4 ${
            detected ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
          }`}>
            {detected
              ? <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
              : <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />}
            <div>
              <p className="text-sm text-gray-500">Défaut détecté</p>
              <p className={`text-lg font-bold ${detected ? 'text-red-700' : 'text-green-700'}`}>
                {detected ? 'Oui' : 'Non'}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Type de défaut</dt>
              <dd className="font-medium text-gray-900">{result.defect_type || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Localisation</dt>
              <dd className="font-medium text-gray-900 flex items-center gap-1">
                {result.localization
                  ? <><MapPin className="h-3.5 w-3.5" /> {result.localization}</>
                  : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Score de confiance</dt>
              <dd className="font-medium text-gray-900">
                {pct != null ? `${pct} %` : '—'}
                {pct != null && (
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full ${pct >= 70 ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Observation</dt>
              <dd className="text-gray-800">{result.comment || inspection.observations || '—'}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Wrench className="h-4 w-4 flex-shrink-0" />
          {inspection.machine_nom} ({inspection.machine_identifiant})
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          {formatDate(inspection.date_inspection)}
        </div>
      </div>
    </div>
  )
}
