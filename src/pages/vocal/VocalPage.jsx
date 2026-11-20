import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Send, Volume2, MessageSquare, Shield, Info, Check, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import { getMachines } from '../../services/machineService'
import { getCapteurs, getReadings } from '../../services/sensorService'
import { acknowledgeAlert, getAlerts } from '../../services/alertService'
import { createWorkOrder, getWorkOrder, submitReport, updateWorkOrderStatus } from '../../services/workOrderService'
import { getVoiceCommandHistory, saveVoiceCommand } from '../../services/voiceService'
import { formatNullableThreshold } from '../../utils/sensorDisplay'

const PIPELINE_STEPS = [
  { num: 1, label: 'Micro / texte' },
  { num: 2, label: 'Reconnaissance navigateur' },
  { num: 3, label: 'Intentions par règles' },
  { num: 4, label: 'Données et rôles' },
  { num: 5, label: 'Confirmation' },
  { num: 6, label: 'Synthèse navigateur' },
]

const EXAMPLES = [
  'Quel est l\'état de la machine M20 ?',
  'Combien d\'heures restent avant la panne de M18 ?',
  'Lis-moi les alertes critiques',
  'Quelle est la température du moteur de M17 ?',
  'Acquitte l\'alerte 245, vérifié sur place',
  'Crée un ordre de travail correctif pour M21, priorité haute',
  'Démarre la dictée du rapport de l\'OT 87',
]

const CONFIDENCE_THRESHOLD = 0.7

const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  TECHNICIEN: 'Technicien',
  OPERATEUR: 'Opérateur',
}

const ROLE_PERMISSIONS = {
  ADMIN: 'Lecture, acquittement, ordres de travail, rapports et validation.',
  TECHNICIEN: 'Lecture, acquittement, création et traitement des ordres de travail, rapports.',
  OPERATEUR: 'Lecture et acquittement des alertes. Pas de création ou modification des OT.',
}

// ─── NLU: client-side intent matching ────────────────────────────────

function extractMachine(text) {
  const m = text.match(/\b([A-Z]{2,}[A-Z0-9]*[-_]\d+)\b/i) || text.match(/\bM(\d+)\b/i) || text.match(/machine\s+(\d+)/i)
  if (!m) return null
  return m[1]?.toUpperCase().startsWith('M') && /^\d+$/.test(m[1]) ? `M${m[1]}` : (m[1] || `M${m[2]}`).toUpperCase()
}

function extractAlertId(text) {
  const m = text.match(/(?:alerte|alert)\s*(?:n[°o]?\s*)?(\d+)/i)
  return m ? m[1] : null
}

function extractOtId(text) {
  const m = text.match(/\bOT\s*(\d+)/i) || text.match(/ordre\s+de\s+travail\s*(?:n[°o]?\s*)?(\d+)/i)
  return m ? (m[1] || m[2]) : null
}

function extractPriority(text) {
  if (/priorit[ée]\s+haute/i.test(text)) return 'haute'
  if (/priorit[ée]\s+moyenne/i.test(text)) return 'moyenne'
  if (/priorit[ée]\s+basse/i.test(text)) return 'basse'
  if (/urgent/i.test(text)) return 'haute'
  return 'moyenne'
}

function extractType(text) {
  if (/correcti[fv]/i.test(text)) return 'correctif'
  if (/pr[ée]ventif/i.test(text)) return 'préventif'
  if (/conditionnel/i.test(text)) return 'conditionnel'
  return 'correctif'
}

function extractAlertLevel(text) {
  if (/critique/i.test(text)) return 'critique'
  if (/avertissement/i.test(text)) return 'avertissement'
  if (/information/i.test(text)) return 'information'
  if (/mineure/i.test(text)) return 'mineure'
  if (/majeure/i.test(text)) return 'majeure'
  return null
}

function extractSensor(text) {
  if (/temp[ée]rature/i.test(text)) return 'température'
  if (/vibration/i.test(text)) return 'vibration'
  if (/pression/i.test(text)) return 'pression'
  if (/courant/i.test(text)) return 'courant'
  if (/vitesse|rpm/i.test(text)) return 'vitesse'
  if (/d[ée]bit/i.test(text)) return 'débit'
  if (/bruit/i.test(text)) return 'bruit'
  return null
}

function nlu(text) {
  const t = text.toLowerCase().trim()

  // yes / no
  if (/^(oui|confirm|ok|d'accord|vas-y|vas[\s-]y)$/i.test(t) || /^(oui|confirm|ok|d'accord|vas-y)[\s.,!]*$/i.test(t)) {
    return { intent: 'yes', params: {} }
  }
  if (/^(non|annule|stop)$/i.test(t) || /^(non|annule|stop)[\s.,!]*$/i.test(t)) {
    return { intent: 'no', params: {} }
  }

  // ack_alert
  if (/acquitte/i.test(t)) {
    const alertId = extractAlertId(t)
    const comment = t.replace(/.*acquitte\s*(l['']?\s*)?alerte\s*(?:n[°o]?\s*)?\d*/i, '').replace(/^[\s,]+/, '').trim()
    return { intent: 'ack_alert', params: { alertId, comment: comment || null } }
  }

  // create_work_order
  if (/(?:cr[ée][ée]|ouvre|lance)\s.*(?:ordre\s+de\s+travail|OT)/i.test(t)) {
    return {
      intent: 'create_work_order',
      params: {
        machine: extractMachine(t),
        type: extractType(t),
        priority: extractPriority(t),
      },
    }
  }

  // dictate_report
  if (/dict[ée]e/i.test(t)) {
    return { intent: 'dictate_report', params: { otId: extractOtId(t) } }
  }

  const statusMatch = t.match(/(?:passe|mettre|change|changer|avance)\s+(?:l['']?\s*)?(?:ot|ordre\s+de\s+travail)\s*(?:n[°o]?\s*)?(\d+).*?(assign[ée]|en cours|en attente(?: de)? pi[èe]ces|rapport d[ée]pos[ée]|valid[ée]|cl[ôo]tur[ée])/i)
  if (statusMatch) {
    const statusMap = {
      'assigné': 'Assigné', 'assigne': 'Assigné', 'en cours': 'En cours',
      'en attente pièces': 'En attente pièces', 'en attente de pièces': 'En attente pièces',
      'rapport déposé': 'Rapport déposé', 'rapport depose': 'Rapport déposé',
      'validé': 'Validé', 'valide': 'Validé', 'clôturé': 'Clôturé', 'cloture': 'Clôturé',
    }
    return { intent: 'set_work_order_status', params: { otId: statusMatch[1], status: statusMap[statusMatch[2].toLocaleLowerCase('fr')] } }
  }

  // get_rul
  if (/rul|combien\s+(?:d['']?\s*)?heures|combien\s+(?:d['']?\s*)?cycles|dur[ée]e\s+de\s+vie|avant\s+la\s+panne/i.test(t)) {
    return { intent: 'get_rul', params: { machine: extractMachine(t) } }
  }

  // get_sensor_value
  const sensor = extractSensor(t)
  if (sensor) {
    return { intent: 'get_sensor_value', params: { machine: extractMachine(t), sensor } }
  }

  // list_alerts
  if (/alertes?/i.test(t)) {
    return { intent: 'list_alerts', params: { level: extractAlertLevel(t) } }
  }

  // get_machine_status
  if (/[ée]tat|statut|sant[ée]/i.test(t)) {
    return { intent: 'get_machine_status', params: { machine: extractMachine(t) } }
  }

  return { intent: 'unknown', params: {} }
}

async function findMachine(reference) {
  if (!reference) return null
  const response = await getMachines({ page_size: 200 })
  const machines = response.results ?? response ?? []
  const query = reference.trim().toLocaleLowerCase('fr')
  return machines.find((machine) => [machine.identifiant_interne, machine.nom]
    .some((value) => value?.toLocaleLowerCase('fr') === query || value?.toLocaleLowerCase('fr').includes(query))) || null
}

function listFromResponse(response) {
  return response.results ?? response ?? []
}

// Intentions de consultation en direct.

async function generateResponse(intent, params) {
  switch (intent) {
    case 'get_machine_status': {
      if (!params.machine) return 'Précisez la machine, par exemple : « Quel est l’état de la machine POMPE-001 ? ».'
      const machine = await findMachine(params.machine)
      if (!machine) return `Je ne trouve pas la machine ${params.machine} dans votre périmètre.`
      const state = machine.statut_label || machine.statut || 'inconnu'
      return `${machine.nom} (${machine.identifiant_interne}) est actuellement au statut « ${state} ».`
    }
    case 'get_rul': {
      return `Je ne peux pas donner de RUL fiable pour ${params.machine || 'cette machine'} : le modèle disponible utilise des cycles de turbofan C-MAPSS, qui ne correspondent pas à ses capteurs. Aucune durée n’est simulée.`
    }
    case 'get_sensor_value': {
      if (!params.machine) return 'Précisez la machine pour lire un capteur.'
      const machine = await findMachine(params.machine)
      if (!machine) return `Je ne trouve pas la machine ${params.machine} dans votre périmètre.`
      const sensors = listFromResponse(await getCapteurs({ machine: machine.id, page_size: 200 }))
      const sensor = sensors.find((item) => `${item.nom} ${item.type_capteur}`.toLocaleLowerCase('fr').includes(params.sensor))
      if (!sensor) return `Aucun capteur ${params.sensor} trouvé sur ${machine.nom}.`
      const readings = listFromResponse(await getReadings({ sensor: sensor.id, page_size: 1, ordering: '-timestamp' }))
      const reading = readings[0]
      if (!reading) return `Le capteur ${sensor.nom} n’a encore aucune mesure enregistrée.`
      return `Dernière mesure de ${sensor.nom} sur ${machine.nom} : ${reading.valeur ?? reading.value} ${sensor.unite}, le ${new Date(reading.timestamp).toLocaleString('fr-FR')}. Seuil : ${formatNullableThreshold(sensor.seuil_min)} à ${formatNullableThreshold(sensor.seuil_max)} ${sensor.unite}.`
    }
    case 'list_alerts': {
      const response = await getAlerts({ statut: 'ACTIVE', ordering: '-date_declenchement', page_size: 5, ...(params.level ? { niveau: params.level.toUpperCase() } : {}) })
      const alerts = listFromResponse(response)
      if (!alerts.length) return 'Aucune alerte active correspondant à votre demande.'
      return `${alerts.length} alerte(s) active(s). ${alerts.map((alert) => `${alert.reference || `#${alert.id}`} : ${alert.machine_nom || alert.machine} — ${alert.message}`).join(' ; ')}`
    }
    case 'ack_alert': {
      return `confirm:Voulez-vous acquitter l'alerte #${params.alertId || '???'}${params.comment ? ` avec le commentaire « ${params.comment} »` : ''} ? Dites « oui » pour confirmer ou « non » pour annuler.`
    }
    case 'create_work_order': {
      const m = params.machine || 'M??'
      return `confirm:Créer un ordre de travail ${params.type || 'correctif'} pour ${m}, priorité ${params.priority || 'moyenne'} ? Dites « oui » pour confirmer ou « non » pour annuler.`
    }
    case 'dictate_report': {
      return `confirm:Démarrer la dictée du rapport pour l'OT #${params.otId || '???'} ? Dites « oui » pour commencer ou « non » pour annuler.`
    }
    case 'set_work_order_status':
      return `confirm:Passer l'OT #${params.otId} au statut « ${params.status} » ? Dites « oui » pour confirmer ou « non » pour annuler.`
    case 'yes':
      return 'yes'
    case 'no':
      return 'no'
    default:
      return 'Je n\'ai pas compris votre demande. Pourriez-vous reformuler ? Vous pouvez consulter les exemples à droite.'
  }
}

// ─── Component ───────────────────────────────────────────────────────

export default function VocalPage() {
  const { user } = useAuthContext()
  const role = user?.role ?? 'OPERATEUR'

  const Layout = role === 'ADMIN'
    ? AdminLayout
    : role === 'TECHNICIEN'
      ? TechnicianLayout
      : OperatorLayout

  // State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Bonjour. Je peux donner l\'état d\'une machine, son RUL, lire les alertes ou agir avec votre confirmation. Essayez un exemple ci-dessous.',
      time: new Date(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [reportDraft, setReportDraft] = useState(null)
  const [reportSaving, setReportSaving] = useState(false)
  const [commandHistory, setCommandHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [micAvailable, setMicAvailable] = useState(null)

  const chatRef = useRef(null)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)

  // ─── Check mic availability ─────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setMicAvailable(true)
    } else {
      setMicAvailable(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getVoiceCommandHistory()
      .then((entries) => {
        if (!cancelled) setCommandHistory(entries.map((entry) => ({
          id: entry.id, time: entry.created_at, text: entry.texte,
          intent: entry.intention || '—', confidence: entry.confiance ?? 0,
          result: entry.resultat || '—', utilisateur: entry.utilisateur,
        })))
      })
      .catch(() => {
        if (!cancelled) setMessages((prev) => [...prev, { role: 'assistant', text: 'Le journal serveur est temporairement indisponible. Les commandes continueront, mais leur historique ne pourra pas être synchronisé.', time: new Date() }])
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Auto-scroll chat ───────────────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // ─── TTS speak ──────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!ttsEnabled) return
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'fr-FR'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }, [ttsEnabled])

  const recordCommand = useCallback(async ({ text, intent, confidence, result }) => {
    const entry = { time: new Date(), text, intent, confidence, result }
    setCommandHistory((prev) => [entry, ...prev])
    try {
      const saved = await saveVoiceCommand({
        texte: text.slice(0, 1000), intention: intent.slice(0, 80), confiance,
        resultat: result.slice(0, 1000),
      })
      setCommandHistory((prev) => prev.map((item) => item === entry ? { ...item, id: saved.id, time: saved.created_at, utilisateur: saved.utilisateur } : item))
    } catch {
      // L’historique local reste visible si l’API est indisponible.
    }
  }, [])

  // ─── Pipeline animation ─────────────────────────────────────────
  const animatePipeline = useCallback(() => {
    return new Promise((resolve) => {
      const stepDuration = 300
      PIPELINE_STEPS.forEach((_, index) => {
        setTimeout(() => {
          setActiveStep(index)
        }, index * stepDuration)
      })
      setTimeout(() => {
        setActiveStep(-1)
        resolve()
      }, PIPELINE_STEPS.length * stepDuration + 200)
    })
  }, [])

  // ─── Voice processing pipeline ──────────────────────────────────
  const voiceProcess = useCallback(async (text, confidence = 1.0) => {
    if (!text.trim()) return
    setIsProcessing(true)

    // Add user message
    const userMsg = {
      role: 'user',
      text: text.trim(),
      time: new Date(),
      confidence,
    }
    setMessages((prev) => [...prev, userMsg])

    // Animate pipeline
    await animatePipeline()

    // Low confidence check
    if (confidence < CONFIDENCE_THRESHOLD) {
      const lowConfMsg = {
        role: 'assistant',
        text: `Confiance faible (${(confidence * 100).toFixed(0)}%). Pourriez-vous reformuler votre demande ?`,
        time: new Date(),
      }
      setMessages((prev) => [...prev, lowConfMsg])
      speak(lowConfMsg.text)
      await recordCommand({ text: text.trim(), intent: '—', confidence, result: 'Reformulation demandée' })
      setIsProcessing(false)
      return
    }

    if (reportDraft?.listening && !/terminer la dict[ée]e|fin de dict[ée]e/i.test(text)) {
      setReportDraft((current) => ({ ...current, travaux: `${current.travaux} ${text.trim()}`.trim() }))
      const response = 'Texte ajouté au brouillon du rapport. Vous pouvez continuer à dicter ou terminer la dictée.'
      setMessages((prev) => [...prev, { role: 'assistant', text: response, time: new Date() }])
      speak(response)
      await recordCommand({ text: text.trim(), intent: 'dictate_report', confidence, result: 'Ajouté au brouillon' })
      setIsProcessing(false)
      return
    }
    if (reportDraft?.listening && /terminer la dict[ée]e|fin de dict[ée]e/i.test(text)) {
      setReportDraft((current) => ({ ...current, listening: false }))
      const response = 'Dictée terminée. Relisez le rapport, complétez la durée et le signataire, puis enregistrez-le.'
      setMessages((prev) => [...prev, { role: 'assistant', text: response, time: new Date() }])
      speak(response)
      await recordCommand({ text: text.trim(), intent: 'dictate_report', confidence, result: 'Dictée terminée' })
      setIsProcessing(false)
      return
    }

    // NLU
    const { intent, params } = nlu(text)

    // Handle yes/no for pending actions
    if (intent === 'yes' && pendingAction) {
      let response = ''
      try {
        const { intent: action, params } = pendingAction
        if (action === 'ack_alert') {
          if (!params.alertId || !params.comment) throw new Error('Pour acquitter une alerte, indiquez son numéro et un commentaire.')
          await acknowledgeAlert(params.alertId, params.comment)
          response = `Alerte #${params.alertId} acquittée. Commentaire enregistré.`
        } else if (action === 'create_work_order') {
          if (role === 'OPERATEUR') throw new Error('Votre rôle permet d’acquitter une alerte, mais pas de créer un ordre de travail.')
          const machine = await findMachine(params.machine)
          if (!machine) throw new Error(`Machine ${params.machine || ''} introuvable dans votre périmètre.`)
          const typeMap = { correctif: 'Corrective', préventif: 'Préventive', conditionnel: 'Préventive' }
          const priorityMap = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
          const created = await createWorkOrder({
            machine_id: machine.id,
            type: typeMap[params.type] || 'Corrective',
            priorite: priorityMap[params.priority] || 'Moyenne',
            titre: `Ordre créé par assistant vocal — ${machine.nom}`,
            assigne: '—',
          })
          response = `Ordre de travail OT-${created.id} créé pour ${machine.nom}.`
        } else if (action === 'set_work_order_status') {
          if (role === 'OPERATEUR') throw new Error('Votre rôle ne permet pas de modifier le statut d’un ordre de travail.')
          const updated = await updateWorkOrderStatus(params.otId, params.status)
          response = `OT-${updated.id} passé au statut « ${updated.statut} ».`
        } else if (action === 'dictate_report') {
          if (role === 'OPERATEUR') throw new Error('La dictée de rapport est réservée aux techniciens et administrateurs.')
          if (!params.otId) throw new Error('Précisez le numéro de l’ordre de travail à documenter.')
          const order = await getWorkOrder(params.otId)
          if (!['En cours', 'En attente pièces'].includes(order.statut)) {
            throw new Error(`Le rapport de OT-${order.id} ne peut être déposé que lorsque l’OT est en cours ou en attente de pièces.`)
          }
          const signataire = [user?.prenom, user?.nom].filter(Boolean).join(' ')
          setReportDraft({ otId: order.id, travaux: '', duree: '', observations: '', signataire, listening: true })
          response = `Dictée ouverte pour OT-${order.id}. Dictez le travail réalisé, puis dites « terminer la dictée ».`
        }
      } catch (error) {
        response = error.response?.data?.detail || error.response?.data?.statut?.[0] || error.response?.data?.commentaire?.[0] || error.message || 'L’action n’a pas pu être exécutée.'
      }
      const confirmMsg = { role: 'assistant', text: response, time: new Date() }
      setMessages((prev) => [...prev, confirmMsg])
      speak(response)
      await recordCommand({ text: text.trim(), intent: pendingAction?.intent || 'confirmation', confidence, result: response })
      setPendingAction(null)
      setIsProcessing(false)
      return
    }

    if (intent === 'no' && pendingAction) {
      const cancelMsg = {
        role: 'assistant',
        text: 'Action annulée.',
        time: new Date(),
      }
      setMessages((prev) => [...prev, cancelMsg])
      speak(cancelMsg.text)
      await recordCommand({ text: text.trim(), intent: pendingAction?.intent || 'annulation', confidence, result: 'Annulé' })
      setPendingAction(null)
      setIsProcessing(false)
      return
    }

    // Generate response
    if (intent === 'ack_alert' && (!params.alertId || !params.comment)) {
      const response = !params.alertId
        ? 'Indiquez le numéro de l’alerte à acquitter.'
        : 'Ajoutez un commentaire de traitement, par exemple : « acquitte l’alerte 12, vérifié sur place ».'
      setMessages((prev) => [...prev, { role: 'assistant', text: response, time: new Date() }])
      speak(response)
      setIsProcessing(false)
      return
    }
    if (['ack_alert', 'create_work_order', 'dictate_report', 'set_work_order_status'].includes(intent) && role === 'OPERATEUR' && intent !== 'ack_alert') {
      const response = 'Cette action n’est pas autorisée pour le rôle opérateur.'
      setMessages((prev) => [...prev, { role: 'assistant', text: response, time: new Date() }])
      speak(response)
      setIsProcessing(false)
      return
    }
    let response
    try {
      response = await generateResponse(intent, params)
    } catch (error) {
      response = error.response?.data?.detail || 'Impossible de lire les données pour le moment. Vérifiez la connexion et les permissions, puis réessayez.'
    }

    // Handle confirmation-required actions
    if (response.startsWith('confirm:')) {
      const confirmText = response.slice(8)
      const actionDescriptions = {
        ack_alert: `Acquitter l'alerte #${params.alertId || '???'}`,
        create_work_order: `Créer un OT ${params.type || 'correctif'} pour ${params.machine || 'M??'}`,
        dictate_report: `Démarrer la dictée pour l'OT #${params.otId || '???'}`,
        set_work_order_status: `Modifier le statut de l'OT #${params.otId} vers « ${params.status} »`,
      }
      setPendingAction({
        intent,
        params,
        description: actionDescriptions[intent] || 'Action en attente',
      })
      const assistantMsg = {
        role: 'assistant',
        text: confirmText,
        time: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      speak(confirmText)
      await recordCommand({ text: text.trim(), intent, confidence, result: 'En attente de confirmation' })
      setIsProcessing(false)
      return
    }

    // Standard response
    const assistantMsg = {
      role: 'assistant',
      text: response,
      time: new Date(),
    }
    setMessages((prev) => [...prev, assistantMsg])
    speak(response)

    await recordCommand({ text: text.trim(), intent, confidence, result: response.length > 1000 ? response.slice(0, 997) + '…' : response })

    setIsProcessing(false)
  }, [animatePipeline, pendingAction, recordCommand, reportDraft, role, speak, user?.nom, user?.prenom])

  // ─── Speech recognition ──────────────────────────────────────────
  const toggleListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicAvailable(false)
      return
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onresult = (event) => {
      const result = event.results[0][0]
      const transcript = result.transcript
      const confidence = result.confidence
      setIsListening(false)
      voiceProcess(transcript, confidence)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        setMicAvailable(false)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, voiceProcess])

  // ─── Form submit ────────────────────────────────────────────────
  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    if (!inputText.trim() || isProcessing) return
    const text = inputText.trim()
    setInputText('')
    voiceProcess(text, 1.0)
  }, [inputText, isProcessing, voiceProcess])

  const handleSaveReport = useCallback(async (e) => {
    e.preventDefault()
    if (!reportDraft || reportSaving) return
    if (!reportDraft.travaux.trim() || !reportDraft.signataire.trim()) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Renseignez les travaux réalisés et le signataire avant l’enregistrement.', time: new Date() }])
      return
    }
    setReportSaving(true)
    try {
      await submitReport(reportDraft.otId, {
        travaux: reportDraft.travaux.trim(),
        duree: Number(reportDraft.duree) || 0,
        observations: reportDraft.observations.trim(),
        pieces: [],
        signataire: reportDraft.signataire.trim(),
      })
      const response = `Rapport enregistré dans l’OT-${reportDraft.otId}. Son statut est maintenant « Rapport déposé ».`
      setMessages((prev) => [...prev, { role: 'assistant', text: response, time: new Date() }])
      await recordCommand({ text: `Rapport OT-${reportDraft.otId}`, intent: 'dictate_report', confidence: 1, result: 'Rapport déposé' })
      setReportDraft(null)
      speak(response)
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.travaux?.[0] || error.message || 'Le rapport n’a pas pu être enregistré.'
      setMessages((prev) => [...prev, { role: 'assistant', text: message, time: new Date() }])
    } finally {
      setReportSaving(false)
    }
  }, [recordCommand, reportDraft, reportSaving, speak])

  // ─── Format time ────────────────────────────────────────────────
  const formatTime = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <Layout title="Assistant Vocal">
      <div className="space-y-6">
        {/* ─── Main grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left: Chat + Pipeline (2/3 width) ──────────────── */}
          <div className="lg:col-span-2 space-y-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Assistant vocal</h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ttsEnabled}
                    onChange={(e) => setTtsEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Volume2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Réponse parlée</span>
                </label>
              </div>

              {/* Pipeline visualization */}
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PIPELINE_STEPS.map((step, idx) => (
                    <div
                      key={step.num}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                        whitespace-nowrap transition-all duration-300 ease-in-out
                        ${idx === activeStep
                          ? 'bg-blue-600 text-white shadow-md scale-105'
                          : idx < activeStep
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-200 text-gray-500'
                        }
                      `}
                    >
                      <span className="font-bold">{step.num}</span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat area */}
              <div
                ref={chatRef}
                className="h-96 overflow-y-auto px-6 py-4 space-y-3"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }
                      `}
                    >
                      <p>{msg.text}</p>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                        <span>{formatTime(msg.time)}</span>
                        {msg.role === 'user' && msg.confidence != null && (
                          <span>ASR : {(msg.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-500">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation note */}
              {pendingAction && (
                <div className="mx-6 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    Confirmation orale requise. Dites ou tapez « oui » ou « non ».
                  </p>
                </div>
              )}

              {reportDraft && (
                <form onSubmit={handleSaveReport} className="mx-6 mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Brouillon du rapport · OT-{reportDraft.otId}</h3>
                    <button type="button" onClick={() => setReportDraft(null)} className="text-gray-500 hover:text-red-600" aria-label="Annuler le brouillon"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="text-xs text-gray-600">{reportDraft.listening ? 'Dictée active : parlez ou tapez le texte, puis dites « terminer la dictée ».' : 'Relisez et complétez avant d’enregistrer le rapport dans le CMMS.'}</p>
                  <label className="block text-sm text-gray-700">Travaux réalisés
                    <textarea required rows={3} value={reportDraft.travaux} onChange={(e) => setReportDraft((d) => ({ ...d, travaux: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Décrire les travaux effectués" />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-sm text-gray-700">Durée (heures)
                      <input type="number" min="0" step="0.25" value={reportDraft.duree} onChange={(e) => setReportDraft((d) => ({ ...d, duree: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                    <label className="block text-sm text-gray-700">Signataire
                      <input required value={reportDraft.signataire} onChange={(e) => setReportDraft((d) => ({ ...d, signataire: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                  </div>
                  <label className="block text-sm text-gray-700">Observations
                    <textarea rows={2} value={reportDraft.observations} onChange={(e) => setReportDraft((d) => ({ ...d, observations: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </label>
                  <button type="submit" disabled={reportSaving || !reportDraft.travaux.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    <Check className="h-4 w-4" />{reportSaving ? 'Enregistrement…' : 'Enregistrer le rapport'}
                  </button>
                </form>
              )}

              {/* Input form */}
              <div className="px-6 py-4 border-t border-gray-200">
                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={micAvailable === false}
                    className={`
                      shrink-0 h-11 w-11 rounded-full flex items-center justify-center
                      transition-all duration-200
                      ${isListening
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                        : micAvailable === false
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                    title={isListening ? 'Arrêter l\'écoute' : 'Activer le micro'}
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Parlez ou tapez une commande…"
                    disabled={isProcessing}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      disabled:bg-gray-50 disabled:text-gray-400"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isProcessing}
                    className="shrink-0 h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium
                      hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                      disabled:bg-gray-300 disabled:cursor-not-allowed
                      flex items-center gap-2 transition-colors duration-200"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </form>

                <p className="mt-2 text-xs text-gray-400">
                  {micAvailable === null && 'Vérification du micro…'}
                  {micAvailable === true && (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 mr-1 align-middle" />
                      Microphone disponible — cliquez sur le bouton micro ou tapez votre commande
                    </>
                  )}
                  {micAvailable === false && (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 mr-1 align-middle" />
                      Microphone non disponible — l&apos;API Web Speech n&apos;est pas supportée ou l&apos;accès a été refusé
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-400">L’application conserve uniquement le texte de la commande et son résultat. La reconnaissance vocale est fournie par le navigateur.</p>
              </div>
            </div>
          </div>

          {/* ─── Right column ────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Examples card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Exemples</h3>
              </div>
              <div className="px-6 py-4 space-y-2">
                {EXAMPLES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isProcessing) voiceProcess(example, 1.0)
                    }}
                    disabled={isProcessing}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-700 bg-gray-50
                      rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed border border-transparent
                      hover:border-blue-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Role note */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Rôle & Permissions</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Rôle actuel :</span>{' '}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {ROLE_LABELS[role] || role}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {ROLE_PERMISSIONS[role] || 'Permissions non définies.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Command History Table ─────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Dernières commandes</h3>
              <span className="text-xs text-gray-400">texte uniquement, aucun audio conservé</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Heure</th>
                  {role === 'ADMIN' && <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>}
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Texte</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Intention</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Confiance</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Chargement de l’historique…</td></tr>
                ) : commandHistory.length === 0 ? (
                  <tr>
                    <td colSpan={role === 'ADMIN' ? 6 : 5} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Aucune commande enregistrée pour cette session
                    </td>
                  </tr>
                ) : (
                  commandHistory.map((cmd, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{new Date(cmd.time).toLocaleString('fr-FR')}</td>
                      {role === 'ADMIN' && <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{cmd.utilisateur || '—'}</td>}
                      <td className="px-6 py-3 text-gray-800 max-w-xs truncate">{cmd.text}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {cmd.intent}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{(cmd.confidence * 100).toFixed(0)}%</td>
                      <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{cmd.result}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
