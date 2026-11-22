import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Clock3, LoaderCircle, MessageSquare, Mic, Plus, Send, Shield, Square, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  cancelVoiceProposal,
  confirmVoiceProposal,
  getPendingVoiceProposals,
  getVoiceCommandHistory,
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

const configuredLimit = Number(import.meta.env.VITE_VOICE_MAX_AUDIO_SECONDS)
const MAX_RECORDING_SECONDS = Number.isFinite(configuredLimit) && configuredLimit > 0
  ? configuredLimit
  : DEFAULT_MAX_RECORDING_SECONDS
const EXAMPLES = [
  'Liste les machines de mon périmètre.',
  'Quelles alertes sont actives cette semaine ?',
  'Quelle est la dernière mesure de la pompe POMPE-002 ?',
  'Crée un ordre de travail correctif pour POMPE-002, priorité haute.',
]
const ROLE_LABELS = { ADMIN: 'Administrateur', TECHNICIEN: 'Technicien', OPERATEUR: 'Opérateur' }
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

function roleAwareError(error, action = 'agent') {
  const code = error?.response?.status
  if (code === 503 && action === 'agent') {
    return 'L’agent IA est indisponible. Le mode règles avec actions directes est désactivé ; réessayez plus tard. La saisie et la reconnaissance navigateur restent disponibles.'
  }
  return getVoiceApiErrorMessage(error, action)
}

export default function VocalPage() {
  const { user } = useAuthContext()
  const role = user?.role ?? 'OPERATEUR'
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [messages, setMessages] = useState(() => [makeMessage('assistant', START_MESSAGE)])
  const [draft, setDraft] = useState('')
  const [draftEngine, setDraftEngine] = useState('typed')
  const [autoSend, setAutoSend] = useState(false)
  const [captureState, setCaptureState] = useState('idle')
  const [captureStatus, setCaptureStatus] = useState('')
  const [captureError, setCaptureError] = useState('')
  const [agentBusy, setAgentBusy] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [proposalResult, setProposalResult] = useState(null)
  const [proposalError, setProposalError] = useState('')
  const [proposalBusy, setProposalBusy] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [pendingError, setPendingError] = useState('')
  const [agentUnavailable, setAgentUnavailable] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [conversationId, setConversationId] = useState(() => {
    try { return sessionStorage.getItem('sf_voice_conversation_id') || null } catch { return null }
  })

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
  const autoSendRef = useRef(autoSend)
  autoSendRef.current = autoSend

  useEffect(() => {
    mountedRef.current = true
    const loadHistory = getVoiceCommandHistory()
      .then((result) => {
        const entries = Array.isArray(result) ? result : result?.results || []
        if (mountedRef.current) setHistory(entries.map((entry) => ({
          id: entry.id,
          time: entry.created_at,
          text: entry.texte,
          intent: entry.intention || '—',
          confidence: entry.confiance,
          result: entry.resultat || '—',
          user: entry.utilisateur,
        })))
      })
      .catch((error) => {
        if (mountedRef.current) setHistoryError(roleAwareError(error))
      })
      .finally(() => { if (mountedRef.current) setHistoryLoading(false) })
    const restoreProposal = getPendingVoiceProposals()
      .then((result) => {
        const pending = result?.results?.find((item) => item.status === 'pending')
        if (mountedRef.current && pending) setProposal(pending)
      })
      .catch((error) => { if (mountedRef.current) setPendingError(roleAwareError(error)) })
    return () => {
      mountedRef.current = false
      void loadHistory
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
    if (!proposalActive || !proposal?.id || proposalLockRef.current) return
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
      const nextProposal = data?.proposal || proposal
      setProposal(nextProposal)
      setProposalResult(action === 'confirm' ? data?.result ?? null : null)
      const text = action === 'confirm'
        ? 'Action exécutée après votre confirmation explicite.'
        : 'Proposition annulée. Aucune écriture n’a été effectuée.'
      if (source === 'voice') updateMessage(resultMessage.id, { text, status: 'complete' })
      else postAssistantMessage(text)
    } catch (error) {
      const code = error?.response?.status
      const responseProposal = error?.response?.data?.proposal
      if (code === 410) setProposal((current) => ({ ...current, status: 'expired' }))
      else if (code === 404) setProposal((current) => ({ ...current, status: 'not_found' }))
      else if (code === 409) setProposal(responseProposal || ((current) => ({ ...current, status: 'already_processed' })))
      const text = code === 410 ? 'Cette proposition a expiré (410).'
        : code === 409 ? 'Cette proposition a déjà été traitée (409).'
          : code === 404 ? 'Cette proposition est introuvable (404).'
            : roleAwareError(error, 'proposal')
      setProposalError(text)
      if (source === 'voice') updateMessage(resultMessage.id, { text, status: 'error' })
      else postAssistantMessage(text, { status: 'error' })
    } finally {
      proposalLockRef.current = false
      setProposalBusy(false)
    }
  }, [postAssistantMessage, proposal, proposalActive, updateMessage])

  const sendTextToAgent = useCallback(async (text, source = 'typed') => {
    const cleanText = String(text || '').trim()
    if (!cleanText || agentLockRef.current) return
    agentLockRef.current = true
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
      updateMessage(loadingMessage.id, { text: result?.reply || 'Aucune réponse fournie.', status: 'complete' })
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
    void handleText(text, engine)
  }, [agentBusy, captureState, draft, draftEngine, handleText])

  const newConversation = useCallback(() => {
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
      <main className="mx-auto w-full max-w-7xl space-y-5 px-1 sm:px-2" aria-labelledby="voice-page-title">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 id="voice-page-title" className="text-2xl font-semibold text-slate-900">Assistant vocal</h1>
            <p className="mt-1 text-sm text-slate-600">Parlez ou écrivez, relisez la transcription, puis envoyez-la à l’assistant IA.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              <Shield className="h-4 w-4 text-blue-600" />{ROLE_LABELS[role] || role}
            </span>
            <button type="button" onClick={newConversation} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <Plus className="h-4 w-4" />Nouvelle conversation
            </button>
          </div>
        </header>

        {(captureError || pendingError) && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{captureError || pendingError}</div>}
        {captureStatus && <p className="sr-only" aria-live="polite">{captureStatus}</p>}
        {pendingError && <p className="sr-only" aria-live="polite">{pendingError}</p>}
        {agentUnavailable && <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Agent IA indisponible.</strong> Le mode règles avec actions directes est désactivé. Réessayez plus tard ; toute écriture doit continuer à passer par une proposition et une confirmation explicite.</div></div>}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Conversation avec l’assistant">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-slate-900">Conversation</h2>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={autoSend} onChange={(event) => setAutoSend(event.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Envoyer automatiquement la transcription
              </label>
            </div>

            <div ref={chatRef} role="log" aria-live="polite" aria-relevant="additions text" className="flex max-h-[min(56vh,620px)] min-h-72 flex-col gap-4 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-5">
              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} aria-label={message.role === 'user' ? 'Votre message' : 'Réponse de l’assistant'}>
                  <div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[88%] ${message.role === 'user' ? 'rounded-br-md bg-blue-600 text-white' : message.status === 'error' ? 'rounded-bl-md border border-red-200 bg-red-50 text-red-900' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                    {message.status === 'loading' && <span className="mb-1 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{message.text}</span>}
                    {message.status !== 'loading' && (message.role === 'assistant' ? <SafeMarkdown>{message.text}</SafeMarkdown> : <p className="whitespace-pre-wrap break-words">{message.text}</p>)}
                    <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${message.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>
                      <time dateTime={new Date(message.time).toISOString()}>{formatTime(message.time)}</time>
                      {message.role === 'user' && message.engine && <span className="rounded-full bg-black/10 px-2 py-0.5">{message.engine === 'whisper' ? 'Whisper' : message.engine === 'browser' ? 'Navigateur' : 'Saisie'}</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {proposal && (
              <section className="mx-4 my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:mx-5" aria-labelledby="proposal-title">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id="proposal-title" className="font-semibold text-slate-900">Action proposée</h3>
                    <p className="mt-1 text-sm text-slate-700">{proposal.summary || proposal.spoken_summary}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{proposalStatusLabel}</span>
                </div>
                {proposal.preview != null && <div className="mt-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Aperçu complet de l’écriture</h4>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-amber-200 bg-white p-3 text-xs leading-5 text-slate-700">{typeof proposal.preview === 'string' ? proposal.preview : JSON.stringify(proposal.preview, null, 2)}</pre>
                </div>}
                {proposalActive && <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-900"><Clock3 className="h-4 w-4" />Expire dans {formatCountdown(secondsRemaining)}</p>}
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
                {proposal.status === 'executed' && proposalResult != null && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><h4 className="font-semibold">Résultat</h4><pre className="mt-1 whitespace-pre-wrap break-words text-xs">{JSON.stringify(proposalResult, null, 2)}</pre></div>}
              </section>
            )}

            {agentBusy && <p className="mx-5 mb-2 text-xs text-slate-500" aria-live="polite">L’assistant prépare sa réponse…</p>}
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-200 p-4 sm:p-5">
              <label htmlFor="voice-message" className="sr-only">Votre demande vocale ou textuelle</label>
              <textarea id="voice-message" ref={draftRef} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} disabled={agentBusy || captureState === 'recording' || captureState === 'transcribing'} placeholder="La transcription s’affichera ici. Relisez ou modifiez-la avant l’envoi…" className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100" />
              {draft.trim() && <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Moteur : {draftEngine === 'whisper' ? 'Whisper' : draftEngine === 'browser' ? 'Reconnaissance navigateur' : 'Saisie'}</span>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {captureState === 'recording' ? <>
                    <button type="button" onClick={() => stopRecording(false)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"><Square className="h-4 w-4" />Arrêter</button>
                    <button type="button" onClick={() => stopRecording(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"><X className="h-4 w-4" />Annuler l’enregistrement</button>
                  </> : captureState === 'browserListening' ? <button type="button" onClick={cancelBrowserFallback} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"><X className="h-4 w-4" />Annuler la reconnaissance</button> : <button type="button" onClick={() => void startRecording()} disabled={captureState === 'transcribing' || agentBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"><Mic className="h-4 w-4" />{captureState === 'transcribing' ? 'Transcription…' : 'Enregistrer'}</button>}
                  {captureState === 'transcribing' && <span className="inline-flex items-center gap-2 text-sm text-slate-600" aria-live="polite"><LoaderCircle className="h-4 w-4 animate-spin" />Whisper transcrit l’enregistrement…</span>}
                </div>
                <button type="submit" disabled={!draft.trim() || agentBusy || captureState === 'recording' || captureState === 'transcribing'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"><Send className="h-4 w-4" />Envoyer</button>
              </div>
              <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:justify-between">
                <span aria-live="polite">{captureStatus || (captureState === 'recording' ? 'Écoute en cours…' : 'L’audio n’est conservé ni dans le navigateur après fermeture, ni dans le journal de l’application.')}</span>
                <span>Durée maximale : {MAX_RECORDING_SECONDS} s</span>
              </div>
            </form>
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-semibold text-slate-900">Exemples de demandes</h2>
              <div className="mt-3 space-y-2">
                {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => { setDraft(example); setDraftEngine('typed'); draftRef.current?.focus() }} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">{example}</button>)}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Une demande d’écriture crée une proposition. La saisie automatique ne confirme jamais une écriture.</p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-semibold text-slate-900">États du service</h2>
              <p className="mt-2 text-sm text-slate-600">Transcription Whisper, puis envoi manuel du texte à l’agent. En cas d’indisponibilité, la reconnaissance navigateur (fr-FR) ou la saisie texte restent accessibles.</p>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">HTTPS est requis pour le microphone, sauf sur localhost. Toute écriture demande une confirmation par bouton ou par la commande vocale exacte « confirme » / « annule » lorsqu’une proposition non expirée est affichée.</div>
            </section>
          </aside>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="voice-history-title">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
            <div><h2 id="voice-history-title" className="font-semibold text-slate-900">Historique vocal existant</h2><p className="mt-1 text-xs text-slate-500">Texte et résultat uniquement. Aucun audio, jeton ou paramètre de configuration affiché.</p></div>
          </div>
          {historyError && <p role="alert" className="px-5 py-3 text-sm text-amber-800">{historyError}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Heure</th>{role === 'ADMIN' && <th className="px-4 py-3">Utilisateur</th>}<th className="px-4 py-3">Texte</th><th className="px-4 py-3">Intention</th><th className="px-4 py-3">Confiance</th><th className="px-4 py-3">Résultat</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? <tr><td colSpan={role === 'ADMIN' ? 6 : 5} className="px-4 py-8 text-center text-slate-500">Chargement de l’historique…</td></tr>
                  : history.length === 0 ? <tr><td colSpan={role === 'ADMIN' ? 6 : 5} className="px-4 py-8 text-center text-slate-500">Aucune ancienne commande enregistrée.</td></tr>
                    : history.map((entry) => <tr key={entry.id || `${entry.time}-${entry.text}`} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(entry.time)}</td>{role === 'ADMIN' && <td className="px-4 py-3 text-slate-700">{entry.user || '—'}</td>}<td className="max-w-sm whitespace-pre-wrap break-words px-4 py-3 text-slate-800">{entry.text}</td><td className="px-4 py-3 text-slate-700">{entry.intent}</td><td className="px-4 py-3 text-slate-600">{entry.confidence == null ? '—' : `${(entry.confidence * 100).toFixed(0)}%`}</td><td className="max-w-sm whitespace-pre-wrap break-words px-4 py-3 text-slate-600">{entry.result}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Layout>
  )
}
