import { Eye, Image as ImageIcon, Trash2, Pencil } from 'lucide-react'
import Spinner from '../common/Spinner'
import Alert from '../common/Alert'
import { InspectionStatusBadge } from '../common/StatusBadge'
import { formatDate } from './InspectionResultCard'

const formatConfidence = (value) =>
  value != null ? `${Math.round(value * 100)} %` : '—'

/**
 * Historique des inspections : Date, Machine, Utilisateur, Image, Résultat,
 * Confiance, Statut, Actions.
 */
export default function InspectionHistoryTable({
  inspections = [],
  loading = false,
  error = null,
  onView,
  onViewImage,
  onDelete,
  canDelete = false,
  onAnnotate,
  onCompareBefore,
  onCompareAfter,
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message={error} />
  }

  if (!inspections.length) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Aucune inspection enregistrée.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Machine', 'Utilisateur', 'Image', 'Résultat', 'Confiance', 'Statut', 'Actions'].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    h === 'Actions' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inspections.map((insp) => {
              const result = insp.resultat_analyse
              const detecte = insp.defect_detected ?? result?.defect_detected
              const defectType = insp.defect_type || result?.defect_type
              return (
                <tr key={insp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(insp.date_inspection)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{insp.machine_nom}</div>
                    <div className="text-xs text-gray-500 font-mono">{insp.machine_identifiant}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {insp.utilisateur_nom || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {insp.image && insp.media_type !== 'VIDEO' ? (
                      <button
                        type="button"
                        onClick={() => onViewImage?.(insp)}
                        title="Voir l'image"
                        className="block"
                      >
                        <img
                          src={insp.image_annotee || insp.image}
                          alt={`Inspection ${insp.id}`}
                          className="sf-inspection-history-thumb"
                        />
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {insp.statut_analyse === 'TERMINEE' ? (
                      detecte ? (
                        <span className="font-medium text-red-600">
                          {defectType || 'Défaut détecté'}
                        </span>
                      ) : (
                        <span className="font-medium text-green-600">Aucun défaut</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {formatConfidence(insp.confidence ?? insp.score_confiance)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <InspectionStatusBadge status={insp.statut_analyse} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      type="button"
                      onClick={() => onView?.(insp)}
                      title="Voir"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Eye className="h-4 w-4 inline" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewImage?.(insp)}
                      title="Voir l'image"
                      disabled={!insp.image || insp.media_type === 'VIDEO'}
                      className="text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    >
                      <ImageIcon className="h-4 w-4 inline" />
                    </button>
                    {onAnnotate && canDelete && insp.media_type !== 'VIDEO' && insp.image && <button type="button" onClick={() => onAnnotate(insp)} title="Annoter la photo" className="text-amber-500 hover:text-amber-700"><Pencil className="h-4 w-4 inline" /></button>}
                    {onCompareBefore && onCompareAfter && insp.media_type !== 'VIDEO' && insp.image && <>
                      <button type="button" onClick={() => onCompareBefore(insp)} title="Utiliser comme photo avant" className="sf-inspection-compare-action">Avant</button>
                      <button type="button" onClick={() => onCompareAfter(insp)} title="Utiliser comme photo après" className="sf-inspection-compare-action">Après</button>
                    </>}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete?.(insp)}
                        title="Supprimer"
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
