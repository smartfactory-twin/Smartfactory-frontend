import { describe, expect, it } from 'vitest'
import { formatHealthIndicator, formatNullableThreshold, getAiEligibilityReason } from '../../utils/sensorDisplay'

describe('affichage des valeurs nullable capteurs', () => {
  it('affiche un seuil absent sans exposer null ou undefined', () => {
    expect(formatNullableThreshold(null)).toBe('Non défini')
    expect(formatNullableThreshold(undefined)).toBe('Non défini')
    expect(formatNullableThreshold(0)).toBe('0')
  })
  it('affiche une santé absente comme non calculable', () => {
    expect(formatHealthIndicator(null)).toBe('Non calculable')
    expect(formatHealthIndicator(Number.NaN)).toBe('Non calculable')
    expect(formatHealthIndicator(72)).toBe('72 %')
  })
  it('explique pourquoi un capteur n’est pas éligible', () => {
    expect(getAiEligibilityReason({ sensor_role: 'other' })).toContain('other')
    expect(getAiEligibilityReason({ sensor_role: 'temperature', nominal_min: 1, nominal_max: 4, is_ai_eligible: false })).toContain('pas été activé')
  })
})
