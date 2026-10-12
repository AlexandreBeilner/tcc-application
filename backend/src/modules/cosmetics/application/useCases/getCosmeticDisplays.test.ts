import { describe, expect, it } from 'vitest'
import {
  createFakeCatalog,
  createFakeMembership,
  createFakeSelections,
} from '../../test/fakes/fakes'
import { GetCosmeticDisplaysUseCase } from './getCosmeticDisplays'

describe('GetCosmeticDisplaysUseCase', () => {
  it('mostra o que PRO escolheu e esconde o de quem não é PRO, sem apagar nada', async () => {
    const selections = createFakeSelections({
      pro: { frame: 'frame_aurora', title: 'title_paciente' },
      ex: { frame: 'frame_aurora', title: null },
    })
    const useCase = new GetCosmeticDisplaysUseCase(
      createFakeCatalog(),
      selections,
      createFakeMembership(['pro']),
    )

    const result = await useCase.execute(['pro', 'ex', 'nunca'])

    expect(result.get('pro')).toEqual({
      isPro: true,
      frame: 'frame_aurora',
      title: 'Investidor Paciente',
    })
    expect(result.get('ex')).toEqual({ isPro: false, frame: null, title: null })
    expect(result.get('nunca')).toEqual({ isPro: false, frame: null, title: null })
    // arquivado: a escolha de quem cancelou continua guardada
    expect(selections.rows.get('ex')?.frame).toBe('frame_aurora')
  })

  it('reativar restaura o visual sem nenhuma escrita', async () => {
    const selections = createFakeSelections({ ex: { frame: 'frame_aurora', title: null } })
    const membership = createFakeMembership([])
    const useCase = new GetCosmeticDisplaysUseCase(createFakeCatalog(), selections, membership)

    expect((await useCase.execute(['ex'])).get('ex')?.frame).toBeNull()
    membership.ids.add('ex')
    expect((await useCase.execute(['ex'])).get('ex')?.frame).toBe('frame_aurora')
  })

  it('lista vazia não consulta ninguém', async () => {
    const membership = createFakeMembership([])
    const useCase = new GetCosmeticDisplaysUseCase(
      createFakeCatalog(),
      createFakeSelections(),
      membership,
    )
    expect((await useCase.execute([])).size).toBe(0)
    expect(membership.calls).toBe(0)
  })
})
