import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import EmptyState from '../../components/common/EmptyState'
import { getMachines } from '../../services/machineService'
import { getCapteurs, getReadings } from '../../services/sensorService'
import { useAuthContext } from '../../context/AuthContext'
import { formatNullableThreshold } from '../../utils/sensorDisplay'

const formatDateTime = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(value)
  }
}

const toDateTimeLocal = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function downloadReadingsCsv(series) {
  const rows = [
    ['timestamp', 'sensor', 'value', 'unit', 'out_of_range'],
    ...series.flatMap(({ sensor, readings }) => readings.map((reading) => [
      reading.timestamp, sensor?.identifiant || reading.sensor_identifiant || '',
      reading.valeur, sensor?.unite || '', reading.hors_plage ? 'yes' : 'no',
    ])),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'mesures-capteurs.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function downloadChartPng() {
  const svg = document.querySelector('[data-readings-chart]')
  if (!svg) return
  const copy = svg.cloneNode(true)
  copy.querySelectorAll('[stroke], [fill]').forEach((node) => {
    for (const attribute of ['stroke', 'fill']) {
      if (node.getAttribute(attribute)?.includes('var(')) node.setAttribute(attribute, getComputedStyle(node).getPropertyValue(attribute))
    }
  })
  const source = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
  const sourceUrl = URL.createObjectURL(source)
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 410
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(sourceUrl)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'courbe-mesures.png'
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.onerror = () => URL.revokeObjectURL(sourceUrl)
  image.src = sourceUrl
}

function ReadingsChart({ series, onExportCsv }) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const [selection, setSelection] = useState(null)
  // Palette inspirée des courbes du prototype SmartFactory Twin.
  const colors = ['#5986ff', '#f28a2e', '#18aaa4', '#a879ed', '#e65c9b']
  const allRows = series.flatMap(({ sensor, readings }, index) => readings.map((reading) => ({
    ...reading, sensor, seriesIndex: index,
  })))
  const values = allRows.map((reading) => Number(reading.valeur))
  const thresholds = series.flatMap(({ sensor }) => [sensor?.seuil_min, sensor?.seuil_max]).map(Number).filter(Number.isFinite)
  const min = Math.min(...thresholds, ...values, 0)
  const max = Math.max(...thresholds, ...values, 1)
  const spread = max - min || 1
  const y = (value) => 165 - ((value - min) / spread) * 135
  const times = allRows.map((reading) => new Date(reading.timestamp).getTime()).filter(Number.isFinite)
  const minTime = times.length ? Math.min(...times) : Date.now()
  const maxTime = times.length ? Math.max(...times) : minTime + 1
  const duration = Math.max(1, maxTime - minTime)
  const visibleDuration = duration / zoom
  const visibleStart = minTime + (duration - visibleDuration) * offset
  const visibleEnd = visibleStart + visibleDuration
  const x = (timestamp) => 40 + ((new Date(timestamp).getTime() - visibleStart) / visibleDuration) * 720
  const pan = (direction) => setOffset((current) => Math.max(0, Math.min(1 - 1 / zoom, current + direction * 0.12 / zoom)))
  const changeZoom = (factor) => {
    setZoom((current) => {
      const next = Math.max(1, Math.min(10, current * factor))
      setOffset((currentOffset) => Math.min(currentOffset, 1 - 1 / next))
      return next
    })
  }
  const chartX = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    return Math.max(40, Math.min(760, ((event.clientX - box.left) / box.width) * 800))
  }
  const finishSelection = (event) => {
    if (!selection) return
    const end = chartX(event)
    const start = Math.min(selection.start, end)
    const finish = Math.max(selection.start, end)
    if (finish - start > 8) {
      const startRatio = (start - 40) / 720
      const endRatio = (finish - 40) / 720
      const span = endRatio - startRatio
      const nextZoom = Math.min(10, zoom / span)
      const nextDuration = duration / nextZoom
      const nextStart = visibleStart + visibleDuration * startRatio
      setZoom(nextZoom)
      setOffset(Math.max(0, Math.min(1 - 1 / nextZoom, (nextStart - minTime) / (duration - nextDuration || 1))))
    }
    setSelection(null)
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm mb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-sm text-gray-900">Évolution des mesures</h2>
          <p className="mt-1 text-xs text-gray-500">{allRows.length} points · seuils min/max en pointillés · glissez sur le graphique pour sélectionner une plage</p>
        </div>
        <span className="text-xs text-gray-500">{series[0]?.sensor?.unite || ''}</span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg data-readings-chart="true" viewBox="0 0 800 205" role="img" aria-label="Courbes comparées des mesures des capteurs" className="h-56 min-w-[560px] w-full" style={{ touchAction: 'none', cursor: selection ? 'crosshair' : 'default' }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelection({ start: chartX(event), current: chartX(event) }) }} onPointerMove={(event) => { if (selection) setSelection((current) => current ? { ...current, current: chartX(event) } : null) }} onPointerUp={finishSelection} onPointerCancel={() => setSelection(null)}>
          {[0, 1, 2, 3].map((index) => {
            const gridY = 30 + index * 45
            return <line key={index} x1="40" x2="760" y1={gridY} y2={gridY} stroke="var(--sf-line-soft)" />
          })}
          {series.map(({ sensor }, index) => [sensor?.seuil_min, sensor?.seuil_max].map((threshold, thresholdIndex) => (
            threshold !== null && threshold !== undefined && threshold !== '' && Number.isFinite(Number(threshold)) && <line key={`${sensor.id}-${thresholdIndex}`} x1="40" x2="760" y1={y(Number(threshold))} y2={y(Number(threshold))} stroke={colors[index % colors.length]} strokeDasharray="5 5" opacity="0.65" />
          )))}
          {allRows.filter((reading) => reading.hors_plage).map((reading) => {
            const pointX = x(reading.timestamp)
            return pointX >= 40 && pointX <= 760
              ? <line key={`alert-${reading.sensor.id}-${reading.id}`} x1={pointX} x2={pointX} y1="28" y2="172" stroke="#e05252" strokeWidth="5" opacity=".12" />
              : null
          })}
          {selection && <rect x={Math.min(selection.start, selection.current)} y="27" width={Math.abs(selection.current - selection.start)} height="145" fill="var(--sf-accent)" fillOpacity=".14" stroke="var(--sf-accent)" strokeOpacity=".65" />}
          {series.map(({ sensor, readings }, index) => {
            const points = [...readings].filter((reading) => {
              const timestamp = new Date(reading.timestamp).getTime()
              return timestamp >= visibleStart && timestamp <= visibleEnd
            }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            const line = points.map((reading) => `${x(reading.timestamp)},${y(Number(reading.valeur))}`).join(' ')
            return <g key={sensor.id}>
              {points.length > 1 && <polyline points={line} fill="none" stroke={colors[index % colors.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
              {points.map((reading) => <circle key={`${sensor.id}-${reading.id}`} cx={x(reading.timestamp)} cy={y(Number(reading.valeur))} r="3.5" fill={reading.hors_plage ? '#dc2626' : colors[index % colors.length]} />)}
            </g>
          })}
          <text x="40" y="195" fill="var(--sf-muted)" fontSize="11">{formatDateTime(visibleStart)}</text>
          <text x="760" y="195" textAnchor="end" fill="var(--sf-muted)" fontSize="11">{formatDateTime(visibleEnd)}</text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          {series.map(({ sensor }, index) => <span key={sensor.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{sensor.nom}</span>)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Déplacer vers les mesures précédentes" onClick={() => pan(-1)} disabled={offset <= 0} className="rounded-md border px-2 py-1 text-xs disabled:opacity-40">←</button>
          <button type="button" aria-label="Zoomer" onClick={() => changeZoom(1.5)} disabled={zoom >= 10} className="rounded-md border px-2 py-1 text-xs disabled:opacity-40">+</button>
          <button type="button" aria-label="Dézoomer" onClick={() => changeZoom(1 / 1.5)} disabled={zoom <= 1} className="rounded-md border px-2 py-1 text-xs disabled:opacity-40">−</button>
          <button type="button" aria-label="Déplacer vers les mesures récentes" onClick={() => pan(1)} disabled={offset >= 1 - 1 / zoom} className="rounded-md border px-2 py-1 text-xs disabled:opacity-40">→</button>
          <button type="button" onClick={() => { setZoom(1); setOffset(0) }} className="rounded-md border px-2 py-1 text-xs">Réinitialiser</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onExportCsv} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Exporter CSV</button>
          <button type="button" onClick={downloadChartPng} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Exporter PNG</button>
        </div>
      </div>
      <div className="sf-reading-summary-grid" aria-label="Dernières valeurs des capteurs affichés">
        {series.map(({ sensor, readings }, index) => {
          const ordered = [...readings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          const latest = ordered[0]
          const numericValues = ordered.map((reading) => Number(reading.valeur)).filter(Number.isFinite)
          const minimum = numericValues.length ? Math.min(...numericValues) : null
          const maximum = numericValues.length ? Math.max(...numericValues) : null
          return <article key={sensor.id} className="sf-reading-summary" style={{ '--reading-color': colors[index % colors.length] }}>
            <span className="sf-reading-summary-label">{sensor.nom}</span>
            <strong>{latest ? `${Number(latest.valeur).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${sensor.unite || ''}` : '—'}</strong>
            <small>{latest ? `Min ${formatNullableThreshold(sensor.seuil_min)} · Max ${formatNullableThreshold(sensor.seuil_max)} ${sensor.unite || ''}` : 'Aucune mesure disponible'}</small>
            {latest && <small className={latest.hors_plage ? 'is-alert' : ''}>{latest.hors_plage ? 'Dernier relevé hors seuil' : `Étendue ${minimum?.toLocaleString('fr-FR')} – ${maximum?.toLocaleString('fr-FR')}`}</small>}
          </article>
        })}
      </div>
    </section>
  )
}

export default function MesuresPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuthContext()
  const Layout = user?.role === 'ADMIN' ? AdminLayout : user?.role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout
  const requestedSensor = searchParams.get('capteur') || ''
  const [machines, setMachines] = useState([])
  const [capteurs, setCapteurs] = useState([])
  const [readings, setReadings] = useState([])
  const [chartReadings, setChartReadings] = useState([])
  const [comparisonSensorIds, setComparisonSensorIds] = useState([])
  const [comparisonSeries, setComparisonSeries] = useState([])
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [loadingCapteurs, setLoadingCapteurs] = useState(false)
  const [loadingReadings, setLoadingReadings] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState('offline')
  const [error, setError] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(() => searchParams.get('machine') || '')
  const [selectedCapteur, setSelectedCapteur] = useState(requestedSensor)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [period, setPeriod] = useState('all')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const readingIds = useRef(new Set())
  const pageSize = 25
  const selectedCapteurInfo = useMemo(() =>
    capteurs.find((c) => String(c.id) === String(selectedCapteur) || c.identifiant === selectedCapteur),
    [capteurs, selectedCapteur]
  )
  const chartSeries = useMemo(() => selectedCapteurInfo ? [
    { sensor: selectedCapteurInfo, readings: chartReadings },
    ...comparisonSeries,
  ] : [], [selectedCapteurInfo, chartReadings, comparisonSeries])
  const exportCsv = () => downloadReadingsCsv(chartSeries)

  const selectPeriod = (value) => {
    setPeriod(value)
    if (value === 'custom') return
    if (value === 'all') {
      setDateFrom('')
      setDateTo('')
      setPage(1)
      return
    }
    const durationMs = { '1h': 60 * 60 * 1000, '6h': 6 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 }[value]
    const end = new Date()
    setDateFrom(toDateTimeLocal(new Date(end.getTime() - durationMs)))
    setDateTo(toDateTimeLocal(end))
    setPage(1)
  }

  useEffect(() => {
    const fetchMachines = async () => {
      setLoadingMachines(true)
      try {
        const data = await getMachines({ page_size: 200 })
        const list = data?.results ?? data ?? []
        setMachines(list)
        if (!selectedMachine && list.length) setSelectedMachine(String(list[0].id))
      } catch (err) {
        console.error('Erreur lors du chargement des machines', err)
        setError(err?.response?.data?.detail || "Impossible de charger les machines.")
      } finally {
        setLoadingMachines(false)
      }
    }
    fetchMachines()
  }, [])

  useEffect(() => {
    setComparisonSensorIds([])
    setComparisonSeries([])
    setCapteurs([])
    if (!selectedMachine) return
    let active = true
    const fetchCapteurs = async () => {
      setLoadingCapteurs(true)
      try {
        // L'API DRF pagine avec `page_size` ; `limit` est ignoré ici.
        const data = await getCapteurs({ machine: selectedMachine, page_size: 200 })
        const list = data?.results ?? data ?? []
        if (!active) return
        setCapteurs(list)
        if (list.length) {
          const requested = list.find((sensor) => String(sensor.id) === String(requestedSensor) || sensor.identifiant === requestedSensor)
          let latestMeasuredSensor = null
          if (!requested) {
            try {
              const latest = await getReadings({ 'sensor__machine': selectedMachine, ordering: '-timestamp', page_size: 1 })
              const latestReading = (latest?.results ?? latest ?? [])[0]
              const latestSensorId = latestReading?.sensor?.id ?? latestReading?.sensor
              latestMeasuredSensor = list.find((sensor) => String(sensor.id) === String(latestSensorId))
            } catch {
              // La liste des capteurs reste consultable même si la requête de repérage échoue.
            }
          }
          if (!active) return
          const selected = requested || latestMeasuredSensor || list[0]
          setSelectedCapteur(String(selected.id))
        } else {
          setSelectedCapteur('')
        }
      } catch (err) {
        if (!active) return
        console.error('Erreur lors du chargement des capteurs', err)
        setError(err?.response?.data?.detail || "Impossible de charger les capteurs.")
      } finally {
        if (active) setLoadingCapteurs(false)
      }
    }
    fetchCapteurs()
    return () => { active = false }
  }, [selectedMachine, requestedSensor])

  useEffect(() => {
    const ids = comparisonSensorIds.filter((id) => String(id) !== String(selectedCapteur))
    if (!selectedCapteur || !ids.length) {
      setComparisonSeries([])
      return undefined
    }

    let active = true
    const paramsFor = (sensorId) => ({
      sensor: sensorId,
      ordering: '-timestamp',
      page_size: 200,
      ...(dateFrom && { timestamp__gte: `${dateFrom}:00` }),
      ...(dateTo && { timestamp__lte: `${dateTo}:59.999` }),
    })

    Promise.all(ids.map(async (id) => {
      const sensor = capteurs.find((item) => String(item.id) === String(id))
      const data = await getReadings(paramsFor(id))
      return { sensor, readings: data?.results ?? data ?? [] }
    })).then((series) => {
      if (active) setComparisonSeries(series.filter((item) => item.sensor))
    }).catch((err) => {
      if (active) setError(err?.response?.data?.detail || 'Impossible de charger les séries comparées.')
    })

    return () => { active = false }
  }, [comparisonSensorIds, selectedCapteur, capteurs, dateFrom, dateTo])

  useEffect(() => {
    const fetchReadings = async () => {
      if (!selectedCapteur) {
        readingIds.current.clear()
        setReadings([])
        setChartReadings([])
        setCount(0)
        return
      }
      setLoadingReadings(true)
      setError(null)
      try {
        const params = {
          sensor: selectedCapteur,
          ordering: '-timestamp',
          page,
          page_size: pageSize,
          limit: pageSize,
        }
        if (dateFrom) {
          // datetime-local renvoie YYYY-MM-DDTHH:mm ; ajouter secondes pour compatibilité
          params.timestamp__gte = dateFrom.length === 16 ? `${dateFrom}:00` : dateFrom
        }
        if (dateTo) {
          params.timestamp__lte = dateTo.length === 16 ? `${dateTo}:59.999` : dateTo
        }
        const data = await getReadings(params)
        const list = data?.results ?? data ?? []
        setReadings(list)
        setCount(data?.count ?? list.length)
        const chartData = await getReadings({ ...params, page: 1, page_size: 200, limit: 200 })
        const chartList = chartData?.results ?? chartData ?? []
        readingIds.current = new Set(chartList.map((item) => `${selectedCapteur}:${item.id}`))
        setChartReadings(chartList)
      } catch (err) {
        console.error('Erreur lors du chargement des mesures', err)
        setError(err?.response?.data?.detail || "Impossible de charger les mesures.")
      } finally {
        setLoadingReadings(false)
      }
    }
    fetchReadings()
  }, [selectedCapteur, dateFrom, dateTo, page])

  useEffect(() => {
    const token = localStorage.getItem('sf_access')
    if (!selectedCapteur || !token) {
      setRealtimeStatus('offline')
      return undefined
    }

    const sensorIds = [selectedCapteur, ...comparisonSensorIds]
      .filter((id, index, list) => id && list.indexOf(id) === index)
    const sockets = new Set()
    const retryTimers = new Set()
    const connectedSensors = new Set()
    let alive = true
    setRealtimeStatus('connecting')
    const connect = (sensorId, attempt = 0) => {
      if (!alive) return
      const socketUrl = new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin)
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      socketUrl.pathname = `${socketUrl.pathname.replace(/\/?api\/?$/, '').replace(/\/$/, '')}/ws/readings/${encodeURIComponent(sensorId)}/`
      socketUrl.searchParams.set('token', token)
      const socket = new WebSocket(socketUrl)
      sockets.add(socket)
      socket.onopen = () => {
        connectedSensors.add(String(sensorId))
        setRealtimeStatus('online')
      }
      socket.onclose = (event) => {
        sockets.delete(socket)
        connectedSensors.delete(String(sensorId))
        if (!alive) return
        // Le backend ferme avec 4403 lorsqu'un JWT est absent, expiré ou non autorisé.
        if (event.code === 4403) {
          setRealtimeStatus(connectedSensors.size ? 'online' : 'offline')
          return
        }
        setRealtimeStatus(connectedSensors.size ? 'online' : 'connecting')
        // Reprendre le flux après une coupure réseau ou un redémarrage du backend.
        const delay = Math.min(15000, 1000 * (2 ** Math.min(attempt, 4)))
        const timer = window.setTimeout(() => {
          retryTimers.delete(timer)
          connect(sensorId, attempt + 1)
        }, delay)
        retryTimers.add(timer)
      }
      socket.onerror = () => socket.close()
      socket.onmessage = (event) => {
        try {
          const reading = JSON.parse(event.data)
          const timestamp = new Date(reading.timestamp).getTime()
          if (dateFrom && timestamp < new Date(dateFrom).getTime()) return
          // Une période prédéfinie se termine à « maintenant » : la borne haute
          // utilisée par la première requête REST ne doit pas bloquer les prochains relevés.
          if (period === 'custom' && dateTo && timestamp > new Date(dateTo).getTime() + 59999) return
          if (String(sensorId) === String(selectedCapteur)) {
            const readingKey = `${sensorId}:${reading.id}`
            const isNewReading = !readingIds.current.has(readingKey)
            readingIds.current.add(readingKey)
            setReadings((current) => [reading, ...current.filter((item) => item.id !== reading.id)]
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, pageSize))
            setChartReadings((current) => [reading, ...current.filter((item) => item.id !== reading.id)]
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 200))
            if (isNewReading) setCount((current) => current + 1)
          } else {
            setComparisonSeries((current) => current.map((series) => String(series.sensor.id) === String(sensorId)
              ? { ...series, readings: [reading, ...series.readings.filter((item) => item.id !== reading.id)]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 200) }
              : series))
          }
        } catch {
          // Ignore malformed frames; the REST history remains available.
        }
      }
    }
    sensorIds.forEach((sensorId) => connect(sensorId))

    return () => {
      alive = false
      retryTimers.forEach((timer) => window.clearTimeout(timer))
      sockets.forEach((socket) => socket.close())
      sockets.clear()
    }
  }, [selectedCapteur, comparisonSensorIds, dateFrom, dateTo, period])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count])

  const selectedMachineInfo = useMemo(() =>
    machines.find(m => String(m.id) === String(selectedMachine)),
    [machines, selectedMachine]
  )

  return (
    <Layout pageTitle="Mesures temps réel">
      <div className="sf-sprint3-page">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Historique des mesures capteurs</h1>
        <p className="text-sm text-gray-500 mt-1">Consultez les mesures des capteurs associés aux machines.</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-gray-600">Période :</span>
          {['all', '1h', '6h', '24h', '7d', '30d', 'custom'].map((value) => (
            <button key={value} type="button" onClick={() => selectPeriod(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${period === value ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {value === 'all' ? 'Tout l’historique' : value === 'custom' ? 'Personnalisée' : value}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Machine</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={selectedMachine}
              onChange={(e) => { setSelectedMachine(e.target.value); setSelectedCapteur(''); setComparisonSensorIds([]); setComparisonSeries([]); setPage(1) }}
            >
              <option value="">Sélectionner une machine</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.nom} ({m.identifiant_interne})</option>
              ))}
            </select>
            {loadingMachines && <span className="text-xs text-gray-500 mt-1">Chargement...</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Capteur</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={selectedCapteur}
              onChange={(e) => { setSelectedCapteur(e.target.value); setComparisonSensorIds([]); setComparisonSeries([]); setPage(1) }}
              disabled={!selectedMachine || loadingCapteurs}
            >
              <option value="">Sélectionner un capteur</option>
              {capteurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom} - {c.identifiant} ({c.type_capteur})</option>
              ))}
            </select>
            {loadingCapteurs && <span className="text-xs text-gray-500 mt-1">Chargement...</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPeriod('custom'); setPage(1) }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPeriod('custom'); setPage(1) }}
            />
          </div>
        </div>
      </div>

      {selectedCapteur && selectedCapteurInfo && (
        <div className="mb-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-700">Comparer avec des capteurs de même unité ({selectedCapteurInfo.unite || 'sans unité'})</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {capteurs.filter((sensor) => String(sensor.id) !== String(selectedCapteur)
              && sensor.unite === selectedCapteurInfo.unite).map((sensor) => (
              <label key={sensor.id} className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={comparisonSensorIds.includes(String(sensor.id))}
                  onChange={(event) => setComparisonSensorIds((current) => event.target.checked
                    ? [...current, String(sensor.id)]
                    : current.filter((id) => id !== String(sensor.id)))} />
                {sensor.nom} ({sensor.identifiant})
              </label>
            ))}
            {!capteurs.some((sensor) => String(sensor.id) !== String(selectedCapteur)
              && sensor.unite === selectedCapteurInfo.unite) && (
              <span className="text-xs text-gray-500">Aucun autre capteur compatible sur cette machine.</span>
            )}
          </div>
        </div>
      )}

      {selectedCapteur && readings.length > 0 && (
        <ReadingsChart series={chartSeries} onExportCsv={exportCsv} />
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Historique des mesures</h2>
          <span className={`text-xs ${realtimeStatus === 'online' ? 'text-emerald-600' : 'text-gray-400'}`}>
            {realtimeStatus === 'online' ? 'Temps réel connecté' : realtimeStatus === 'connecting' ? 'Connexion temps réel…' : 'Temps réel hors ligne'}
          </span>
          <span className="text-xs text-gray-500">
            {selectedCapteurInfo && selectedMachineInfo ?
              `${selectedMachineInfo.nom} • ${selectedCapteurInfo.nom} (${selectedCapteurInfo.unite})` :
              'Sélectionnez un capteur'
            }
          </span>
        </div>
        {loadingReadings ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !selectedCapteur ? (
          <EmptyState
            icon={Activity}
            title="Aucun capteur sélectionné"
            description="Sélectionnez une machine puis un capteur pour afficher l'historique des mesures."
            className="py-10"
          />
        ) : readings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Activity className="h-8 w-8 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Aucune mesure enregistrée pour ce capteur</h3>
              <p className="mt-1 max-w-lg text-sm text-gray-500">
                {dateFrom || dateTo
                  ? 'Essayez une période plus large ou choisissez « Tout l’historique ». Si aucune mesure n’existe encore, importez-en pour ce capteur.'
                  : 'Ce capteur ne possède pas encore de mesure enregistrée. Importez des mesures historiques ou sélectionnez un autre capteur.'}
              </p>
            </div>
            <Link to="/capteurs/import-readings" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-gray-50">
              Importer des mesures
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Heure</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capteur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hors plage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {readings.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateTime(r.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{r.valeur}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.unite || selectedCapteurInfo?.unite}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.identifiant || selectedCapteurInfo?.identifiant}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.machine?.nom || selectedMachineInfo?.nom}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.hors_plage ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Page {page} sur {totalPages} ({count} mesures)</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >Précédent</button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </Layout>
  )
}
