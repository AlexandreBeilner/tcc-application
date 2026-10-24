import { describe, expect, it } from 'vitest'
import { createFakeCatalog, createFakeSelections } from '../../test/fakes/fakes'
import { GetCosmeticDisplaysUseCase } from './getCosmeticDisplays'

describe('GetCosmeticDisplaysUseCase', () => {
  it('mostra o que cada pessoa escolheu; quem não escolheu nada aparece sem item', async () => {
    const selections = createFakeSelections({
      ana: { frame: 'frame_aurora', title: 'title_paciente' },
      bia: { frame: 'frame_aurora', title: null },
    })
    const useCase = new GetCosmeticDisplaysUseCase(createFakeCatalog(), selections)

    const result = await useCase.execute(['ana', 'bia', 'nunca'])

    expect(result.get('ana')).toEqual({ frame: 'frame_aurora', title: 'Investidor Paciente' })
    expect(result.get('bia')).toEqual({ frame: 'frame_aurora', title: null })
    expect(result.get('nunca')).toEqual({ frame: null, title: null })
  })

  it('lista vazia devolve um mapa vazio', async () => {
    const useCase = new GetCosmeticDisplaysUseCase(createFakeCatalog(), createFakeSelections())
    expect((await useCase.execute([])).size).toBe(0)
  })
})
