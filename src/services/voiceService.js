import api from './api'

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

export async function sendVoiceAgentMessage(message, conversationId, interactionMode = 'text') {
  const { data } = await api.post('/voice/agent/', {
    message,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    interaction_mode: interactionMode,
  })
  return data
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
