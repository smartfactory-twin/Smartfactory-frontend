export const DEFAULT_MAX_RECORDING_SECONDS = 120
export const MIN_RECORDING_MS = 500
export const MIN_AUDIO_BYTES = 1024

const RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2',
  'audio/webm', 'audio/ogg', 'audio/mp4',
]

export function selectRecordingMimeType(MediaRecorderClass = globalThis.MediaRecorder) {
  if (!MediaRecorderClass) return ''
  return RECORDING_MIME_TYPES.find((type) => MediaRecorderClass.isTypeSupported?.(type)) || ''
}

export function normalizeActionPhrase(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function getExplicitProposalAction(text, proposal, now = Date.now()) {
  if (!proposal || proposal.status !== 'pending' || !Number.isFinite(Date.parse(proposal.expires_at))) return null
  if (Date.parse(proposal.expires_at) <= now) return null
  const phrase = normalizeActionPhrase(text)
  if (phrase === 'confirme' || phrase === 'je confirme') return 'confirm'
  if (phrase === 'annule' || phrase === 'j annule') return 'cancel'
  return null
}

export function getRetryAfterMessage(error) {
  const value = error?.response?.headers?.['retry-after']
    ?? error?.response?.headers?.['Retry-After']
  if (!value) return ''
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return ` Réessayez dans ${Math.max(1, Math.ceil(seconds))} s.`
  const timestamp = Date.parse(value)
  if (Number.isFinite(timestamp)) {
    return ` Réessayez dans ${Math.max(1, Math.ceil((timestamp - Date.now()) / 1000))} s.`
  }
  return ''
}

export function getVoiceApiErrorMessage(error, action = 'agent') {
  const code = error?.response?.data?.code
  const status = error?.response?.status
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour continuer.'
  if (status === 403) return 'Votre rôle ne permet pas cette action.'
  if (status === 429) return `Trop de demandes rapprochées.${getRetryAfterMessage(error)}`
  if (status === 503 && action === 'transcription') return 'La transcription Whisper est indisponible. Essayez la reconnaissance du navigateur ou saisissez votre demande.'
  if (status === 503 || code === 'transcription_unavailable') return 'L’assistant IA est temporairement indisponible. Vous pouvez réessayer ou saisir une autre demande.'
  return error?.response?.data?.detail || 'Une erreur est survenue. Réessayez.'
}

export function isProposalExpired(proposal, now = Date.now()) {
  return !proposal || proposal.status !== 'pending' || !Number.isFinite(Date.parse(proposal.expires_at))
    || Date.parse(proposal.expires_at) <= now
}
