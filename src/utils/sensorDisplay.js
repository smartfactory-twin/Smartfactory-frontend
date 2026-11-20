export function formatNullableThreshold(value) {
  if (value === null || value === undefined || value === '') return 'Non défini'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(value) : 'Non défini'
}

export function formatHealthIndicator(value) {
  if (value === null || value === undefined || value === '') return 'Non calculable'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric} %` : 'Non calculable'
}

export function getAiEligibilityReason(sensor = {}) {
  if (sensor.sensor_role === 'other') return 'Le rôle « other » n’est pas pris en charge par le modèle IA.'
  if (sensor.nominal_min == null || sensor.nominal_max == null) return 'Renseignez les deux bornes nominales.'
  if (Number(sensor.nominal_min) >= Number(sensor.nominal_max)) return 'La borne nominale minimum doit être inférieure à la borne maximum.'
  if (!sensor.is_ai_eligible) return 'Ce capteur n’a pas été activé pour l’IA.'
  return ''
}
