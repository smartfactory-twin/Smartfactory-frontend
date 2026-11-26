import api from './api'

// Les OT et leurs rapports sont conservés par Django/PostgreSQL.
// Les erreurs API sont propagées à l'interface au lieu de créer une copie locale.
export async function getWorkOrders(params = {}) {
  const orders = []
  let page = 1
  while (page <= 100) {
    const { data } = await api.get('/equipements/ordres-travail/', { params: { ...params, page } })
    const results = data.results ?? data
    if (!Array.isArray(results)) return results
    orders.push(...results)
    if (!data.next || results.length === 0) break
    page += 1
  }
  return orders
}

export async function getWorkOrder(id) {
  const { data } = await api.get(`/equipements/ordres-travail/${id}/`)
  return data
}

export async function getAssignableTechnicians(machineId) {
  if (!machineId) return []
  const { data } = await api.get('/equipements/ordres-travail/assignables/', { params: { machine_id: machineId } })
  return data.results ?? []
}

export async function createWorkOrder(payload) {
  const { data } = await api.post('/equipements/ordres-travail/', payload)
  return data
}

export async function updateWorkOrder(id, payload) {
  const { data } = await api.patch(`/equipements/ordres-travail/${id}/`, payload)
  return data
}

export async function deleteWorkOrder(id) {
  return api.delete(`/equipements/ordres-travail/${id}/`)
}

export async function updateWorkOrderStatus(id, newStatus) {
  const { data } = await api.patch(`/equipements/ordres-travail/${id}/`, { statut: newStatus })
  return data
}

export async function submitReport(id, report) {
  const { data } = await api.post(`/equipements/ordres-travail/${id}/rapport/`, report)
  return data
}
