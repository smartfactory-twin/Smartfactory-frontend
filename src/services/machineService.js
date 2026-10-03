import api from './api'

/**
 * GET /machines/  — liste des machines accessibles à l'utilisateur connecté
 * Backend non encore implémenté (Sprint 2+).
 */
export const getMachines = async (params = {}) => {
  const { data } = await api.get('/machines/', { params })
  return data
}

/**
 * GET /machines/:id/  — détail d'une machine
 */
export const getMachine = async (id) => {
  const { data } = await api.get(`/machines/${id}/`)
  return data
}
