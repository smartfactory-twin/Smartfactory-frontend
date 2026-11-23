import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getVoiceSessionConfig,
  sendVoiceAgentMessage,
  streamVoiceAgentMessage,
  transcribeVoiceSessionAudio,
} from '../../services/voiceService'
import { selectRecordingMimeType } from './voiceAssistantUtils'
import {
  calculateRms,
  classifyRealtimeTranscript,
  createSpeechQueue,
  createVadState,
  isUsableAudioSegment,
  observeVad,
  REALTIME_VOICE_LIMITS,
  WHISPER_SILENCE_HALLUCINATIONS,
} from './realtimeVoiceUtils'

const initialStatus = { phase: 'idle', message: 'Conversation vocale inactive.' }

function secureContextAvailable() {
  return window.isSecureContext === true || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function apiErrorMessage(error) {
  const status = error?.response?.status
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour reprendre la conversation vocale.'
  if (status === 403) return 'Votre rôle ne permet pas cette action.'
  if (status === 429) {
    const retryAfter = Number(error?.response?.headers?.['retry-after'])
    return `Limite de demandes atteinte. Écoute en pause${Number.isFinite(retryAfter) && retryAfter > 0 ? ` pendant ${Math.ceil(retryAfter)} secondes` : ''}.`
  }
  if (status === 503) return 'Le service vocal est temporairement indisponible. Vous pouvez réessayer ou utiliser le mode texte.'
  return 'La conversation vocale a rencontré une erreur. Réessayez ou utilisez le mode texte.'
}

export default function useRealtimeVoiceSession({
  getProposal = () => null,
  onUserTranscript = () => {},
  onAssistantSentence = () => {},
  onAssistantReset = () => {},
  onAssistantDone = () => {},
  onProposal = () => {},
  onDownload = () => {},
  onProposalAction = async () => {},
  onStatus = () => {},
  onError = () => {},
  limits = REALTIME_VOICE_LIMITS,
  hallucinations = WHISPER_SILENCE_HALLUCINATIONS,
} = {}) {
  const [status, setStatus] = useState(initialStatus)
  const [transcript, setTranscript] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [micOpen, setMicOpen] = useState(false)
  const refs = useRef({})

  refs.current.callbacks = { getProposal, onUserTranscript, onAssistantSentence, onAssistantReset, onAssistantDone, onProposal, onDownload, onProposalAction, onStatus, onError, hallucinations }
  refs.current.isActive ??= false
  refs.current.isSpeaking ??= false
  refs.current.isProcessing ??= false
  refs.current.vad ??= createVadState()
  refs.current.conversationId ??= null

  const publishStatus = useCallback((phase, message) => {
    const next = { phase, message }
    setStatus(next)
    refs.current.callbacks.onStatus(next)
  }, [])

  const stopSession = useCallback((reason = 'Conversation vocale arrêtée.') => {
    const state = refs.current
    state.isActive = false
    state.isProcessing = false
    state.isStarting = false
    setIsStarting(false)
    state.startToken = (state.startToken || 0) + 1
    setSessionActive(false)
    setMicOpen(false)
    state.abortController?.abort()
    state.abortController = null
    state.transcriptionController?.abort()
    state.transcriptionController = null
    state.speechQueue?.clear()
    state.speechQueue = null
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame)
    state.animationFrame = null
    for (const timer of [state.sessionTimer, state.silenceTimer, state.pauseTimer]) {
      if (timer) clearTimeout(timer)
    }
    state.sessionTimer = null
    state.silenceTimer = null
    state.pauseTimer = null
    try {
      state.recorder?.stop?.()
    } catch { /* Le MediaRecorder peut être arrêté par son événement stop. */ }
    state.recorder = null
    state.recordingChunks = []
    state.audioSource?.disconnect?.()
    state.analyser?.disconnect?.()
    state.audioSource = null
    state.analyser = null
    state.audioContext?.close?.().catch?.(() => {})
    state.audioContext = null
    state.stream?.getTracks?.().forEach((track) => track.stop())
    state.stream = null
    state.vad = createVadState()
    state.isSpeaking = false
    publishStatus('idle', reason)
  }, [publishStatus])

  const say = useCallback((text) => {
    const queue = refs.current.speechQueue
    if (!queue || !text) return
    refs.current.isSpeaking = true
    queue.enqueue(text)
  }, [])

  const processTranscript = useCallback(async (recognizedText) => {
    const state = refs.current
    const cleanText = String(recognizedText || '').trim()
    setTranscript(cleanText)
    const proposal = refs.current.callbacks.getProposal()
    const command = classifyRealtimeTranscript(cleanText, proposal, Date.now(), refs.current.callbacks.hallucinations)
    if (command === 'ignore') {
      publishStatus('listening', 'Aucune demande reconnue. Je continue l’écoute.')
      return
    }
    refs.current.callbacks.onUserTranscript(cleanText)

    if (command === 'confirm' || command === 'cancel') {
      publishStatus('thinking', command === 'confirm' ? 'Confirmation vocale…' : 'Annulation vocale…')
      try {
        const result = await refs.current.callbacks.onProposalAction(command)
        say(result?.speech || result?.message || (command === 'confirm' ? 'C’est fait. L’action a été confirmée.' : 'La proposition a été annulée.'))
      } catch (error) {
        const message = apiErrorMessage(error)
        refs.current.callbacks.onError(message)
        say(message)
      }
      return
    }

    publishStatus('thinking', 'Je prépare une réponse…')
    const controller = new AbortController()
    state.abortController = controller
    let completed = false
    let streamedSpeech = false
    const handleSentence = (speech) => {
      if (!speech || controller.signal.aborted) return
      streamedSpeech = true
      refs.current.callbacks.onAssistantSentence(speech)
      say(speech)
      publishStatus('speaking', 'L’assistant répond. Parlez plus fort pour l’interrompre.')
    }
    const handleProposal = (nextProposal) => {
      refs.current.callbacks.onProposal(nextProposal)
      if (nextProposal?.spoken_summary) {
        refs.current.callbacks.onAssistantSentence(nextProposal.spoken_summary)
        say(nextProposal.spoken_summary)
      }
    }
    try {
      const result = await streamVoiceAgentMessage(cleanText, state.conversationId, {
        signal: controller.signal,
        onTool: () => publishStatus('thinking', 'Je vérifie les informations…'),
        onSentence: handleSentence,
        onProposal: handleProposal,
        onDownload: (download) => refs.current.callbacks.onDownload(download),
        onDone: (done) => {
          completed = true
          if (done?.conversation_id) state.conversationId = done.conversation_id
          refs.current.callbacks.onAssistantDone(done)
        },
      })
      if (!completed && result?.conversation_id) state.conversationId = result.conversation_id
    } catch (streamError) {
      if (controller.signal.aborted || !state.isActive) return
      state.speechQueue?.clear()
      state.isSpeaking = false
      streamedSpeech = false
      refs.current.callbacks.onAssistantReset()
      publishStatus('thinking', 'Le flux vocal est indisponible ; je réessaie sans diffusion…')
      try {
        const result = await sendVoiceAgentMessage(cleanText, state.conversationId, 'voice')
        if (result?.conversation_id) state.conversationId = result.conversation_id
        if (result?.proposal) handleProposal(result.proposal)
        if (result?.download) refs.current.callbacks.onDownload(result.download)
        const speech = result?.speech || ''
        if (speech) handleSentence(speech)
        refs.current.callbacks.onAssistantDone(result)
        completed = true
      } catch (fallbackError) {
        if (controller.signal.aborted || !state.isActive) return
        const message = apiErrorMessage(fallbackError || streamError)
        refs.current.callbacks.onError(message)
        say(message)
      }
    } finally {
      if (state.abortController === controller) state.abortController = null
      state.isProcessing = false
      if (state.isActive) publishStatus(streamedSpeech ? 'speaking' : 'listening', completed ? 'Réponse terminée. Je continue l’écoute.' : 'Écoute en cours.')
    }
  }, [publishStatus, say])

  const startSession = useCallback(async () => {
    if (refs.current.isActive || refs.current.isStarting) return
    if (!secureContextAvailable()) {
      publishStatus('error', 'Le microphone nécessite HTTPS ou localhost.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.AudioContext) {
      publishStatus('error', 'Ce navigateur ne prend pas en charge l’enregistrement temps réel. Utilisez le mode texte.')
      return
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      publishStatus('error', 'La synthèse vocale n’est pas disponible. Utilisez le mode texte ou la dictée classique.')
      return
    }

    publishStatus('thinking', 'Préparation de la session vocale…')
    refs.current.isStarting = true
    setIsStarting(true)
    const startToken = (refs.current.startToken || 0) + 1
    refs.current.startToken = startToken
    let mediaStream
    try {
      const config = await getVoiceSessionConfig()
      if (refs.current.startToken !== startToken) return
      const maximumSeconds = Math.max(1, Number(config?.max_seconds) || 300)
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (refs.current.startToken !== startToken) {
        mediaStream.getTracks?.().forEach((track) => track.stop())
        return
      }
      const context = new window.AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      const source = context.createMediaStreamSource(mediaStream)
      source.connect(analyser)

      const state = refs.current
      state.isActive = true
      state.isStarting = false
      setIsStarting(false)
      state.stream = mediaStream
      state.audioContext = context
      state.audioSource = source
      state.analyser = analyser
      state.sessionStartedAt = Date.now()
      state.lastActivityAt = Date.now()
      state.vad = createVadState()
      state.audioBuffer = new Uint8Array(analyser.fftSize)
      state.conversationId = null
      state.speechQueue = createSpeechQueue({
        synthesis: window.speechSynthesis,
        Utterance: window.SpeechSynthesisUtterance,
        onStart: () => { state.isSpeaking = true; publishStatus('speaking', 'L’assistant parle. Parlez clairement pour l’interrompre.') },
        onEnd: () => {
          state.isSpeaking = false
          if (state.isActive && !state.abortController) publishStatus('listening', 'Micro ouvert. Vous pouvez parler.')
        },
      })
      setSessionActive(true)
      setMicOpen(true)
      state.sessionTimer = window.setTimeout(() => stopSession('Durée maximale atteinte. La session vocale a été arrêtée.'), maximumSeconds * 1000)

      const finishRecording = () => {
        const recorder = state.recorder
        if (!recorder || recorder.state === 'inactive') return
        state.recordingDuration = Date.now() - state.recordingStartedAt
        state.recordingSpeechDuration = state.detectedSpeechDuration
        try { recorder.stop() } catch { /* Le recorder peut déjà être arrêté. */ }
      }
      const beginRecording = (interrupted = false) => {
        if (!state.isActive || state.recorder?.state === 'recording') return
        if (interrupted) {
          state.speechQueue?.clear()
          state.abortController?.abort()
          state.abortController = null
          state.isSpeaking = false
          publishStatus('speech_detected', 'Interruption détectée. Je vous écoute…')
        } else {
          publishStatus('speech_detected', 'Parole détectée. Enregistrement de la phrase…')
        }
        const mimeType = selectRecordingMimeType(window.MediaRecorder)
        const recorder = mimeType ? new window.MediaRecorder(state.stream, { mimeType }) : new window.MediaRecorder(state.stream)
        state.recorder = recorder
        state.recordingChunks = []
        state.recordingStartedAt = Date.now()
        state.detectedSpeechDuration = 0
        recorder.ondataavailable = (event) => { if (event.data?.size) state.recordingChunks.push(event.data) }
        recorder.onerror = () => {
          state.recordingChunks = []
          state.recorder = null
          publishStatus('error', 'L’enregistrement de la phrase a échoué. Je continue l’écoute.')
        }
        recorder.onstop = async () => {
          const chunks = state.recordingChunks || []
          state.recordingChunks = []
          state.recorder = null
          const duration = state.recordingSpeechDuration ?? state.detectedSpeechDuration
          state.recordingDuration = 0
          state.recordingSpeechDuration = 0
          state.detectedSpeechDuration = 0
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
          if (!state.isActive || !isUsableAudioSegment(duration, blob.size, limits)) {
            if (state.isActive) publishStatus('listening', 'Phrase trop courte ou silencieuse ignorée. Je continue l’écoute.')
            return
          }
          state.isProcessing = true
          publishStatus('transcribing', 'Transcription de votre phrase…')
          state.transcriptionController = new AbortController()
          try {
            const result = await transcribeVoiceSessionAudio(blob, { signal: state.transcriptionController.signal })
            if (!state.isActive) return
            setTranscript(String(result?.text || '').trim())
            state.lastActivityAt = Date.now()
            try { await processTranscript(result?.text) } finally { state.isProcessing = false }
          } catch (error) {
            state.isProcessing = false
            if (!state.isActive) return
            if (error?.response?.status === 429) {
              const delay = Math.max(1, Number(error?.response?.headers?.['retry-after']) || 60)
              publishStatus('error', apiErrorMessage(error))
              state.pauseTimer = window.setTimeout(() => {
                state.pauseTimer = null
                if (state.isActive) publishStatus('listening', 'Le délai est passé. Vous pouvez parler à nouveau.')
              }, delay * 1000)
            } else {
              const message = apiErrorMessage(error)
              publishStatus('error', message)
              refs.current.callbacks.onError(message)
            }
          } finally {
            state.transcriptionController = null
          }
        }
        recorder.start()
      }
      state.beginRecording = beginRecording
      state.finishRecording = finishRecording
      state.silenceTimer = window.setInterval(() => {
        if (state.isActive && Date.now() - state.lastActivityAt >= limits.prolongedSilenceMs) {
          stopSession('Session terminée après une longue période de silence.')
        }
      }, 1000)

      const detect = () => {
        if (!state.isActive) return
        analyser.getByteTimeDomainData(state.audioBuffer)
        const level = calculateRms(state.audioBuffer)
        if (state.isSpeaking) {
          const started = observeVad(state.vad, level, Date.now(), {
            speechThreshold: limits.interruptionThreshold,
            silenceMs: limits.silenceMs,
          })
          if (started === 'start') beginRecording(true)
          else if (state.vad.startedAt != null && level < limits.interruptionThreshold) {
            const finished = observeVad(state.vad, 0, Date.now(), {
              speechThreshold: limits.interruptionThreshold,
              silenceMs: limits.silenceMs,
            })
            if (finished?.type === 'finish') {
              state.detectedSpeechDuration = finished.durationMs
              finishRecording()
            }
          }
        } else if (state.pauseTimer == null && !state.isProcessing) {
          const event = observeVad(state.vad, level, Date.now(), limits)
          if (event === 'start') {
            state.lastActivityAt = Date.now()
            beginRecording(false)
          } else if (event?.type === 'finish') {
            state.lastActivityAt = Date.now()
            state.detectedSpeechDuration = event.durationMs
            finishRecording()
          }
        }
        state.animationFrame = requestAnimationFrame(detect)
      }
      publishStatus('listening', 'Micro ouvert. Parlez naturellement ; je détecte les pauses entre vos phrases.')
      state.animationFrame = requestAnimationFrame(detect)
    } catch (error) {
      if (refs.current.startToken !== startToken) return
      refs.current.isStarting = false
      setIsStarting(false)
      mediaStream?.getTracks?.().forEach((track) => track.stop())
      const message = error?.name === 'NotAllowedError'
        ? 'Accès au microphone refusé. Autorisez le microphone dans le navigateur.'
        : error?.name === 'NotFoundError'
          ? 'Aucun microphone détecté.'
          : apiErrorMessage(error)
      refs.current.callbacks.onError(message)
      publishStatus('error', message)
    }
  }, [limits, processTranscript, publishStatus, stopSession])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && (refs.current.isActive || refs.current.isStarting)) stopSession()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      stopSession('Session fermée. Micro et synthèse arrêtés.')
    }
  }, [stopSession])

  return { status, transcript, sessionActive, isStarting, micOpen, startSession, stopSession }
}
