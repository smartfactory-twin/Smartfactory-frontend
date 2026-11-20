import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SensorAiEligibilityBadge from '../../components/equipements/SensorAiEligibilityBadge'

describe('SensorAiEligibilityBadge', () => {
  it('affiche le badge et la raison pour un capteur non éligible', () => {
    render(<SensorAiEligibilityBadge sensor={{ sensor_role: 'other', is_ai_eligible: false }} showReason />)
    expect(screen.getByText('Non éligible')).toBeInTheDocument()
    expect(screen.getByText(/rôle « other »/)).toBeInTheDocument()
  })
  it('affiche le badge éligible', () => {
    render(<SensorAiEligibilityBadge sensor={{ sensor_role: 'temperature', nominal_min: 0, nominal_max: 80, is_ai_eligible: true }} />)
    expect(screen.getByText('Éligible IA')).toBeInTheDocument()
  })
})
