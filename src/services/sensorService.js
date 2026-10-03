import api from './api'

/**
 * GET /sensors/  — liste des capteurs
 * GET /measurements/  — dernières mesures
 * Backend non encore implémenté (Sprint 2+).
 */
export const getSensors = async (params = {}) => {
  const { data } = await api.get('/sensors/', { params })
  return data
}

export const getMeasurements = async (params = {}) => {
  const { data } = await api.get('/measurements/', { params })
  return data
}
