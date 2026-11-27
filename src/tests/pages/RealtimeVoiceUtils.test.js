import { describe, expect, it, vi } from 'vitest'
import {
  calculateRms,
  REALTIME_VOICE_LIMITS,
  classifyRealtimeTranscript,
  createSpeechQueue,
  createVadState,
  flushSseFrame,
  isIgnorableTranscript,
  isSpeechSynthesisAvailable,
  isUsableAudioSegment,
  observeVad,
  parseSseFrames,
  splitSpeechIntoShortChunks,
} from '../../pages/vocal/realtimeVoiceUtils'

const proposal = (expiresAt = Date.now() + 60_000) => ({ status: 'pending', expires_at: new Date(expiresAt).toISOString() })

describe('realtime voice helpers', () => {
  it('detects a phrase after speech followed by the configured silence', () => {
    const state = createVadState()
    expect(observeVad(state, 0.08, 1000)).toBe('start')
    expect(observeVad(state, 0.08, 1500)).toBeNull()
    expect(observeVad(state, 0, 2399, { silenceMs: 900 })).toBeNull()
    expect(observeVad(state, 0, 2400, { silenceMs: 900 })).toEqual({ type: 'finish', durationMs: 500 })
  })

  it('does not start a segment on silence alone', () => {
    const state = createVadState()
    expect(observeVad(state, 0, 1000)).toBeNull()
    expect(observeVad(state, 0, 3000)).toBeNull()
  })

  it('measures audio level and rejects segments below duration or byte thresholds', () => {
    expect(calculateRms(new Uint8Array([128, 128, 128]))).toBe(0)
    expect(calculateRms(new Uint8Array([255, 0]))).toBeGreaterThan(0.9)
    expect(isUsableAudioSegment(REALTIME_VOICE_LIMITS.minimumSpeechMs - 1, REALTIME_VOICE_LIMITS.minimumAudioBytes)).toBe(false)
    expect(isUsableAudioSegment(REALTIME_VOICE_LIMITS.minimumSpeechMs, REALTIME_VOICE_LIMITS.minimumAudioBytes - 1)).toBe(false)
    expect(isUsableAudioSegment(REALTIME_VOICE_LIMITS.minimumSpeechMs, REALTIME_VOICE_LIMITS.minimumAudioBytes)).toBe(true)
  })

  it('ignores empty, punctuation-only and common Whisper silence hallucinations', () => {
    for (const transcript of ['', '   ', '…?!', 'Merci de votre attention.', 'Sous-titres réalisés par la communauté']) {
      expect(isIgnorableTranscript(transcript)).toBe(true)
    }
    expect(isIgnorableTranscript('Quelles alertes sont actives ?')).toBe(false)
  })

  it('only confirms or cancels a full explicit phrase for a live proposal', () => {
    const pending = proposal()
    expect(classifyRealtimeTranscript('confirme', pending)).toBe('confirm')
    expect(classifyRealtimeTranscript('Je confirme', pending)).toBe('confirm')
    expect(classifyRealtimeTranscript('annule', pending)).toBe('cancel')
    expect(classifyRealtimeTranscript('J’annule', pending)).toBe('cancel')
    expect(classifyRealtimeTranscript('oui', pending)).toBe('ignore')
    expect(classifyRealtimeTranscript('confirme et liste les machines', pending)).toBe('ignore')
    expect(classifyRealtimeTranscript('confirme', proposal(Date.now() - 1))).toBe('ignore')
    expect(classifyRealtimeTranscript('liste les machines', proposal(Date.now() - 1))).toBe('agent')
    expect(classifyRealtimeTranscript('confirme', null)).toBe('agent')
    expect(classifyRealtimeTranscript('liste les machines', pending)).toBe('agent')
  })

  it('parses complete SSE events and carries event state across cut chunks', () => {
    let state = { eventName: 'message', data: [] }
    let first = parseSseFrames('', 'event: sentence\ndata: {"spe', state)
    expect(first.events).toEqual([])
    state = first.state
    const second = parseSseFrames(first.remainder, 'ech":"Bonjour."}\n\nevent: error\ndata: {"code":"down', state)
    expect(second.events).toEqual([{ event: 'sentence', data: '{"speech":"Bonjour."}' }])
    const last = parseSseFrames(second.remainder, 'stream"}\n\n', second.state)
    expect(last.events).toEqual([{ event: 'error', data: '{"code":"downstream"}' }])
    expect(flushSseFrame(last.state)).toEqual([])
  })

  it('flushes an unterminated final SSE event and ignores comments', () => {
    const parsed = parseSseFrames('', ': keepalive\nevent: done\ndata: {"ok":true}', { eventName: 'message', data: [] })
    expect(parsed.events).toEqual([])
    expect(flushSseFrame(parsed)).toEqual([{ event: 'done', data: '{"ok":true}' }])
  })

  it('splits long speech into short chunks without changing order', () => {
    const chunks = splitSpeechIntoShortChunks('Première phrase. Deuxième phrase très longue qui doit être coupée sans perdre les mots.', 28)
    expect(chunks.join(' ')).toContain('Première phrase. Deuxième phrase très longue qui doit être coupée sans perdre les mots.')
    expect(chunks.every((chunk) => chunk.length <= 28)).toBe(true)
  })

  it('speaks queued phrases in order and clears the queue on interruption', () => {
    class Utterance { constructor(text) { this.text = text } }
    const spoken = []
    const synthesis = { getVoices: () => [{ lang: 'fr-FR' }], speak: (utterance) => { spoken.push(utterance); utterance.onstart?.() }, cancel: vi.fn() }
    const queue = createSpeechQueue({ synthesis, Utterance })
    queue.enqueue('Première phrase.')
    queue.enqueue('Deuxième phrase.')
    expect(spoken.map((item) => item.text)).toEqual(['Première phrase.'])
    spoken[0].onend()
    expect(spoken.map((item) => item.text)).toEqual(['Première phrase.', 'Deuxième phrase.'])
    queue.clear()
    expect(synthesis.cancel).toHaveBeenCalledOnce()
    expect(queue.pendingCount).toBe(0)
  })

  it('reports when the browser has no speech synthesis', () => {
    expect(isSpeechSynthesisAvailable({})).toBe(false)
    expect(isSpeechSynthesisAvailable({ speechSynthesis: {}, SpeechSynthesisUtterance: function Utterance() {} })).toBe(true)
  })
})
