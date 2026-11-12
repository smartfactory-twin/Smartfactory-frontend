import api from './api'

// Les OT et leurs rapports sont conservés par Django/PostgreSQL.
// Les erreurs API sont propagées à l'interface au lieu de créer une copie locale.
export async function getWorkOrders(params = {}) {
  const { data } = await api.get('/equipements/ordres-travail/', { params })
  return data.results ?? data
}

export async function getWorkOrder(id) {
  const { data } = await api.get(`/equipements/ordres-travail/${id}/`)
  return data
}

export async function createWorkOrder(payload) {
  const { data } = await api.post('/equipements/ordres-travail/', payload)
  return data
}

export async function updateWorkOrderStatus(id, newStatus) {
  const { data } = await api.patch(`/equipements/ordres-travail/${id}/`, { statut: newStatus })
  return data
}

export async function submitReport(id, report) {
  const { data } = await api.post(`/equipements/ordres-travail/${id}/rapport/`, report)
  return data
}

export async function getRecurring() {
  const { data } = await api.get('/equipements/maintenances-recurrentes/')
  return data.results ?? data
}

export async function addRecurring(entry) {
  const { data } = await api.post('/equipements/maintenances-recurrentes/', entry)
  return data
}
