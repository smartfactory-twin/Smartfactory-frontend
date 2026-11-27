import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext } from '../../context/AuthContext'
import VocalPage from '../../pages/vocal/VocalPage'
import * as voiceService from '../../services/voiceService'

vi.mock('../../components/layout/AdminLayout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../components/layout/TechnicianLayout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../components/layout/OperatorLayout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../services/voiceService', () => ({
  getVoiceCommandHistory: vi.fn(),
  saveVoiceCommand: vi.fn(),
  transcribeVoiceAudio: vi.fn(),
  sendVoiceAgentMessage: vi.fn(),
  getPendingVoiceProposals: vi.fn(),
  confirmVoiceProposal: vi.fn(),
  cancelVoiceProposal: vi.fn(),
}))

const PENDING = {
  id: 'proposal-1', status: 'pending', tool: 'acknowledge_alert',
  summary: 'Acquitter AL-000004', spoken_summary: 'Acquitter AL-000004',
  preview: { commentaire: 'pièce remplacée', alerte: 'AL-000004' },
  expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
}

let recorderInstances = []
let recognitionInstances = []
let stoppedTracks = []

class MockMediaRecorder {
  static isTypeSupported(type) { return type === 'audio/webm;codecs=opus' }
  constructor(_stream, options = {}) { this.mimeType = options.mimeType || 'audio/webm'; this.state = 'inactive'; recorderInstances.push(this) }
  start() { this.state = 'recording' }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) })
    this.onstop?.()
  }
}

class MockSpeechRecognition {
  constructor() { recognitionInstances.push(this) }
  start() { this.started = true }
  abort() { this.aborted = true; this.onend?.() }
}

function setupMedia({ getUserMedia = vi.fn().mockResolvedValue(null), browserSpeech = true, rejection = null } = {}) {
  const stream = { getTracks: () => [{ stop: () => stoppedTracks.push('stopped') }] }
  if (rejection) getUserMedia.mockRejectedValue(rejection)
  else getUserMedia.mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: MockMediaRecorder })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  if (browserSpeech) Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition })
  else Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined })
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined })
  return getUserMedia
}

function renderPage(role = 'ADMIN') {
  const value = { user: { id: 3, role }, isAuthenticated: true, isLoading: false }
  return render(<AuthContext.Provider value={value}><VocalPage /></AuthContext.Provider>)
}

async function stopCurrentRecording() {
  await userEvent.click(screen.getByRole('button', { name: /arrêter/i }))
}

async function startAndStop() {
  await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
  await screen.findByRole('button', { name: /arrêter/i })
  const startTime = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(startTime + 1000)
  await stopCurrentRecording()
  await waitFor(() => expect(voiceService.transcribeVoiceAudio).toHaveBeenCalled())
  clock.mockRestore()
}

async function enterTranscript(text) {
  voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text })
  await startAndStop()
  await waitFor(() => expect(screen.getByLabelText(/votre demande vocale ou textuelle/i)).toHaveValue(text))
}

beforeEach(() => {
  recorderInstances = []
  recognitionInstances = []
  stoppedTracks = []
  sessionStorage.clear()
  voiceService.getVoiceCommandHistory.mockResolvedValue([])
  voiceService.getPendingVoiceProposals.mockResolvedValue({ results: [] })
  voiceService.transcribeVoiceAudio.mockResolvedValue({ text: 'Lire les machines' })
  voiceService.sendVoiceAgentMessage.mockResolvedValue({ conversation_id: 'conv-1', reply: 'Voici les machines.' })
  voiceService.confirmVoiceProposal.mockResolvedValue({ proposal: { ...PENDING, status: 'executed' }, result: { ok: true } })
  voiceService.cancelVoiceProposal.mockResolvedValue({ proposal: { ...PENDING, status: 'cancelled' } })
})

afterEach(() => {
  vi.useRealTimers()
  delete navigator.mediaDevices
})

describe('Assistant vocal — enregistrement et transcription', () => {
  it('démarre, arrête, libère le micro et affiche une transcription modifiable sans l’envoyer automatiquement', async () => {
    const getUserMedia = setupMedia()
    renderPage()
    await enterTranscript('Lire les machines')
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(voiceService.transcribeVoiceAudio).toHaveBeenCalledTimes(1)
    expect(voiceService.sendVoiceAgentMessage).not.toHaveBeenCalled()
    expect(stoppedTracks).toContain('stopped')
    expect(screen.queryByText(/^Moteur : Whisper$/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenCalledWith('Lire les machines', null, 'voice'))
  }, 30_000)

  it('annule un enregistrement sans appeler la transcription', async () => {
    setupMedia()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    await screen.findByRole('button', { name: /annuler l’enregistrement/i })
    await userEvent.click(screen.getByRole('button', { name: /annuler l’enregistrement/i }))
    await waitFor(() => expect(screen.getAllByText(/aucun audio n’a été envoyé/i).length).toBeGreaterThan(0), { timeout: 10_000 })
    expect(voiceService.transcribeVoiceAudio).not.toHaveBeenCalled()
    expect(stoppedTracks).toContain('stopped')
  }, 15_000)

  it('affiche un message si la permission du microphone est refusée', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    setupMedia({ getUserMedia: vi.fn(), rejection: denied })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/accès au microphone refusé/i)
  })

  it('ignore les enregistrements trop courts', async () => {
    setupMedia()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    await screen.findByRole('button', { name: /arrêter/i })
    await stopCurrentRecording()
    expect(await screen.findByRole('alert')).toHaveTextContent(/trop court ou vide/i)
    expect(voiceService.transcribeVoiceAudio).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('arrête automatiquement au maximum de durée puis lance la transcription', async () => {
    setupMedia()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(voiceService.transcribeVoiceAudio).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it.each([
    [413, /dépasse la taille|trop gros/i],
    [429, /réessayez dans 7 s/i],
  ])('affiche l’erreur de transcription %s', async (code, expected) => {
    setupMedia()
    voiceService.transcribeVoiceAudio.mockRejectedValueOnce({
      response: { status: code, headers: { 'retry-after': '7' }, data: { detail: code === 413 ? 'Le fichier audio dépasse la taille maximale.' : 'Trop de demandes.' } },
    })
    renderPage()
    await startAndStop()
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(voiceService.sendVoiceAgentMessage).not.toHaveBeenCalled()
  })

  it('bascule de Whisper vers la reconnaissance navigateur sans envoi automatique', async () => {
    setupMedia()
    voiceService.transcribeVoiceAudio.mockRejectedValueOnce({ response: { status: 503, data: { code: 'transcription_unavailable' } } })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(recognitionInstances).toHaveLength(1))
    act(() => recognitionInstances[0].onresult({ results: [[{ transcript: 'Liste les machines' }]] }))
    expect(await screen.findByLabelText(/votre demande vocale ou textuelle/i)).toHaveValue('Liste les machines')
    expect(screen.queryByText(/^Moteur : Reconnaissance navigateur$/)).not.toBeInTheDocument()
    expect(voiceService.sendVoiceAgentMessage).not.toHaveBeenCalled()
  })

  it('bascule vers la saisie texte si la reconnaissance navigateur est absente', async () => {
    setupMedia({ browserSpeech: false })
    voiceService.transcribeVoiceAudio.mockRejectedValueOnce({ response: { status: 503 } })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(screen.getAllByText(/saisissez ou collez votre demande/i).length).toBeGreaterThan(0))
    expect(screen.getByLabelText(/votre demande vocale ou textuelle/i)).toBeEnabled()
  })

  it('envoie automatiquement seulement lorsque le réglage facultatif est activé', async () => {
    setupMedia()
    renderPage()
    await userEvent.click(screen.getByRole('checkbox', { name: /envoyer automatiquement/i }))
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: 'État de POMPE-002' })
    await startAndStop()
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenCalledWith('État de POMPE-002', null, 'voice'))
  })
})

describe('Assistant vocal — agent et propositions', () => {
  it('transmet le conversation_id conservé à la demande suivante', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText(/votre demande vocale ou textuelle/i), 'Première demande')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getByText('Voici les machines.')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/votre demande vocale ou textuelle/i), 'Deuxième demande')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenLastCalledWith('Deuxième demande', 'conv-1', 'text'))
  })

  it.each([
    [401, /session a expiré/i], [403, /rôle ne permet pas/i], [429, /trop de demandes/i],
    [503, /mode règles avec actions directes est désactivé/i],
  ])('affiche l’erreur agent %s sans exécuter une règle d’écriture', async (code, message) => {
    voiceService.sendVoiceAgentMessage.mockRejectedValueOnce({ response: { status: code, data: { detail: 'Indisponible' } } })
    renderPage()
    await userEvent.type(screen.getByLabelText(/votre demande vocale ou textuelle/i), 'Acquitte AL-000004')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0))
    if (code === 503) expect(screen.getByRole('alert')).toHaveTextContent(/mode règles avec actions directes est désactivé/i)
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
    expect(voiceService.cancelVoiceProposal).not.toHaveBeenCalled()
  })

  it('restaure une proposition, affiche son aperçu complet et son compte à rebours', async () => {
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    renderPage()
    expect(await screen.findByRole('heading', { name: /action proposée/i })).toBeInTheDocument()
    expect(screen.getByText(/pièce remplacée/i)).toBeInTheDocument()
    expect(screen.getByText(/expire dans/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirmer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
  })

  it('confirme une proposition et affiche le résultat', async () => {
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /confirmer/i }))
    await waitFor(() => expect(voiceService.confirmVoiceProposal).toHaveBeenCalledWith('proposal-1'))
    expect(await screen.findByText(/action exécutée après votre confirmation/i)).toBeInTheDocument()
    expect(screen.getAllByText(/résultat/i).length).toBeGreaterThan(0)
  })

  it('annule une proposition et n’appelle que la route d’annulation', async () => {
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /annuler/i }))
    await waitFor(() => expect(voiceService.cancelVoiceProposal).toHaveBeenCalledWith('proposal-1'))
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
    expect(screen.getByText('Annulée')).toBeInTheDocument()
  })

  it('ignore un double clic pendant la confirmation', async () => {
    let finish
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    voiceService.confirmVoiceProposal.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    renderPage()
    const button = await screen.findByRole('button', { name: /confirmer/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(voiceService.confirmVoiceProposal).toHaveBeenCalledTimes(1)
    await act(async () => finish({ proposal: { ...PENDING, status: 'executed' }, result: { ok: true } }))
  })

  it.each([
    [404, 'Introuvable', { detail: 'missing' }],
    [409, 'Déjà traitée', { detail: 'done' }],
    [410, 'Expirée', { detail: 'expired' }],
  ])('affiche l’état de proposition après la réponse %s', async (code, label, data) => {
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    voiceService.confirmVoiceProposal.mockRejectedValueOnce({ response: { status: code, data } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /confirmer/i }))
    expect(await screen.findByText(label)).toBeInTheDocument()
  })

  it('masque les boutons lorsque la proposition a expiré', async () => {
    const expired = { ...PENDING, expires_at: new Date(Date.now() + 1000).toISOString() }
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [expired] })
    vi.useFakeTimers()
    renderPage()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByRole('heading', { name: /action proposée/i })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(screen.getByText('Expirée')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmer/i })).not.toBeInTheDocument()
  })
})

describe('Assistant vocal — confirmation vocale exacte', () => {
  it.each(['confirme', 'je confirme'])('confirme par transcription sur la phrase exacte « %s »', async (phrase) => {
    setupMedia()
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: phrase })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(voiceService.confirmVoiceProposal).toHaveBeenCalledWith('proposal-1'))
    expect(voiceService.sendVoiceAgentMessage).not.toHaveBeenCalled()
  })

  it.each(['annule', 'J’annule !'])('annule par transcription exacte « %s »', async (phrase) => {
    setupMedia()
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: phrase })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(voiceService.cancelVoiceProposal).toHaveBeenCalledWith('proposal-1'))
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
  })

  it('envoie « confirme » à l’agent lorsqu’aucune proposition n’est visible', async () => {
    setupMedia()
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: 'confirme' })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenCalledWith('confirme', null, 'voice'))
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
  })

  it.each(['oui', 'je confirme cette intervention'])('ne traite pas « %s » comme une confirmation vocale exacte', async (phrase) => {
    setupMedia()
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [PENDING] })
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: phrase })
    renderPage()
    await startAndStop()
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
    expect(voiceService.sendVoiceAgentMessage).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/votre demande vocale ou textuelle/i)).toHaveValue(phrase)
  })

  it('n’exécute pas la confirmation vocale si la proposition a expiré', async () => {
    setupMedia()
    voiceService.getPendingVoiceProposals.mockResolvedValueOnce({ results: [{ ...PENDING, expires_at: new Date(Date.now() - 1000).toISOString() }] })
    voiceService.transcribeVoiceAudio.mockResolvedValueOnce({ text: 'confirme' })
    renderPage()
    await startAndStop()
    await waitFor(() => expect(voiceService.sendVoiceAgentMessage).toHaveBeenCalledWith('confirme', null, 'voice'))
    expect(voiceService.confirmVoiceProposal).not.toHaveBeenCalled()
  })
})
