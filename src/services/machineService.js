import api from './api'

export const getMachines       = (params = {}) => api.get('/equipements/machines/', { params }).then(r => r.data)
export const getMachine        = (id)          => api.get(`/equipements/machines/${id}/`).then(r => r.data)
export const createMachine     = (formData)    => api.post('/equipements/machines/', formData, { headers: { 'Content-Type': undefined } }).then(r => r.data)
export const updateMachine     = (id, data)    => {
  // Accepte un objet JSON ou un FormData (pour joindre/modifier la photo).
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData
  return api.patch(`/equipements/machines/${id}/`, data, {
    headers: isFormData ? { 'Content-Type': undefined } : undefined,
  }).then(r => r.data)
}
export const deleteMachine     = (id)          => api.delete(`/equipements/machines/${id}/`)
export const importMachinesCSV = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  // Ne pas passer Content-Type manuellement : Axios le génère avec le bon boundary pour multipart
  return api.post('/equipements/machines/import_csv/', fd, {
    headers: { 'Content-Type': undefined },
  }).then(r => r.data)
}
export const uploadDocument    = (id, fd)      => api.post(`/equipements/machines/${id}/upload_document/`, fd, { headers: { 'Content-Type': undefined } }).then(r => r.data)
export const getUsines         = (params = {}) => api.get('/equipements/usines/', { params }).then(r => r.data)
export const getZones          = (params = {}) => api.get('/equipements/zones/', { params }).then(r => r.data)
export const getLignes         = (params = {}) => api.get('/equipements/lignes/', { params }).then(r => r.data)
export const getComposants     = (params = {}) => api.get('/equipements/composants/', { params }).then(r => r.data)
