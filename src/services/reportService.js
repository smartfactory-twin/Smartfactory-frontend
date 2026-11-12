import api from './api'

// ── Rapports et exports ─────────────────────────────────────────────────────
// Aperçus calculés depuis l'API Django, génération PDF serveur et exports CSV.

async function fetchAllPages(url, params = {}) {
  const rows = []
  let page = 1
  while (page <= 100) {
    const { data } = await api.get(url, { params: { ...params, page } })
    const items = data.results ?? data
    if (!Array.isArray(items)) return items
    rows.push(...items)
    if (!data.next || items.length === 0) break
    page += 1
  }
  return rows
}

export async function fetchMachineHealth(machineId, days = 30) {
  const { data } = await api.get('/reports/health/', { params: { machine_id: machineId, days } })
  return data
}

export async function fetchAnomalies(days = 30) {
  const since = new Date(Date.now() - days * 86400e3).toISOString()
  return await fetchAllPages('/alertes/', { date_declenchement__gte: since, ordering: '-date_declenchement' })
}

export async function fetchWorkOrdersSummary() {
  return await fetchAllPages('/equipements/ordres-travail/')
}

// ── Export CSV helpers ──────────────────────────────────────────────────────

export function arrayToCsv(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export function downloadCsv(filename, csvString) {
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportPdf(params) {
  const { data } = await api.get('/reports/pdf/', { params, responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = `smartfactory_rapport_${params.type}_${new Date().toISOString().slice(0, 10)}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportMeasurements() {
  const data = await fetchAllPages('/equipements/readings/', { page_size: 200, ordering: '-timestamp' })
  const rows = data.map((r) => [r.timestamp, r.sensor_identifiant || r.sensor, r.valeur ?? r.value, r.hors_plage ? 'Oui' : 'Non'])
  return { headers: ['Date et heure', 'Identifiant capteur', 'Valeur', 'Hors seuil'], rows }
}

export async function exportEquipments() {
  const data = await fetchAllPages('/equipements/machines/')
  const rows = data.map((m) => [m.identifiant_interne, m.nom, m.type_equipement, m.marque, m.statut, m.numero_serie])
  return { headers: ['ID', 'Nom', 'Type', 'Marque', 'Statut', 'N° série'], rows }
}

export async function exportAlerts() {
  const data = await fetchAllPages('/alertes/', { ordering: '-date_declenchement' })
  const rows = data.map((a) => [
    a.reference ?? a.id, a.machine_nom ?? a.machine, a.niveau, a.capteur_identifiant ?? a.capteur,
    a.message, a.date_declenchement ? new Date(a.date_declenchement).toISOString() : '', a.statut, a.commentaire_acquittement ?? '',
  ])
  return { headers: ['Réf.', 'Machine', 'Niveau', 'Capteur', 'Message', 'Date', 'Statut', 'Commentaire'], rows }
}
