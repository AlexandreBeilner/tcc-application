import { describe, expect, it } from 'vitest'
import { redactPending } from './redactPending'

describe('redactPending', () => {
  it('esconde direction/magnitude_band/efeitos/targets de evento pendente', () => {
    const events = [
      {
        id: 'event-1',
        title: 'título',
        narrative: 'narrativa',
        direction: 'negativo',
        magnitude_band: 'leve',
        affects_price: true,
        affects_fundamentals: false,
        status: 'pendente',
        triggered_on_day: 5,
        duration_days: 1,
        price_effect_pct: -2.5,
        targets: [{ sector: 'Financeiro' }],
      },
    ]

    const result = redactPending(events)

    expect(result).toEqual([
      {
        ...events[0],
        direction: '',
        magnitude_band: '',
        price_effect_pct: undefined,
        fundamentals_effect_pct: undefined,
        targets: [],
      },
    ])
  })

  it('mantém evento aplicado intacto', () => {
    const events = [
      {
        id: 'event-2',
        title: 'título',
        narrative: 'narrativa',
        direction: 'positivo',
        magnitude_band: 'moderado',
        affects_price: true,
        affects_fundamentals: false,
        status: 'aplicado',
        triggered_on_day: 4,
        duration_days: 1,
        price_effect_pct: 3.1,
        targets: [{ asset_id: 'ativo-1' }],
      },
    ]

    expect(redactPending(events)).toEqual(events)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(redactPending([])).toEqual([])
  })
})
