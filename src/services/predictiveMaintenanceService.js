import api from './api'

export const getPredictiveModelStatus = async () => (await api.get('/predictive-maintenance/')).data
export const predictRemainingUsefulLife = async (payload) =>
  (await api.post('/predictive-maintenance/', payload)).data
