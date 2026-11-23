import api from './api'
import { flushSseFrame, parseSseFrames } from '../pages/vocal/realtimeVoiceUtils'

function makeVoiceHttpError(status, data = {}, headers = {}) {
  const error = new Error(data?.detail || data?.code || 'Requête vocale refusée.')
  error.response = { status, data, headers }
  return error
}

function getStreamUrl() {
  return `${String(api.defaults.baseURL || '/api').replace(/\/$/, '')}/voice/agent/stream/`
}

export async function getVoiceCommandHistory() {
  const { data } = await api.get('/auth/vocal/commands/')
  return data
}

export async function saveVoiceCommand(command) {
  const { data } = await api.post('/auth/vocal/commands/', command)
  return data
}

export async function transcribeVoiceAudio(audioBlob) {
  const extension = audioBlob.type.includes('ogg') ? 'ogg'
    : audioBlob.type.includes('wav') ? 'wav'
      : audioBlob.type.includes('mp4') ? 'm4a'
        : audioBlob.type.includes('mpeg') ? 'mp3' : 'webm'
  const form = new FormData()
  form.append('audio', audioBlob, `commande.${extension}`)
  const { data } = await api.post('/voice/transcribe/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getVoiceSessionConfig() {
  const { data } = await api.get('/voice/session/config/')
  return data
}

export async function transcribeVoiceSessionAudio(audioBlob, { signal } = {}) {
  const extension = audioBlob.type.includes('ogg') ? 'ogg'
    : audioBlob.type.includes('wav') ? 'wav'
      : audioBlob.type.includes('mp4') ? 'm4a'
        : audioBlob.type.includes('mpeg') ? 'mp3' : 'webm'
  const form = new FormData()
  form.append('audio', audioBlob, `conversation.${extension}`)
  const { data } = await api.post('/voice/session/transcribe/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  })
  return data
}

export async function sendVoiceAgentMessage(message, conversationId, interactionMode = 'text') {
  const { data } = await api.post('/voice/agent/', {
    message,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    interaction_mode: interactionMode,
  })
  return data
}

export async function streamVoiceAgentMessage(message, conversationId, {
  signal, onTool = () => {}, onSentence = () => {}, onProposal = () => {}, onDownload = () => {}, onDone = () => {},
} = {}) {
  const token = localStorage.getItem('sf_access')
  const response = await fetch(getStreamUrl(), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      interaction_mode: 'voice',
    }),
  })
  if (!response.ok) {
    let data = {}
    try { data = await response.json() } catch { /* Certaines erreurs réseau n’ont pas de corps JSON. */ }
    throw makeVoiceHttpError(response.status, data, response.headers)
  }
  if (!response.body?.getReader) throw new Error('Le navigateur ne prend pas en charge la lecture du flux SSE.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let parserState = { eventName: 'message', data: [] }
  let result = null
  let generatedDownload = null
  const handleEvent = (event) => {
    let data
    try { data = JSON.parse(event.data) } catch { throw new Error('Un événement du flux vocal est invalide.') }
    if (event.event === 'tool') onTool(data.name)
    else if (event.event === 'sentence') onSentence(data.speech)
    else if (event.event === 'proposal') onProposal(data)
    else if (event.event === 'download') generatedDownload = data
    else if (event.event === 'done') {
      result = data
      onDone(data)
    } else if (event.event === 'error') {
      throw makeVoiceHttpError(503, { code: data.code || 'stream_failed' })
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      const decoded = decoder.decode(value || new Uint8Array(), { stream: !done })
      const parsed = parseSseFrames(buffer, decoded, parserState)
      buffer = parsed.remainder
      parserState = parsed.state
      parsed.events.forEach(handleEvent)
      if (done) {
        flushSseFrame({ state: parserState, remainder: buffer }).forEach(handleEvent)
        break
      }
    }
  } finally {
    reader.releaseLock?.()
  }
  if (!result) throw new Error('Le flux vocal s’est interrompu avant la réponse finale.')
  if (generatedDownload) onDownload(generatedDownload)
  return result
}

export async function getPendingVoiceProposals() {
  const { data } = await api.get('/voice/proposals/pending/')
  return data
}

export async function confirmVoiceProposal(proposalId) {
  const { data } = await api.post(`/voice/proposals/${encodeURIComponent(proposalId)}/confirm/`, {})
  return data
}

export async function cancelVoiceProposal(proposalId) {
  const { data } = await api.post(`/voice/proposals/${encodeURIComponent(proposalId)}/cancel/`, {})
  return data
}
