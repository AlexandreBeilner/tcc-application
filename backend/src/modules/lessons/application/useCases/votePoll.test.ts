import { describe, expect, it } from 'vitest'
import {
  InvalidPollOptionError,
  LessonLockedError,
  LessonNotFoundError,
  PollNotFoundError,
} from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonPollRepository } from '../../test/fakes/fakeLessonPollRepository'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { VotePollUseCase } from './votePoll'

const poll = {
  type: 'poll' as const,
  id: 'enquete',
  prompt: 'Você deixa na conta?',
  options: ['Deixo', 'Invisto', 'Gasto'],
}
const lesson = (n: number, withPoll = false): LessonSummary => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição ${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: n,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection',
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: null,
  unlocksKeys: [],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
  blocks: withPoll
    ? { schemaVersion: 1, phases: { scenario: [poll], microDecision: [], revelation: [] } }
    : null,
})

function setup() {
  const lessons = createFakeLessonRepository([lesson(1, true), lesson(2, true)])
  const polls = createFakeLessonPollRepository()
  return { lessons, polls, useCase: new VotePollUseCase(lessons, polls) }
}

const vote = { userId: 'u1', lessonId: 'l1', pollId: 'enquete', option: 1 }

describe('VotePollUseCase', () => {
  it('grava o voto e não devolve resultado antes de haver votos suficientes', async () => {
    const { useCase } = setup()
    expect(await useCase.execute(vote)).toEqual({ pollId: 'enquete', vote: 1 })
  })

  it('com 20 votos ou mais devolve a distribuição, sem nome de ninguém', async () => {
    const { polls, useCase } = setup()
    polls.seed('l1', 'enquete', 0, 14)
    polls.seed('l1', 'enquete', 1, 5)

    const state = await useCase.execute(vote)

    expect(state.results).toEqual({ total: 20, percentages: [70, 30, 0] })
    expect(JSON.stringify(state)).not.toContain('u1')
  })

  it('o primeiro voto permanece ao votar de novo', async () => {
    const { useCase } = setup()
    await useCase.execute(vote)
    expect((await useCase.execute({ ...vote, option: 2 })).vote).toBe(1)
  })

  it('o mesmo identificador de enquete em outra lição conta à parte', async () => {
    const { lessons, useCase } = setup()
    await useCase.execute(vote)
    await lessons.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })
    expect((await useCase.execute({ ...vote, lessonId: 'l2', option: 2 })).vote).toBe(2)
  })

  it('recusa enquete inexistente, lição inexistente e opção fora das alternativas', async () => {
    const { useCase } = setup()
    await expect(useCase.execute({ ...vote, pollId: 'nao-existe' })).rejects.toBeInstanceOf(
      PollNotFoundError,
    )
    await expect(useCase.execute({ ...vote, lessonId: 'nada' })).rejects.toBeInstanceOf(
      LessonNotFoundError,
    )
    await expect(useCase.execute({ ...vote, option: 3 })).rejects.toBeInstanceOf(
      InvalidPollOptionError,
    )
  })

  it('recusa voto numa lição ainda bloqueada, mas aceita em lição concluída', async () => {
    const { lessons, useCase } = setup()
    await expect(useCase.execute({ ...vote, lessonId: 'l2' })).rejects.toBeInstanceOf(
      LessonLockedError,
    )
    await lessons.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })
    expect((await useCase.execute({ ...vote, lessonId: 'l2' })).vote).toBe(1)
    expect((await useCase.execute(vote)).vote).toBe(1)
  })
})
