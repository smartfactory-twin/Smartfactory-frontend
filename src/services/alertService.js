/**
 * alertService.js
 * Module 3 — non encore implémenté côté backend.
 * Retourne des données vides pour éviter les 404 en console.
 */

export const getAlerts = async (params = {}) => {
  // TODO Module 3 : return api.get('/alerts/', { params }).then(r => r.data)
  return { results: [], count: 0 }
}

export const getAlert = async (id) => null

export const acknowledgeAlert = async (id) => null
