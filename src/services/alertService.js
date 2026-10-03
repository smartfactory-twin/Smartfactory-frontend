import api from './api'

/**
 * GET /alerts/  — liste des alertes actives
 * Backend non encore implémenté (Sprint 2+).
 */
export const getAlerts = async (params = {}) => {
  const { data } = await api.get('/alerts/', { params })
  return data
}
