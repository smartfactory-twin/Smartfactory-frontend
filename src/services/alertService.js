import api from './api'

export const getAlerts = async (params = {}) => {
  const { data } = await api.get('/alertes/', { params })
  return data
}

export const getAlert = async (id) => {
  const { data } = await api.get(`/alertes/${id}/`)
  return data
}

export const acknowledgeAlert = async (id, commentaire) => {
  const { data } = await api.post(`/alertes/${id}/acquitter/`, { commentaire })
  return data
}

export const prepareOtFromAlert = async (id) => {
  const { data } = await api.post(`/alertes/${id}/preparer-ot/`)
  return data
}

export const getAlertStats = async (params = {}) => {
  const { data } = await api.get('/alertes/statistiques/', { params })
  return data
}

export const getAlertCounter = async () => {
  const { data } = await api.get('/alertes/compteur/')
  return data
}
