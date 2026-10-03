import { X, MapPin } from 'lucide-react'
import { InspectionStatusBadge } from '../common/StatusBadge'
import { formatDate } from './InspectionResultCard'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{children || '—'}</p>
    </div>
  )
}

/**
 * Détail complet d'une inspection (image + informations + résultat).
 */
export default function InspectionDetailModal({ inspection, onClose, onViewImage }) {
  if (!inspection) return null

  const result = inspection.resultat_analyse
  const confidence = inspection.score_confiance ?? result?.confidence
  const pct = confidence != null ? Math.round(confidence * 100) : null

  return (
    <div
      data-testid="inspection-detail-modal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Inspection #{inspection.id}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {inspection.image && (
            <img
              src={inspection.image}
              alt={`Inspection ${inspection.id}`}
              onClick={() => onViewImage?.(inspection)}
              className="max-h-64 w-full cursor-zoom-in rounded-lg border border-gray-200 bg-gray-50 object-contain"
            />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Machine">{inspection.machine_nom}</Field>
            <Field label="Identifiant">{inspection.machine_identifiant}</Field>
            <Field label="Ligne">{inspection.ligne_nom}</Field>
            <Field label="Utilisateur">{inspection.utilisateur_nom}</Field>
            <Field label="Date">{formatDate(inspection.date_inspection)}</Field>
            <div>
              <p className="text-xs text-gray-500 mb-1">Statut</p>
              <InspectionStatusBadge status={inspection.statut_analyse} />
            </div>
          </div>

          {inspection.statut_analyse === 'ERREUR' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {inspection.erreur_message || "L'analyse a échoué."}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Résultat de l'analyse IA</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Défaut détecté">
                  <span className={result.defect_detected ? 'text-red-600' : 'text-green-600'}>
                    {result.defect_detected ? 'Oui' : 'Non'}
                  </span>
                </Field>
                <Field label="Type de défaut">{result.defect_type || 'Aucun'}</Field>
                <Field label="Score de confiance">{pct != null ? `${pct} %` : '—'}</Field>
                <Field label="Localisation">
                  {result.localization
                    ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{result.localization}</span>
                    : '—'}
                </Field>
              </div>
              <div>
                <p className="text-xs text-gray-500">Observation</p>
                <p className="text-sm text-gray-800">{result.comment || '—'}</p>
              </div>
            </div>
          )}

          {inspection.observations && (
            <div>
              <p className="text-xs text-gray-500">Observations de l'utilisateur</p>
              <p className="text-sm text-gray-800">{inspection.observations}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
