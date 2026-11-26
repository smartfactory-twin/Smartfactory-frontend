import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useRealtimeVoiceSession from '../../pages/vocal/useRealtimeVoiceSession'
import * as voiceService from '../../services/voiceService'

vi.mock('../../services/voiceService', () => ({
  getVoiceSessionConfig: vi.fn(),
  transcribeVoiceSessionAudio: vi.fn(),
  streamVoiceAgentMessage: vi.fn(),
  sendVoiceAgentMessage: vi.fn(),
}))

let sample = 128
let now = 1000
let animationFrames = []
let recorders = []
let stoppedTracks = 0
let utterances = []

class MockRecorder {
  static isTypeSupported(type) { return type === 'audio/webm;codecs=opus' }
  constructor(_stream, options = {}) { this.mimeType = options.mimeType || 'audio/webm'; this.state = 'inactive'; recorders.push(this) }
  start() { this.state = 'recording' }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) })
    void this.onstop?.()
  }
}

class MockUtterance { constructor(text) { this.text = text } }
class MockAudioContext {
  constructor() { this.state = 'running' }
  createAnalyser() { return { fftSize: 1024, connect: vi.fn(), disconnect: vi.fn(), getByteTimeDomainData: (buffer) => buffer.fill(sample) } }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
  close() { this.state = 'closed'; return Promise.resolve() }
}

function Harness({ proposal = null, onAction = vi.fn(), limits }) {
  const session = useRealtimeVoiceSession({ getProposal: () => proposal, onProposalAction: onAction, ...(limits ? { limits } : {}) })
  return <div>
    <button onClick={() => void session.startSession()}>start</button>
    <button onClick={() => session.stopSession()}>stop</button>
    <output data-testid="phase">{session.status.phase}</output>
    <output data-testid="status">{session.status.message}</output>
    <output data-testid="mic">{String(session.micOpen)}</output>
    <output data-testid="transcript">{session.transcript}</output>
  </div>
}

function runFrame(value, time) {
  sample = value
  now = time
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const next = animationFrames.shift()
  if (next) act(() => next())
}

async function startSession() {
  fireEvent.click(screen.getByText('start'))
  await waitFor(() => expect(screen.getByTestId('mic')).toHaveTextContent('true'))
}

async function saySegment(text) {
  runFrame(220, now + 1)
  runFrame(220, now + 600)
  runFrame(128, now + 1600)
  await waitFor(() => expect(voiceService.transcribeVoiceSessionAudio).toHaveBeenCalled())
  voiceService.transcribeVoiceSessionAudio.mockClear()
  return text
}

beforeEach(() => {
  sample = 128
  now = 1000
  animationFrames = []
  recorders = []
  stoppedTracks = 0
  utterances = []
  vi.restoreAllMocks()
  voiceService.getVoiceSessionConfig.mockResolvedValue({ max_seconds: 300 })
  voiceService.transcribeVoiceSessionAudio.mockResolvedValue({ text: 'Liste les machines' })
  voiceService.streamVoiceAgentMessage.mockImplementation(async (_text, _id, options) => {
    options.onSentence('Voici les machines.')
    const result = { conversation_id: 'conversation-1', reply: 'Voici les machines.', tools_called: ['search_machines'] }
    options.onDone(result)
    return result
  })
  voiceService.sendVoiceAgentMessage.mockResolvedValue({ conversation_id: 'conversation-1', reply: 'Réponse de secours.', speech: 'Réponse de secours.' })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => { stoppedTracks += 1 } }] }) } })
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: MockRecorder })
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'fr-FR' }], speak: (utterance) => { utterances.push(utterance); utterance.onstart?.() }, cancel: vi.fn() } })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
  vi.stubGlobal('requestAnimationFrame', (callback) => { animationFrames.push(callback); return animationFrames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => { vi.useRealTimers() })

describe('real-time voice session', () => {
  it('opens the microphone, shows the live state and releases all media resources on stop', async () => {
    render(<Harness />)
    await startSession()
    expect(voiceService.getVoiceSessionConfig).toHaveBeenCalledOnce()
    expect(screen.getByTestId('phase')).toHaveTextContent('listening')
    fireEvent.click(screen.getByText('stop'))
    expect(screen.getByTestId('mic')).toHaveTextContent('false')
    expect(stoppedTracks).toBe(1)
  })

  it('records a speech segment after speech and silence, transcribes it, and sends it through SSE', async () => {
    render(<Harness />)
    await startSession()
    runFrame(220, 1100)
    runFrame(220, 1600)
    runFrame(128, 2600)
    await waitFor(() => expect(voiceService.streamVoiceAgentMessage).toHaveBeenCalledWith('Liste les machines', null, expect.objectContaining({ signal: expect.any(AbortSignal) })))
    expect(voiceService.transcribeVoiceSessionAudio).toHaveBeenCalledOnce()
    expect(utterances[0]?.text).toBe('Voici les machines.')
  })

  it('falls back to the non-streaming agent call when the SSE request fails', async () => {
    voiceService.streamVoiceAgentMessage.mockRejectedValueOnce(new Error('stream ended'))
    render(<Harness />)
    await startSession()
    runFrame(220, 1100)
    runFrame(220, 1600)
    runFrame(128, 2600)
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenCalledWith('Liste les machines', null, 'voice'))
    expect(utterances.some((item) => item.text === 'Réponse de secours.')).toBe(true)
  })

  it('ignores a short transient sound instead of sending it to transcription', async () => {
    render(<Harness />)
    await startSession()
    runFrame(220, 1100)
    runFrame(128, 2100)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(/trop courte ou silencieuse ignorée/i))
    expect(voiceService.transcribeVoiceSessionAudio).not.toHaveBeenCalled()
  })

  it('uses explicit confirmation only for an active proposal; other proposal commands do not reach the agent', async () => {
    const onAction = vi.fn().mockResolvedValue('C’est fait.')
    voiceService.transcribeVoiceSessionAudio.mockResolvedValue({ text: 'je confirme' })
    render(<Harness proposal={{ id: 'p-1', status: 'pending', expires_at: new Date(Date.now() + 60_000).toISOString() }} onAction={onAction} />)
    await startSession()
    runFrame(220, 1100)
    runFrame(220, 1600)
    runFrame(128, 2600)
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('confirm'))
    expect(voiceService.streamVoiceAgentMessage).not.toHaveBeenCalled()
  })

  it('does not interrupt assistant speech for low-level echo, but barge-in cancels speech and the stream', async () => {
    let signal
    voiceService.streamVoiceAgentMessage.mockImplementation((_text, _id, options) => {
      signal = options.signal
      options.onSentence('Réponse en cours.')
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    })
    render(<Harness />)
    await startSession()
    runFrame(220, 1100)
    runFrame(220, 1600)
    runFrame(128, 2600)
    await waitFor(() => expect(voiceService.streamVoiceAgentMessage).toHaveBeenCalled())
    runFrame(145, 2700)
    expect(signal.aborted).toBe(false)
    expect(voiceService.transcribeVoiceSessionAudio).toHaveBeenCalledTimes(1)
    runFrame(255, 2800)
    expect(signal.aborted).toBe(true)
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
  })

  it('ignores Whisper 429 temporarily and announces the pause', async () => {
    const throttled = new Error('rate limited')
    throttled.response = { status: 429, headers: { 'retry-after': '3' } }
    voiceService.transcribeVoiceSessionAudio.mockRejectedValueOnce(throttled)
    render(<Harness />)
    await startSession()
    runFrame(220, 1100)
    runFrame(220, 1600)
    runFrame(128, 2600)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('pendant 3 secondes'))
    expect(voiceService.streamVoiceAgentMessage).not.toHaveBeenCalled()
  })

  it('stops automatically at the configured session maximum', async () => {
    vi.useFakeTimers()
    voiceService.getVoiceSessionConfig.mockResolvedValue({ max_seconds: 2 })
    render(<Harness />)
    await act(async () => { await fireEvent.click(screen.getByText('start')) })
    expect(screen.getByTestId('mic')).toHaveTextContent('true')
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByTestId('mic')).toHaveTextContent('false')
    expect(screen.getByTestId('status')).toHaveTextContent('Durée maximale atteinte')
    vi.useRealTimers()
  })

  it('stops after the configured prolonged silence and says why', async () => {
    vi.useFakeTimers()
    render(<Harness limits={{ prolongedSilenceMs: 2000 }} />)
    await act(async () => { await fireEvent.click(screen.getByText('start')) })
    expect(screen.getByTestId('mic')).toHaveTextContent('true')
    now += 5000
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByTestId('mic')).toHaveTextContent('false')
    expect(screen.getByTestId('status')).toHaveTextContent(/longue période de silence/i)
    vi.useRealTimers()
  })

  it('falls back to text when speech synthesis is unsupported', async () => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
    render(<Harness />)
    fireEvent.click(screen.getByText('start'))
    expect(screen.getByTestId('phase')).toHaveTextContent('error')
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
    expect(screen.getByTestId('status')).toHaveTextContent(/synthèse vocale n’est pas disponible/i)
  })
})
