import api from './api'

// ── Capteurs (Module 3 — UC-08) ───────────────────────────────────────────────
export const getCapteurs = (params = {}) =>
  api.get('/equipements/capteurs/', { params }).then(r => r.data)

export const getSensors = getCapteurs // rétrocompatibilité

export const getCapteur = (id) =>
  api.get(`/equipements/capteurs/${id}/`).then(r => r.data)

export const createCapteur = (payload) =>
  api.post('/equipements/capteurs/', payload).then(r => r.data)

export const updateCapteur = (id, payload) =>
  api.patch(`/equipements/capteurs/${id}/`, payload).then(r => r.data)

export const deleteCapteur = (id) => api.delete(`/equipements/capteurs/${id}/`)

// ── Import de capteurs (Module 3 — UC-08) : CSV → création de Sensor ─────────
// Distinct de l'import de mesures (UC-09) ci-dessous.
export const importSensorsCsv = (formData) =>
  api.post('/equipements/capteurs/import_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const previewSensorsCsv = (formData) =>
  api.post('/equipements/capteurs/preview_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ── Mesures / Lectures (Module 3 — UC-09) ─────────────────────────────────────
export const getReadings = (params = {}) =>
  api.get('/equipements/readings/', { params }).then(r => r.data)

export const getMeasurements = getReadings // rétrocompatibilité

export const createReading = (payload) =>
  api.post('/equipements/readings/', payload).then(r => r.data)

// ── Import de mesures historiques (Module 3 — UC-09) ─────────────────────────
export const importReadingsCsv = (formData) =>
  api.post('/equipements/readings/import_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const importReadingsJson = (payload) =>
  api.post('/equipements/readings/import_json/', payload).then(r => r.data)

// ── Prévisualisation (UC-09) : valide sans enregistrer ───────────────────────
export const previewReadingsCsv = (formData) =>
  api.post('/equipements/readings/preview_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const previewReadingsJson = (payload) =>
  api.post('/equipements/readings/preview_json/', payload).then(r => r.data)
