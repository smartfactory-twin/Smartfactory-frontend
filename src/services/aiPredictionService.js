import api from './api'

export const getAnomalyAnalysis = (machineId) => api.get('/ai-predictions/anomalies/', { params: { machine_id: machineId } }).then((r) => r.data)
export const simulateWhatIf = (payload) => api.post('/ai-predictions/what-if/', payload).then((r) => r.data)
export const getAiModels = () => api.get('/ai-predictions/models/').then((r) => r.data)
