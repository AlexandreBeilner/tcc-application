import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetTrackMapUseCase } from './getTrackMap'

const track0 = [1, 2, 3, 4, 5].map((n) => ({
  id: `l0-${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0: Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: n === 5 ? 'Acesso à Trilha 1 (Renda Fixa)' : null,
  unlocksKeys: [] as string[],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}))

const lesson11 = {
  id: 'l1-1',
  code: '1.1',
  title: 'O que é renda fixa',
  trackNumber: 1,
  trackName: 'Trilha 1: Renda Fixa',
  sortOrder: 6,
  centralConcept: 'Emprestar dinheiro a um emissor',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: 'Tesouro Selic',
  unlocksKeys: [],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

describe('GetTrackMapUseCase', () => {
  it('primeira lição available, demais locked, pra usuário sem nenhum progresso', async () => {
    const repository = createFakeLessonRepository([...track0, lesson11])
    const useCase = new GetTrackMapUseCase(repository)

    const map = await useCase.execute({ userId: 'u1' })

    expect(map[0].status).toBe('available')
    expect(map.slice(1).every((lesson) => lesson.status === 'locked')).toBe(true)
  })

  it('lição 1.1 só desbloqueia depois de concluir toda a Trilha 0 (0.5 → 1.1)', async () => {
    const repository = createFakeLessonRepository([...track0, lesson11])
    const useCase = new GetTrackMapUseCase(repository)
    for (const lesson of track0.slice(0, 4)) {
      await repository.upsertProgress('u1', lesson.id, { currentStep: 3, completedAt: new Date() })
    }

    const beforeLastOfTrack0 = await useCase.execute({ userId: 'u1' })
    expect(beforeLastOfTrack0.find((l) => l.code === '1.1')?.status).toBe('locked')

    await repository.upsertProgress('u1', track0[4].id, { currentStep: 3, completedAt: new Date() })
    const afterTrack0Complete = await useCase.execute({ userId: 'u1' })
    expect(afterTrack0Complete.find((l) => l.code === '1.1')?.status).toBe('available')
  })

  it('lição já concluída aparece como completed, mantém currentStep persistido', async () => {
    const repository = createFakeLessonRepository([...track0])
    await repository.upsertProgress('u1', track0[0].id, { currentStep: 3, completedAt: new Date() })
    const useCase = new GetTrackMapUseCase(repository)

    const map = await useCase.execute({ userId: 'u1' })

    expect(map[0]).toMatchObject({ status: 'completed', currentStep: 3 })
  })

  it('lição dispensada aparece como available e waived, e quem a pula segue sem bloqueio (N.24)', async () => {
    // Currículo atual: 0.1, 0.2(nova, dispensada), 0.3, 0.4. Usuário já tinha concluído
    // 0.1 e (antiga) 0.2, hoje 0.3.
    const repository = createFakeLessonRepository(track0.slice(0, 4))
    await repository.upsertProgress('u1', track0[0].id, { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', track0[2].id, { currentStep: 3, completedAt: new Date() })
    repository.waive('u1', track0[1].id)
    const useCase = new GetTrackMapUseCase(repository)

    const map = await useCase.execute({ userId: 'u1' })

    expect(map.map((l) => l.status)).toEqual(['completed', 'available', 'completed', 'available'])
    expect(map.map((l) => l.waived)).toEqual([false, true, false, false])
  })
})
