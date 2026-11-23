import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Clock3, Headphones, LoaderCircle, MessageSquare, Mic, Plus, Send, Square, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  cancelVoiceProposal,
  confirmVoiceProposal,
  getPendingVoiceProposals,
  sendVoiceAgentMessage,
  transcribeVoiceAudio,
} from '../../services/voiceService'
import SafeMarkdown from './SafeMarkdown'
import {
  DEFAULT_MAX_RECORDING_SECONDS,
  MIN_AUDIO_BYTES,
  MIN_RECORDING_MS,
  getExplicitProposalAction,
  getVoiceApiErrorMessage,
  normalizeActionPhrase,
  selectRecordingMimeType,
} from './voiceAssistantUtils'
import useRealtimeVoiceSession from './useRealtimeVoiceSession'

const configuredLimit = Number(import.meta.env.VITE_VOICE_MAX_AUDIO_SECONDS)
const MAX_RECORDING_SECONDS = Number.isFinite(configuredLimit) && configuredLimit > 0
  ? configuredLimit
  : DEFAULT_MAX_RECORDING_SECONDS
const REALTIME_STATUS_LABELS = {
  idle: 'Inactif', listening: 'Écoute', speech_detected: 'Parole détectée',
  transcribing: 'Transcription', thinking: 'Réflexion', speaking: 'L’assistant parle', error: 'Erreur',
}
const START_MESSAGE = 'Bonjour. Parlez ou écrivez votre demande. Je peux consulter les données et préparer une action ; toute écriture demande votre confirmation explicite.'
const SPEECH_CONTROL_PHRASES = new Set(['confirme', 'je confirme', 'annule', 'j annule'])

function makeMessage(role, text, fields = {}) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, time: new Date(), ...fields }
}

function secureContextAvailable() {
  return window.isSecureContext === true || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function formatTime(value) {
  return new Date(value || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

function downloadGeneratedFile(file) {
  if (!file?.content_base64 || !file?.filename || !file?.content_type) return false
  const binary = window.atob(file.content_base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const url = URL.createObjectURL(new Blob([bytes], { type: file.content_type }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function roleAwareError(error, action = 'agent') {
  const code = error?.response?.status
  if (code === 503 && action === 'agent') {
    return 'L’agent IA est indisponible. Le mode règles avec actions directes est désactivé ; réessayez plus tard. La saisie et la reconnaissance navigateur restent disponibles.'
  }
  return getVoiceApiErrorMessage(error, action)
}

const ENGINE_LABELS = {
  whisper: 'Moteur : Whisper',
  browser: 'Moteur : Reconnaissance navigateur',
  typed: 'Moteur : Saisie',
}

function previewLabel(key) {
  const labels = { alerte: 'Alerte', commentaire: 'Commentaire', commentaire_acquittement: 'Commentaire d’acquittement', machine: 'Machine', capteur: 'Capteur', statut: 'Statut', priorite: 'Priorité', type: 'Type', titre: 'Titre', description: 'Description', rapport: 'Rapport', date: 'Date', reference: 'Référence' }
  return labels[key] || String(key).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function PreviewFields({ value, path = '' }) {
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item]) : Object.entries(value)
    if (!entries.length) return <span className="text-slate-400">Aucun détail</span>
    return <dl className="space-y-2">{entries.map(([key, item]) => {
      const label = path ? `${path} · ${previewLabel(key)}` : previewLabel(key)
      return <div key={`${path}-${key}`} className="rounded-lg bg-slate-950/70 p-3"><dt className="mb-1 text-xs font-semibold text-slate-400">{label}</dt><dd className="break-words text-sm text-slate-100">{item && typeof item === 'object' ? <PreviewFields value={item} path={label} /> : <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{item == null ? 'Non défini' : typeof item === 'boolean' ? (item ? 'Oui' : 'Non') : String(item)}</div>}</dd></div>
    })}</dl>
  }
  return <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{value == null ? 'Non défini' : String(value)}</div>
}

function readableResultFields(result) {
  if (!result || typeof result !== 'object') return []
  const source = result.result && typeof result.result === 'object' ? result.result : result
  return [
    ['Statut', source.statut_label || source.status_label || source.statut || source.status],
    ['Référence', source.reference || source.numero || source.identifiant || source.code],
    ['Commentaire', source.commentaire_acquittement || source.commentaire || source.comment],
    ['Message', source.message || source.detail],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
}

function ConversationDataTable({ table }) {
  if (!table?.columns?.length || !Array.isArray(table.rows)) return null
  return (
    <section className="mt-3 max-w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70" aria-label={`Tableau ${table.title || 'des résultats'}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">{table.title || 'Résultats'}</h3>
        <span className="text-xs text-slate-400">{table.total ?? table.rows.length} résultat{(table.total ?? table.rows.length) === 1 ? '' : 's'}</span>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-900 text-slate-400"><tr>{table.columns.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{column.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">{table.rows.length ? table.rows.map((row, index) => <tr key={`${row.identifiant || row.reference || row.timestamp || 'row'}-${index}`} className="hover:bg-slate-900/70">{table.columns.map((column) => <td key={column.key} className="max-w-64 whitespace-nowrap px-3 py-2">{row[column.key] === '' || row[column.key] == null ? '—' : String(row[column.key])}</td>)}</tr>) : <tr><td colSpan={table.columns.length} className="px-3 py-5 text-center text-slate-400">Aucun résultat.</td></tr>}</tbody>
        </table>
      </div>
      {table.truncated && <p className="border-t border-slate-800 px-3 py-2 text-xs text-amber-300">Liste partielle : certains résultats ne sont pas affichés.</p>}
    </section>
  )
}

export default function VocalPage() {
  const { user } = useAuthContext()
  const role = user?.role ?? 'OPERATEUR'
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout
  const conversationStorageKey = `sf_voice_conversations_${user?.id ?? 'current'}`

  const [messages, setMessages] = useState(() => [makeMessage('assistant', START_MESSAGE)])
  const [draft, setDraft] = useState('')
  const [draftEngine, setDraftEngine] = useState('typed')
  const [lastEngine, setLastEngine] = useState('typed')
  const [autoSend, setAutoSend] = useState(false)
  const [captureState, setCaptureState] = useState('idle')
  const [captureStatus, setCaptureStatus] = useState('')
  const [captureError, setCaptureError] = useState('')
  const [agentBusy, setAgentBusy] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [proposalResult, setProposalResult] = useState(null)
  const [proposalError, setProposalError] = useState('')
  const [proposalBusy, setProposalBusy] = useState(false)
  const [pendingError, setPendingError] = useState('')
  const [agentUnavailable, setAgentUnavailable] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [conversationId, setConversationId] = useState(() => {
    try { return sessionStorage.getItem('sf_voice_conversation_id') || null } catch { return null }
  })
  const [recentConversations, setRecentConversations] = useState(() => {
    try { return JSON.parse(localStorage.getItem(conversationStorageKey) || '[]') } catch { return [] }
  })
  const [activeConversationKey, setActiveConversationKey] = useState(null)

  const chatRef = useRef(null)
  const draftRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const recordStartRef = useRef(0)
  const maxTimerRef = useRef(null)
  const cancelRecordingRef = useRef(false)
  const recognitionRef = useRef(null)
  const proposalLockRef = useRef(false)
  const agentLockRef = useRef(false)
  const mountedRef = useRef(true)
  const realtimeAssistantMessageRef = useRef(null)
  const autoSendRef = useRef(autoSend)
  const activeConversationKeyRef = useRef(null)
  autoSendRef.current = autoSend

  useEffect(() => {
    mountedRef.current = true
    const restoreProposal = getPendingVoiceProposals()
      .then((result) => {
        const pending = result?.results?.find((item) => item.status === 'pending')
        if (mountedRef.current && pending) setProposal(pending)
      })
      .catch((error) => { if (mountedRef.current) setPendingError(roleAwareError(error)) })
    return () => {
      mountedRef.current = false
      void restoreProposal
    }
  }, [])

  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem('sf_voice_conversation_id', conversationId)
      else sessionStorage.removeItem('sf_voice_conversation_id')
    } catch { /* La conversation reste active en mémoire si le stockage session est bloqué. */ }
  }, [conversationId])

  useEffect(() => {
    try { localStorage.setItem(conversationStorageKey, JSON.stringify(recentConversations)) } catch { /* L’historique reste disponible en mémoire si le stockage local est bloqué. */ }
  }, [conversationStorageKey, recentConversations])

  useEffect(() => {
    if (!activeConversationKey || !messages.some((message) => message.role === 'user')) return
    const savedMessages = messages.filter((message) => message.status !== 'loading').map((message) => ({
      id: message.id, role: message.role, text: message.text, time: message.time, status: message.status,
      displayData: message.displayData,
    }))
    const firstUserMessage = savedMessages.find((message) => message.role === 'user')
    if (!firstUserMessage) return
    setRecentConversations((current) => {
      const existing = current.find((item) => item.id === activeConversationKey)
      const nextConversation = {
        id: activeConversationKey,
        title: (firstUserMessage.text || 'Nouvelle conversation').slice(0, 72),
        updatedAt: new Date().toISOString(),
        serverConversationId: conversationId || existing?.serverConversationId || null,
        messages: savedMessages,
      }
      return [nextConversation, ...current.filter((item) => item.id !== activeConversationKey)].slice(0, 40)
    })
  }, [messages, activeConversationKey, conversationId])

  useEffect(() => {
    if (!chatRef.current) return
    chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!proposal || proposal.status !== 'pending') return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [proposal])

  const secondsRemaining = useMemo(() => {
    if (!proposal || !Number.isFinite(Date.parse(proposal.expires_at))) return 0
    return Math.max(0, Math.ceil((Date.parse(proposal.expires_at) - now) / 1000))
  }, [now, proposal])
  const proposalActive = proposal?.status === 'pending' && secondsRemaining > 0

  useEffect(() => {
    if (proposal?.status === 'pending' && secondsRemaining === 0) {
      setProposal((current) => current?.status === 'pending' ? { ...current, status: 'expired' } : current)
    }
  }, [proposal, secondsRemaining])

  const releaseMicrophone = useCallback(() => {
    if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current)
    maxTimerRef.current = null
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const postAssistantMessage = useCallback((text, fields = {}) => {
    setMessages((current) => [...current, makeMessage('assistant', text, fields)])
  }, [])

  const updateMessage = useCallback((id, changes) => {
    setMessages((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }, [])

  const runProposalAction = useCallback(async (action, source = 'button') => {
    if (!proposalActive || !proposal?.id || proposalLockRef.current) return { success: false, message: 'La proposition n’est plus disponible.' }
    proposalLockRef.current = true
    setProposalBusy(true)
    setProposalError('')
    setProposalResult(null)
    const verb = action === 'confirm' ? 'Confirmation' : 'Annulation'
    const resultMessage = makeMessage('assistant', `${verb} en cours…`, { status: 'loading' })
    if (source === 'voice') setMessages((current) => [...current, resultMessage])
    try {
      const data = action === 'confirm'
        ? await confirmVoiceProposal(proposal.id)
        : await cancelVoiceProposal(proposal.id)
      const nextProposal = data?.proposal || { ...proposal, status: action === 'confirm' ? 'executed' : 'cancelled' }
      setProposal(nextProposal)
      setProposalResult(action === 'confirm' ? data?.result ?? null : null)
      if (action === 'confirm') window.dispatchEvent(new Event('notifications-updated'))
      const text = action === 'confirm'
        ? 'Action exécutée après votre confirmation explicite.'
        : 'Proposition annulée. Aucune écriture n’a été effectuée.'
      if (source === 'voice') updateMessage(resultMessage.id, { text, status: 'complete' })
      else postAssistantMessage(text)
      return { success: true, message: action === 'confirm' ? 'C’est fait, l’action est confirmée.' : 'La proposition est annulée.' }
    } catch (error) {
      const code = error?.response?.status
      const responseProposal = error?.response?.data?.proposal
      if (code === 410) setProposal((current) => ({ ...current, status: 'expired' }))
      else if (code === 404) setProposal((current) => ({ ...current, status: 'not_found' }))
      else if (code === 409) setProposal(responseProposal || ((current) => ({ ...current, status: 'already_processed' })))
      else setProposal((current) => ({ ...current, status: 'failed' }))
      const text = code === 410 ? 'Cette proposition a expiré (410).'
        : code === 409 ? 'Cette proposition a déjà été traitée (409).'
          : code === 404 ? 'Cette proposition est introuvable (404).'
            : roleAwareError(error, 'proposal')
      setProposalError(text)
      if (source === 'voice') updateMessage(resultMessage.id, { text, status: 'error' })
      else postAssistantMessage(text, { status: 'error' })
      return { success: false, message: text }
    } finally {
      proposalLockRef.current = false
      setProposalBusy(false)
    }
  }, [postAssistantMessage, proposal, proposalActive, updateMessage])

  const realtimeVoice = useRealtimeVoiceSession({
    getProposal: () => proposal,
    onDownload: (file) => {
      if (downloadGeneratedFile(file)) postAssistantMessage(`Le fichier ${file.filename} est prêt et a été téléchargé.`)
    },
    onUserTranscript: (text) => {
      let localKey = activeConversationKeyRef.current
      if (!localKey) {
        localKey = globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`
        activeConversationKeyRef.current = localKey
        setActiveConversationKey(localKey)
      }
      realtimeAssistantMessageRef.current = null
      setMessages((current) => [...current, makeMessage('user', text, { engine: 'Whisper temps réel' })])
    },
    onAssistantSentence: (sentence) => {
      const currentId = realtimeAssistantMessageRef.current
      if (currentId) {
        setMessages((current) => current.map((message) => message.id === currentId
          ? { ...message, text: `${message.text} ${sentence}`.trim(), status: 'streaming' }
          : message))
      } else {
        const message = makeMessage('assistant', sentence, { status: 'streaming' })
        realtimeAssistantMessageRef.current = message.id
        setMessages((current) => [...current, message])
      }
    },
    onAssistantReset: () => {
      const id = realtimeAssistantMessageRef.current
      if (id) setMessages((current) => current.filter((message) => message.id !== id))
      realtimeAssistantMessageRef.current = null
    },
    onAssistantDone: (result) => {
      if (result?.conversation_id) setConversationId(result.conversation_id)
      if (result?.proposal) {
        setProposal(result.proposal)
        setProposalResult(null)
      }
      const id = realtimeAssistantMessageRef.current
      const reply = String(result?.reply || '').trim()
      if (id && reply) setMessages((current) => current.map((message) => message.id === id
        ? { ...message, text: reply, displayData: result?.display_data || message.displayData, status: 'complete' }
        : message))
      else if (reply) postAssistantMessage(reply, { displayData: result?.display_data })
      realtimeAssistantMessageRef.current = null
    },
    onProposal: (value) => { setProposal(value); setProposalResult(null) },
    onProposalAction: (action) => runProposalAction(action, 'voice'),
    onError: (message) => postAssistantMessage(message, { status: 'error' }),
  })

  const sendTextToAgent = useCallback(async (text, source = 'typed') => {
    const cleanText = String(text || '').trim()
    if (!cleanText || agentLockRef.current) return
    agentLockRef.current = true
    let localConversationKey = activeConversationKeyRef.current
    if (!localConversationKey) {
      localConversationKey = globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`
      activeConversationKeyRef.current = localConversationKey
      setActiveConversationKey(localConversationKey)
    }
    setAgentBusy(true)
    setCaptureError('')
    setProposalError('')
    const userMessage = makeMessage('user', cleanText, { engine: source })
    const loadingMessage = makeMessage('assistant', 'Réponse en cours…', { status: 'loading' })
    setMessages((current) => [...current, userMessage, loadingMessage])
    try {
      const result = await sendVoiceAgentMessage(cleanText, conversationId, source === 'typed' ? 'text' : 'voice')
      setAgentUnavailable(false)
      if (result?.conversation_id) setConversationId(result.conversation_id)
      if (result?.proposal) {
        setProposal(result.proposal)
        setProposalResult(null)
      }
      if (result?.download && downloadGeneratedFile(result.download)) {
        postAssistantMessage(`Le fichier ${result.download.filename} est prêt et a été téléchargé.`)
      }
      updateMessage(loadingMessage.id, { text: result?.reply || 'Aucune réponse fournie.', displayData: result?.display_data, status: 'complete' })
    } catch (error) {
      if (error?.response?.status === 503) setAgentUnavailable(true)
      const text = roleAwareError(error, 'agent')
      updateMessage(loadingMessage.id, { text, status: 'error' })
    } finally {
      agentLockRef.current = false
      setAgentBusy(false)
    }
  }, [conversationId, updateMessage])

  const handleText = useCallback(async (text, source = 'typed') => {
    const cleanText = String(text || '').trim()
    if (!cleanText) return
    const action = source === 'typed' ? null : getExplicitProposalAction(cleanText, proposal, Date.now())
    if (action) {
      const userMessage = makeMessage('user', cleanText, { engine: source })
      setMessages((current) => [...current, userMessage])
      await runProposalAction(action, 'voice')
      return
    }
    await sendTextToAgent(cleanText, source)
  }, [proposal, runProposalAction, sendTextToAgent])

  const startBrowserFallback = useCallback(() => {
    const BrowserRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!BrowserRecognition) {
      setCaptureState('idle')
      setCaptureStatus('Whisper est indisponible. La reconnaissance navigateur n’est pas prise en charge : saisissez ou collez votre demande.')
      setDraftEngine('typed')
      draftRef.current?.focus()
      return
    }
    try {
      const recognition = new BrowserRecognition()
      recognition.lang = 'fr-FR'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ''
        setCaptureState('idle')
        recognitionRef.current = null
        if (!transcript) {
          setCaptureStatus('Aucune parole reconnue. Saisissez votre demande dans le champ texte.')
          draftRef.current?.focus()
          return
        }
        setDraft(transcript)
        setDraftEngine('browser')
        setLastEngine('browser')
        setCaptureStatus('Reconnaissance navigateur terminée. Vérifiez ou modifiez le texte avant l’envoi.')
        draftRef.current?.focus()
        if (autoSendRef.current || SPEECH_CONTROL_PHRASES.has(normalizeActionPhrase(transcript))) {
          void handleText(transcript, 'browser')
        }
      }
      recognition.onerror = (event) => {
        recognitionRef.current = null
        setCaptureState('idle')
        setCaptureStatus(event.error === 'not-allowed'
          ? 'Permission de reconnaissance vocale refusée. Saisissez votre demande.'
          : 'La reconnaissance navigateur a échoué. Saisissez votre demande.')
        draftRef.current?.focus()
      }
      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null
          setCaptureState('idle')
        }
      }
      recognitionRef.current = recognition
      recognition.start()
      setCaptureState('browserListening')
      setCaptureStatus('Whisper indisponible : écoute par la reconnaissance navigateur (fr-FR)…')
    } catch {
      recognitionRef.current = null
      setCaptureState('idle')
      setCaptureStatus('La reconnaissance navigateur n’a pas pu démarrer. Saisissez votre demande.')
      draftRef.current?.focus()
    }
  }, [handleText])

  const transcribeRecording = useCallback(async (blob, engineType) => {
    setCaptureState('transcribing')
    setCaptureStatus('Envoi et transcription de l’audio…')
    setCaptureError('')
    try {
      const result = await transcribeVoiceAudio(blob)
      const transcript = String(result?.text || '').trim()
      if (!transcript) {
        setCaptureState('idle')
        setCaptureError('Aucun texte reconnu. Vous pouvez saisir votre demande.')
        setDraftEngine('typed')
        draftRef.current?.focus()
        return
      }
      setDraft(transcript)
      setDraftEngine(engineType)
      setLastEngine(engineType)
      setCaptureState('idle')
      setCaptureStatus('Transcription terminée. Vérifiez ou modifiez le texte avant l’envoi.')
      draftRef.current?.focus()
      if (autoSendRef.current || SPEECH_CONTROL_PHRASES.has(normalizeActionPhrase(transcript))) {
        await handleText(transcript, engineType)
      }
    } catch (error) {
      const code = error?.response?.status
      if (code === 503) {
        setCaptureError('Whisper indisponible. Tentative de reconnaissance vocale du navigateur…')
        startBrowserFallback()
      } else {
        setCaptureState('idle')
        setCaptureError(roleAwareError(error, 'transcription'))
        setDraftEngine('typed')
        draftRef.current?.focus()
      }
    }
  }, [handleText, startBrowserFallback])

  const stopRecording = useCallback((cancel = false) => {
    cancelRecordingRef.current = cancel
    if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current)
    maxTimerRef.current = null
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      releaseMicrophone()
      setCaptureState('idle')
    }
  }, [releaseMicrophone])

  const startRecording = useCallback(async () => {
    setCaptureError('')
    setCaptureStatus('')
    if (!secureContextAvailable()) {
      setCaptureError('Le microphone nécessite HTTPS ou une adresse locale sécurisée (localhost).')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setCaptureError('L’enregistrement audio n’est pas pris en charge par ce navigateur. Saisissez votre demande.')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = selectRecordingMimeType(window.MediaRecorder)
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      cancelRecordingRef.current = false
      recordStartRef.current = Date.now()
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        cancelRecordingRef.current = true
        setCaptureError('L’enregistrement audio a échoué. Réessayez ou saisissez votre demande.')
        stopRecording(true)
      }
      recorder.onstop = async () => {
        const duration = Date.now() - recordStartRef.current
        const chunks = chunksRef.current
        chunksRef.current = []
        recorderRef.current = null
        releaseMicrophone()
        if (!mountedRef.current) return
        if (cancelRecordingRef.current) {
          setCaptureState('idle')
          setCaptureStatus('Enregistrement annulé. Aucun audio n’a été envoyé.')
          return
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (duration < MIN_RECORDING_MS || blob.size < MIN_AUDIO_BYTES) {
          setCaptureState('idle')
          setCaptureError('Enregistrement trop court ou vide. Parlez au moins une demi-seconde puis réessayez.')
          return
        }
        await transcribeRecording(blob, 'whisper')
      }
      recorder.start()
      setCaptureState('recording')
      setCaptureStatus('Écoute en cours… Cliquez sur « Arrêter » lorsque vous avez terminé.')
      maxTimerRef.current = window.setTimeout(() => {
        setCaptureStatus(`Durée maximale de ${MAX_RECORDING_SECONDS} secondes atteinte. Transcription en cours…`)
        stopRecording(false)
      }, MAX_RECORDING_SECONDS * 1000)
    } catch (error) {
      stream?.getTracks?.().forEach((track) => track.stop())
      streamRef.current = null
      setCaptureState('idle')
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCaptureError('Accès au microphone refusé. Autorisez le microphone dans votre navigateur ou saisissez votre demande.')
      } else if (error?.name === 'NotFoundError') {
        setCaptureError('Aucun microphone détecté. Saisissez votre demande.')
      } else {
        setCaptureError('Impossible de démarrer le microphone. Saisissez votre demande.')
      }
    }
  }, [releaseMicrophone, stopRecording, transcribeRecording])

  const cancelBrowserFallback = useCallback(() => {
    recognitionRef.current?.abort?.()
    recognitionRef.current = null
    setCaptureState('idle')
    setCaptureStatus('Reconnaissance navigateur annulée. Saisissez votre demande.')
    draftRef.current?.focus()
  }, [])

  useEffect(() => () => {
    mountedRef.current = false
    cancelRecordingRef.current = true
    if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current)
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop() } catch { /* Le recorder peut déjà être arrêté. */ }
    recognitionRef.current?.abort?.()
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
  }, [])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    if (!draft.trim() || agentBusy || captureState === 'recording' || captureState === 'transcribing') return
    const text = draft.trim()
    const engine = draftEngine
    setDraft('')
    setDraftEngine('typed')
    setLastEngine('typed')
    void handleText(text, engine)
  }, [agentBusy, captureState, draft, draftEngine, handleText])

  const newConversation = useCallback(() => {
    activeConversationKeyRef.current = null
    setActiveConversationKey(null)
    setConversationId(null)
    setMessages([makeMessage('assistant', START_MESSAGE)])
    setProposal(null)
    setProposalResult(null)
    setProposalError('')
    setPendingError('')
    setDraft('')
    setDraftEngine('typed')
    draftRef.current?.focus()
  }, [])

  const proposalStatusLabel = proposal?.status === 'executed' ? 'Exécutée'
    : proposal?.status === 'cancelled' ? 'Annulée'
      : proposal?.status === 'expired' ? 'Expirée'
        : proposal?.status === 'failed' ? 'Échec'
          : proposal?.status === 'not_found' ? 'Introuvable'
            : proposal?.status === 'already_processed' ? 'Déjà traitée'
              : 'En attente'

  return (
    <Layout pageTitle="Assistant vocal">
      <main className="mx-auto w-full max-w-7xl space-y-5 px-1 sm:px-2">

        {(captureError || pendingError) && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{captureError || pendingError}</div>}
        {captureStatus && <p className="sr-only" aria-live="polite">{captureStatus}</p>}
        {pendingError && <p className="sr-only" aria-live="polite">{pendingError}</p>}
        {agentUnavailable && <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Agent IA indisponible.</strong> Le mode règles avec actions directes est désactivé. Réessayez plus tard ; toute écriture doit continuer à passer par une proposition et une confirmation explicite.</div></div>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100" aria-label="Historique des conversations">
            <button type="button" onClick={newConversation} className="mb-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 text-sm hover:bg-slate-800"><Plus className="h-4 w-4" />Nouvelle conversation</button>
            <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations récentes</h2>
            <div className="max-h-[70vh] space-y-1 overflow-y-auto">
              {recentConversations.length ? recentConversations.map((item) => <button key={item.id} type="button" onClick={() => { activeConversationKeyRef.current = item.id; setActiveConversationKey(item.id); setMessages(item.messages?.length ? item.messages.map((message) => ({ ...message, time: new Date(message.time) })) : [makeMessage('assistant', START_MESSAGE)]); setConversationId(item.serverConversationId || null); setProposal(null); setProposalResult(null) }} className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-800 ${activeConversationKey === item.id ? 'bg-slate-800 text-white' : 'text-slate-300'}`} title={item.title}>{item.title}</button>) : <p className="px-2 py-3 text-xs text-slate-400">Aucune conversation enregistrée.</p>}
            </div>
          </aside>
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-sm text-slate-100" aria-label="Conversation avec l’assistant">
            <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-slate-100">Conversation</h2>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={autoSend} onChange={(event) => setAutoSend(event.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Envoyer automatiquement la transcription
              </label>
            </div>

            <div ref={chatRef} role="log" aria-live="polite" aria-relevant="additions text" className="flex max-h-[min(62vh,680px)] min-h-80 flex-col gap-4 overflow-y-auto bg-slate-950 px-4 py-5 sm:px-6">
              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} aria-label={message.role === 'user' ? 'Votre message' : 'Réponse de l’assistant'}>
                  <div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[88%] ${message.role === 'user' ? 'rounded-br-md bg-blue-600 text-white' : message.status === 'error' ? 'rounded-bl-md border border-red-900 bg-red-950 text-red-100' : 'rounded-bl-md border border-slate-700 bg-slate-900 text-slate-100'}`}>
                    {message.status === 'loading' && <span className="mb-1 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{message.text}</span>}
                    {message.status !== 'loading' && (message.role === 'assistant' ? <SafeMarkdown>{message.text}</SafeMarkdown> : <p className="whitespace-pre-wrap break-words">{message.text}</p>)}
                    {message.role === 'assistant' && <ConversationDataTable table={message.displayData} />}
                    <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${message.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>
                      <time dateTime={new Date(message.time).toISOString()}>{formatTime(message.time)}</time>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {proposal && (
              <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" aria-labelledby="proposal-title" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id="proposal-title" className="font-semibold text-slate-100">Action proposée</h3>
                    <p className="mt-1 text-sm text-slate-300">{proposal.summary || proposal.spoken_summary}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{proposalStatusLabel}</span>
                </div>
                <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/60 p-3" aria-label="Aperçu complet de l’action">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Aperçu complet de l’écriture</h4>
                  <PreviewFields value={proposal.preview || {}} />
                </div>
                {proposalActive && <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-300"><Clock3 className="h-4 w-4" />Expire dans {formatCountdown(secondsRemaining)} · {new Date(proposal.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
                {!proposalActive && proposal.status === 'pending' && <p className="mt-3 text-sm text-red-700">Proposition expirée. Les actions ne sont plus disponibles.</p>}
                {proposalError && <p role="alert" className="mt-2 text-sm text-red-700">{proposalError}</p>}
                {proposalActive && <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={proposalBusy} onClick={() => void runProposalAction('confirm')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {proposalBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirmer
                  </button>
                  <button type="button" disabled={proposalBusy} onClick={() => void runProposalAction('cancel')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <X className="h-4 w-4" />Annuler
                  </button>
                </div>}
                {proposal.status === 'executed' && <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-100"><h4 className="mb-2 font-semibold">Résultat</h4>{readableResultFields(proposalResult).length ? <dl className="space-y-1">{readableResultFields(proposalResult).map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-2"><dt className="font-medium text-emerald-300">{label} :</dt><dd className="whitespace-pre-wrap break-words">{String(value)}</dd></div>)}</dl> : <p>Action confirmée avec succès.</p>}</div>}
                {proposal.status === 'cancelled' && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">Proposition annulée. Aucune écriture n’a été effectuée.</p>}
                {proposal.status === 'expired' && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/50 p-3 text-sm text-amber-200">Cette proposition a expiré. Aucune écriture n’a été effectuée.</p>}
                {proposal.status === 'already_processed' && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/50 p-3 text-sm text-amber-200">Cette proposition a déjà été traitée. Aucune nouvelle écriture n’a été effectuée.</p>}
                {proposal.status === 'not_found' && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">Cette proposition est introuvable.</p>}
                {proposal.status === 'failed' && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">L’action n’a pas pu être confirmée. Réessayez ou vérifiez son état.</p>}
                {proposal.status !== 'pending' && <button type="button" onClick={() => setProposal(null)} className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Fermer</button>}
              </div></section>
            )}

            {agentBusy && <p className="mx-5 mb-2 text-xs text-slate-500" aria-live="polite">L’assistant prépare sa réponse…</p>}
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-800 bg-slate-900 p-4 sm:p-5">
              <label htmlFor="voice-message" className="sr-only">Votre demande vocale ou textuelle</label>
              <div className="relative rounded-2xl border border-slate-700 bg-slate-950 p-2 focus-within:border-slate-500">
                <textarea id="voice-message" ref={draftRef} value={draft} onChange={(event) => { setDraft(event.target.value); setDraftEngine('typed'); setLastEngine('typed') }} rows={3} disabled={agentBusy || captureState === 'recording' || captureState === 'transcribing'} placeholder="Écrivez ou dictez votre demande…" className="w-full resize-none border-0 bg-transparent px-3 py-2.5 pb-14 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:bg-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                  {captureState === 'recording' ? <>
                    <button type="button" aria-label="Arrêter" title="Arrêter" onClick={() => stopRecording(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white"><Square className="h-4 w-4" /></button>
                    <button type="button" aria-label="Annuler l’enregistrement" title="Annuler" onClick={() => stopRecording(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-200"><X className="h-4 w-4" /></button>
                  </> : captureState === 'browserListening' ? <button type="button" aria-label="Annuler la reconnaissance" onClick={cancelBrowserFallback} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-200"><X className="h-4 w-4" /></button> : <button type="button" aria-label="Enregistrer" title="Enregistrer" onClick={() => void startRecording()} disabled={captureState === 'transcribing' || agentBusy} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"><Mic className="h-4 w-4" /></button>}
                  <button type="button" aria-label={realtimeVoice.sessionActive ? 'Arrêter la conversation vocale' : realtimeVoice.isStarting ? 'Annuler le démarrage vocal' : 'Démarrer une conversation vocale en temps réel'} title={realtimeVoice.sessionActive ? 'Arrêter la conversation vocale' : 'Conversation vocale en temps réel'} disabled={agentBusy || captureState === 'recording' || captureState === 'transcribing'} onClick={() => { if (realtimeVoice.sessionActive || realtimeVoice.isStarting) realtimeVoice.stopSession(); else void realtimeVoice.startSession() }} className={`inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-50 ${realtimeVoice.sessionActive || realtimeVoice.isStarting ? 'bg-red-700 text-white hover:bg-red-600' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    {realtimeVoice.sessionActive || realtimeVoice.isStarting ? <Square className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                  </button>
                  {captureState === 'transcribing' && <span className="text-xs text-slate-400" role="status"><LoaderCircle className="mr-1 inline h-3.5 w-3.5 animate-spin" />Transcription…</span>}
                </div>
                <button type="submit" aria-label="Envoyer" title="Envoyer" disabled={!draft.trim() || agentBusy || captureState === 'recording' || captureState === 'transcribing'} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span aria-live="polite">{captureStatus || (captureState === 'recording' ? 'Écoute en cours…' : 'L’audio n’est conservé ni dans le navigateur après fermeture, ni dans le journal de l’application.')}</span>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300" data-testid="transcription-engine">{ENGINE_LABELS[lastEngine] || ENGINE_LABELS.typed}</span>
                <span>Durée maximale : {MAX_RECORDING_SECONDS} s</span>
              </div>
              {(realtimeVoice.sessionActive || realtimeVoice.isStarting || realtimeVoice.status.phase === 'error') && <p className={`text-xs ${realtimeVoice.status.phase === 'error' ? 'text-amber-300' : 'text-slate-400'}`} role="status" aria-live="polite">{realtimeVoice.status.message}</p>}
            </form>
          </section>

        </div>
      </main>
    </Layout>
  )
}
