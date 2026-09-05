import { describe, expect, it } from 'vitest'
import { createFakeMacroEventReader } from '../../test/fakes/fakeMacroEventReader'
import { ListMacroEventsUseCase } from './listMacroEvents'

const sampleResult = {
  events: [
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
      targets: [{ sector: 'Financeiro' }],
      created_at: '2026-08-30T14:05:00.000Z',
    },
  ],
  total_entries: 1,
}

describe('ListMacroEventsUseCase', () => {
  it('repassa a query pra port e devolve o resultado', async () => {
    const macroEventReader = createFakeMacroEventReader(sampleResult)
    const useCase = new ListMacroEventsUseCase(macroEventReader)

    const result = await useCase.execute({ limit: 5, offset: 10 })

    expect(result).toEqual(sampleResult)
    expect(macroEventReader.calls).toEqual([{ limit: 5, offset: 10 }])
  })

  it('propaga erro lançado pela port', async () => {
    const macroEventReader = createFakeMacroEventReader(sampleResult)
    macroEventReader.errorToThrow = new Error(
      'falha ao listar eventos macro no motor de simulação (status 500)',
    )
    const useCase = new ListMacroEventsUseCase(macroEventReader)

    await expect(useCase.execute({})).rejects.toThrow(/falha ao listar eventos macro/)
  })
})
