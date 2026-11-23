import { getExplicitProposalAction, normalizeActionPhrase } from './voiceAssistantUtils'

export const REALTIME_VOICE_LIMITS = Object.freeze({
  speechThreshold: 0.035,
  interruptionThreshold: 0.4,
  silenceMs: 900,
  minimumSpeechMs: 450,
  minimumAudioBytes: 1200,
  prolongedSilenceMs: 60_000,
  speechChunkChars: 220,
})

export const WHISPER_SILENCE_HALLUCINATIONS = Object.freeze([
  'merci',
  'merci de votre attention',
  'merci d avoir regarde cette video',
  'sous titres realises par la communaute',
  'sous titrage realise par la communaute',
  'abonnez vous',
])

export function isSpeechSynthesisAvailable(targetWindow = globalThis.window) {
  return Boolean(targetWindow?.speechSynthesis && targetWindow?.SpeechSynthesisUtterance)
}

export function calculateRms(timeDomainSamples) {
  if (!timeDomainSamples?.length) return 0
  let squares = 0
  for (const sample of timeDomainSamples) {
    const normalized = (Number(sample) - 128) / 128
    squares += normalized * normalized
  }
  return Math.sqrt(squares / timeDomainSamples.length)
}

export function createVadState() {
  return { startedAt: null, lastSpeechAt: null }
}

export function observeVad(state, level, now, {
  speechThreshold = REALTIME_VOICE_LIMITS.speechThreshold,
  silenceMs = REALTIME_VOICE_LIMITS.silenceMs,
} = {}) {
  if (level >= speechThreshold) {
    const started = state.startedAt == null
    if (started) state.startedAt = now
    state.lastSpeechAt = now
    return started ? 'start' : null
  }
  if (state.startedAt != null && state.lastSpeechAt != null && now - state.lastSpeechAt >= silenceMs) {
    const durationMs = state.lastSpeechAt - state.startedAt
    state.startedAt = null
    state.lastSpeechAt = null
    return { type: 'finish', durationMs }
  }
  return null
}

export function isUsableAudioSegment(durationMs, byteLength, limits = REALTIME_VOICE_LIMITS) {
  return durationMs >= limits.minimumSpeechMs && byteLength >= limits.minimumAudioBytes
}

export function isIgnorableTranscript(value, hallucinations = WHISPER_SILENCE_HALLUCINATIONS) {
  const transcript = String(value || '').trim()
  if (!transcript || /^[\p{P}\p{S}\s]+$/u.test(transcript)) return true
  const normalized = normalizeActionPhrase(transcript)
  return !normalized || hallucinations.some((phrase) => normalizeActionPhrase(phrase) === normalized)
}

export function classifyRealtimeTranscript(text, proposal, now = Date.now(), hallucinations = WHISPER_SILENCE_HALLUCINATIONS) {
  if (isIgnorableTranscript(text, hallucinations)) return 'ignore'
  if (proposal?.status === 'pending') {
    const action = getExplicitProposalAction(text, proposal, now)
    if (action) return action
    const normalized = normalizeActionPhrase(text)
    const confirmationTerms = ['confirme', 'confirmation', 'annule', 'annulation', 'oui', 'yes']
    const looksLikeConfirmation = confirmationTerms.some((term) => normalized.split(' ').includes(term))
    if (looksLikeConfirmation) return 'ignore'
  }
  return 'agent'
}

export function parseSseFrames(buffer, chunk, previousState = {}) {
  const input = `${buffer || ''}${chunk || ''}`
  const lines = input.split(/\r\n|\n|\r/)
  const remainder = lines.pop() ?? ''
  const events = []
  let eventName = previousState.eventName || 'message'
  let data = Array.isArray(previousState.data) ? [...previousState.data] : []
  const dispatch = () => {
    if (data.length) events.push({ event: eventName, data: data.join('\n') })
    eventName = 'message'
    data = []
  }
  for (const line of lines) {
    if (!line) { dispatch(); continue }
    if (line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') eventName = value || 'message'
    if (field === 'data') data.push(value)
  }
  return { events, remainder, state: { eventName, data } }
}

export function flushSseFrame(parser) {
  const state = { ...(parser?.state || parser), data: [...((parser?.state || parser)?.data || [])] }
  const remainder = String(parser?.remainder || '')
  if (remainder && !remainder.startsWith(':')) {
    const separator = remainder.indexOf(':')
    const field = separator < 0 ? remainder : remainder.slice(0, separator)
    const value = separator < 0 ? '' : remainder.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') state.eventName = value || 'message'
    if (field === 'data') state.data.push(value)
  }
  if (!state?.data?.length) return []
  return [{ event: state.eventName || 'message', data: state.data.join('\n') }]
}

export function splitSpeechIntoShortChunks(value, maxChars = REALTIME_VOICE_LIMITS.speechChunkChars) {
  const text = String(value || '').trim()
  if (!text) return []
  const chunks = []
  for (const sentence of text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [text]) {
    let remaining = sentence.trim()
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf(' ', maxChars)
      if (cut < maxChars * 0.55) cut = maxChars
      chunks.push(remaining.slice(0, cut).trim())
      remaining = remaining.slice(cut).trim()
    }
    if (remaining) chunks.push(remaining)
  }
  return chunks
}

export function createSpeechQueue({ synthesis, Utterance, onStart = () => {}, onEnd = () => {} }) {
  const queue = []
  let current = null
  let stopped = false
  let endTimer = null
  const playNext = () => {
    if (stopped || current || !queue.length) {
      if (!current && !queue.length) onEnd()
      return
    }
    const text = queue.shift()
    const utterance = new Utterance(text)
    utterance.lang = 'fr-FR'
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.volume = 1
    // Voices may load asynchronously in Chromium, so resolve one for each utterance.
    const voices = synthesis?.getVoices?.() || []
    const frenchVoices = voices.filter((voice) => /^fr(?:-|$)/i.test(voice.lang || ''))
    const frenchVoice = frenchVoices.find((voice) => /^fr-FR$/i.test(voice.lang || ''))
      || frenchVoices.find((voice) => /natural|google|microsoft|denise|julie|hortense|amelie/i.test(voice.name || ''))
      || frenchVoices[0]
    if (frenchVoice) utterance.voice = frenchVoice
    utterance.onstart = () => {
      onStart(text)
      if (endTimer) clearTimeout(endTimer)
      // Chrome can occasionally omit both end and error for a long utterance.
      endTimer = setTimeout(() => { current = null; playNext() }, Math.max(8000, text.length * 180))
    }
    const finish = () => {
      if (endTimer) clearTimeout(endTimer)
      endTimer = null
      current = null
      playNext()
    }
    utterance.onend = finish
    utterance.onerror = finish
    current = utterance
    synthesis.speak(utterance)
  }

  return {
    enqueue(text) {
      stopped = false
      queue.push(...splitSpeechIntoShortChunks(text))
      playNext()
    },
    clear() {
      queue.length = 0
      if (endTimer) clearTimeout(endTimer)
      endTimer = null
      current = null
      stopped = true
      synthesis?.cancel?.()
      onEnd()
    },
    get pendingCount() { return queue.length + (current ? 1 : 0) },
  }
}
