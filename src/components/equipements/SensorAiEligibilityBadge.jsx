import { getAiEligibilityReason } from '../../utils/sensorDisplay'

export default function SensorAiEligibilityBadge({ sensor, showReason = false }) {
  const reason = getAiEligibilityReason(sensor)
  const eligible = Boolean(sensor?.is_ai_eligible && !reason)
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        title={reason || 'Ce capteur est configuré pour le modèle IA.'}
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
      >
        {eligible ? 'Éligible IA' : 'Non éligible'}
      </span>
      {showReason && reason && <small className="max-w-xs text-xs text-gray-500">{reason}</small>}
    </span>
  )
}
