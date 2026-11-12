import api from './api'

// ── Inspections visuelles (Module 4 — UC-10) ──────────────────────────────────
// Endpoints canoniques : /api/inspections/ (alias de /api/equipements/inspections/)

export const getInspections = (params = {}) =>
  api.get('/equipements/inspections/', { params }).then(r => r.data)

export const getInspection = (id) =>
  api.get(`/equipements/inspections/${id}/`).then(r => r.data)

// Création : machine + image (multipart/form-data).
export const createInspection = (formData, onUploadProgress) =>
  api.post('/equipements/inspections/', formData, {
    headers: { 'Content-Type': undefined },
    onUploadProgress,
  }).then(r => r.data)

// Lance l'analyse IA d'une inspection existante.
export const analyzeInspection = (id) =>
  api.post(`/equipements/inspections/${id}/analyze/`).then(r => r.data)

export const updateInspection = (id, payload) =>
  api.patch(`/equipements/inspections/${id}/`, payload).then(r => r.data)

export const annotateInspection = (id, formData) =>
  api.post(`/equipements/inspections/${id}/annotate/`, formData, {
    headers: { 'Content-Type': undefined },
  }).then(r => r.data)

export const deleteInspection = (id) =>
  api.delete(`/equipements/inspections/${id}/`)
