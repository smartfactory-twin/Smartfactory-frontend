import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import AiReadinessSection from '../../components/ai/AiReadinessSection'
import { getAiReadiness } from '../../services/aiPredictionService'

vi.mock('../../services/aiPredictionService', () => ({ getAiReadiness: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('AiReadinessSection', () => {
  it.each(['ADMIN', 'TECHNICIEN'])('charge les données pour le rôle %s', async (role) => {
    getAiReadiness.mockResolvedValueOnce({
      criteria: { min_history_days: 7, min_valid_measures: 100, max_missing_rate_percent: 5 },
      machines: [{ machine_id: 3, machine: 'Pompe', machine_identifiant: 'P-1', eligible_sensor_count: 2, valid_measure_count: 130, history_days: 9, missing_rate_percent: 1.2, status: 'ready', ready_for_training: true, blocking_reasons: [] }],
    })
    render(<AiReadinessSection role={role} />)
    expect(await screen.findByText('Pompe')).toBeInTheDocument()
    expect(screen.getByText('Prête')).toBeInTheDocument()
    expect(screen.getByText(/entre la première et la dernière mesure/)).toBeInTheDocument()
    expect(getAiReadiness).toHaveBeenCalledOnce()
  })
  it('ne rend pas la section et ne fait aucun appel pour un rôle refusé', () => {
    const { container } = render(<AiReadinessSection role="OPERATEUR" />)
    expect(container).toBeEmptyDOMElement()
    expect(getAiReadiness).not.toHaveBeenCalled()
  })
  it('affiche un état vide lorsqu’aucune machine ne revient', async () => {
    getAiReadiness.mockResolvedValueOnce({ criteria: {}, machines: [] })
    render(<AiReadinessSection role="ADMIN" />)
    expect(await screen.findByText(/Aucune machine n’est disponible/)).toBeInTheDocument()
  })
})
