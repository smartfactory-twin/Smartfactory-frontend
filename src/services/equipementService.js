import api from './api'

// ── Usines ────────────────────────────────────────────────────────────────────
export const getUsines    = (p = {}) => api.get('/equipements/usines/',       { params: p }).then(r => r.data)
export const getUsine     = (id)     => api.get(`/equipements/usines/${id}/`).then(r => r.data)
export const createUsine  = (data)   => api.post('/equipements/usines/',       data).then(r => r.data)
export const updateUsine  = (id, d)  => api.patch(`/equipements/usines/${id}/`, d).then(r => r.data)
export const deleteUsine  = (id)     => api.delete(`/equipements/usines/${id}/`)
export const getUsineHierarchie = (id) => api.get(`/equipements/usines/${id}/hierarchie/`).then(r => r.data)

// ── Zones ─────────────────────────────────────────────────────────────────────
export const getZones    = (p = {}) => api.get('/equipements/zones/',       { params: p }).then(r => r.data)
export const getZone     = (id)     => api.get(`/equipements/zones/${id}/`).then(r => r.data)
export const createZone  = (data)   => api.post('/equipements/zones/',       data).then(r => r.data)
export const updateZone  = (id, d)  => api.patch(`/equipements/zones/${id}/`, d).then(r => r.data)
export const deleteZone  = (id)     => api.delete(`/equipements/zones/${id}/`)

// ── Lignes de production ──────────────────────────────────────────────────────
export const getLignes    = (p = {}) => api.get('/equipements/lignes/',       { params: p }).then(r => r.data)
export const getLigne     = (id)     => api.get(`/equipements/lignes/${id}/`).then(r => r.data)
export const createLigne  = (data)   => api.post('/equipements/lignes/',       data).then(r => r.data)
export const updateLigne  = (id, d)  => api.patch(`/equipements/lignes/${id}/`, d).then(r => r.data)
export const deleteLigne  = (id)     => api.delete(`/equipements/lignes/${id}/`)

// ── Composants ────────────────────────────────────────────────────────────────
export const getComposants       = (p = {}) => api.get('/equipements/composants/',          { params: p }).then(r => r.data)
export const createComposant     = (data)   => api.post('/equipements/composants/',          data).then(r => r.data)
export const updateComposant     = (id, d)  => api.patch(`/equipements/composants/${id}/`,  d).then(r => r.data)
export const deleteComposant     = (id)     => api.delete(`/equipements/composants/${id}/`)
// Inline via machine
export const getMachineComposants  = (machineId) => api.get(`/equipements/machines/${machineId}/composants/`).then(r => r.data)
export const addMachineComposant   = (machineId, data) => api.post(`/equipements/machines/${machineId}/composants/add/`, data).then(r => r.data)

// ── Hiérarchie CSV Import / Export ────────────────────────────────────────────
export const exportHierarchyCsv = async () => {
  const response = await api.get('/equipements/hierarchie/export_csv/', {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'smartfactory_hierarchie.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
  return response.data
}

export const previewHierarchyCsv = (formData) => {
  return api.post('/equipements/hierarchie/preview_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const importHierarchyCsv = (formData) => {
  return api.post('/equipements/hierarchie/import_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

