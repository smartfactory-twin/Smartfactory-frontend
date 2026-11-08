import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const RANGES = {
  '1h':  3600,
  '6h':  6 * 3600,
  '24h': 86400,
  '7j':  7 * 86400,
  '30j': 30 * 86400,
};

/**
 * UC-13 — Hook: fetch historical sensor readings + append live WS points
 * @param {string} machineId
 * @param {string[]} sensorKeys  e.g. ['temp','vib']
 * @param {string} range         '1h'|'6h'|'24h'|'7j'|'30j'|'custom'
 * @param {{ from: Date, to: Date }} customRange
 */
export function useSensorData(machineId, sensorKeys, range = '24h', customRange = null) {
  const [series, setSeries]   = useState({});   // { sensorId: [[ts, value], ...] }
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const liveBuffer = useRef({});

  // Fetch historical data
  const fetchHistory = useCallback(async () => {
    if (!machineId || !sensorKeys?.length) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      sensorKeys.forEach((k) => params.append('sensor', k));
      if (range === 'custom' && customRange) {
        params.set('from', customRange.from.toISOString());
        params.set('to', customRange.to.toISOString());
      } else {
        params.set('range', range);
      }
      const { data } = await api.get(
        `/api/v1/equipements/machines/${machineId}/readings/?${params}`
      );
      // Expected: { results: { sensorId: [[ts, value], ...] } }
      setSeries(data.results ?? data);
      liveBuffer.current = {};
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [machineId, sensorKeys?.join(','), range, customRange]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Append a live point received from WebSocket
  const appendLivePoint = useCallback((sensorId, timestamp, value) => {
    setSeries((prev) => {
      const existing = prev[sensorId] ?? [];
      const updated  = [...existing, [timestamp, value]];
      // Keep at most 500 points per sensor in memory
      return { ...prev, [sensorId]: updated.slice(-500) };
    });
  }, []);

  return { series, loading, error, refetch: fetchHistory, appendLivePoint };
}
