// Statuts machine définis par la spécification SmartFactory Twin
const MACHINE_STATUS = {
  NORMAL:     { label: 'Normal',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  DEGRADE:    { label: 'Dégradé',   bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  CRITIQUE:   { label: 'Critique',  bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  HORS_LIGNE: { label: 'Hors ligne',bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
}

// Niveaux d'alerte définis par la spécification
const ALERT_SEVERITY = {
  INFO:         { label: 'Info',         bg: 'bg-blue-100',   text: 'text-blue-700' },
  AVERTISSEMENT:{ label: 'Avertissement',bg: 'bg-orange-100', text: 'text-orange-700' },
  CRITIQUE:     { label: 'Critique',     bg: 'bg-red-100',    text: 'text-red-700' },
}

export function MachineStatusBadge({ status }) {
  const cfg = MACHINE_STATUS[status] ?? MACHINE_STATUS.HORS_LIGNE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export function AlertSeverityBadge({ severity }) {
  const cfg = ALERT_SEVERITY[severity] ?? ALERT_SEVERITY.INFO
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ── Module 4 — statuts d'analyse d'une inspection visuelle ────────────────────
const INSPECTION_STATUS = {
  EN_ATTENTE: { label: 'En attente', bg: 'bg-gray-100',   text: 'text-gray-600' },
  EN_ANALYSE: { label: 'En analyse', bg: 'bg-blue-100',   text: 'text-blue-700' },
  TERMINEE:   { label: 'Terminée',   bg: 'bg-green-100',  text: 'text-green-700' },
  ERREUR:     { label: 'Erreur',     bg: 'bg-red-100',    text: 'text-red-700' },
}

export function InspectionStatusBadge({ status }) {
  const cfg = INSPECTION_STATUS[status] ?? INSPECTION_STATUS.EN_ATTENTE
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}
