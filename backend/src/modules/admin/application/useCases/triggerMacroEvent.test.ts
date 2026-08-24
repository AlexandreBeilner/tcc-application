import { describe, expect, it } from 'vitest'
import { createFakeMacroEventTrigger } from '../../test/fakes/fakeMacroEventTrigger'
import { TriggerMacroEventUseCase } from './triggerMacroEvent'

const sampleResult = {
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
  price_effect_pct: -4,
}

describe('TriggerMacroEventUseCase', () => {
  it('repassa o input pra port e devolve o resultado', async () => {
    const macroEventTrigger = createFakeMacroEventTrigger(sampleResult)
    const useCase = new TriggerMacroEventUseCase(macroEventTrigger)

    const input = { template_key: 'legislacao-ambiental-mineracao', targets: [{ sector: 'Mineração' }] }
    const result = await useCase.execute(input)

    expect(result).toEqual(sampleResult)
    expect(macroEventTrigger.calls).toEqual([input])
  })

  it('propaga erro lançado pela port (ex: InvalidMacroEventError)', async () => {
    const macroEventTrigger = createFakeMacroEventTrigger(sampleResult)
    macroEventTrigger.errorToThrow = new Error('evento macro inválido')
    const useCase = new TriggerMacroEventUseCase(macroEventTrigger)

    await expect(
      useCase.execute({ template_key: 'x', targets: [{ sector: 'Mineração' }] }),
    ).rejects.toThrow('evento macro inválido')
  })
})
