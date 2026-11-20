import api from './api'

export async function getVoiceCommandHistory() {
  const { data } = await api.get('/auth/vocal/commands/')
  return data
}

export async function saveVoiceCommand(command) {
  const { data } = await api.post('/auth/vocal/commands/', command)
  return data
}
