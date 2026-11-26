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

  it('parcourt les pages et désactive les contrôles aux limites', async () => {
    const machines = Array.from({ length: 11 }, (_, index) => ({
      machine_id: index + 1, machine: `Machine ${index + 1}`, machine_identifiant: `M-${index + 1}`,
      eligible_sensor_count: 1, valid_measure_count: 100, history_days: 8,
      missing_rate_percent: 0, ready_for_training: true, blocking_reasons: [],
    }))
    getAiReadiness.mockResolvedValueOnce({ criteria: {}, machines })
    render(<AiReadinessSection role="ADMIN" />)
    expect(await screen.findByText('Machine 1')).toBeInTheDocument()
    expect(screen.queryByText('Machine 11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
    await (await import('@testing-library/user-event')).default.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(screen.getByText('Machine 11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled()
    await (await import('@testing-library/user-event')).default.click(screen.getByRole('button', { name: 'Précédent' }))
    expect(screen.getByText('Machine 1')).toBeInTheDocument()
  })
})
