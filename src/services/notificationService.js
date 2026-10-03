/**
 * notificationService.js
 * Module 3 — non encore implémenté côté backend.
 * Retourne des données vides pour éviter les 404 en console.
 */

export const getNotifications = async (params = {}) => {
  // TODO Module 3 : return api.get('/notifications/', { params }).then(r => r.data)
  return { results: [], count: 0 }
}

export const markAsRead = async (id) => null

export const markAllAsRead = async () => null
