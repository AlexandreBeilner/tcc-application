import { describe, expect, it } from 'vitest'
import { LessonNotFoundError, LessonPublicationConflictError } from '../../domain/errors'
import {
  createFakeLessonCatalogRepository,
  emptyFunnel,
} from '../../test/fakes/fakeLessonCatalogRepository'
import { buildCatalogLesson, LESSON_IDS } from '../../test/fakes/lessonFixtures'
import { ListLessonCatalogUseCase, SetLessonPublishedUseCase } from './manageLessonCatalog'

function setup() {
  const a = buildCatalogLesson({ id: LESSON_IDS.a, code: '0.1', sortOrder: 1 })
  const b = buildCatalogLesson({ id: LESSON_IDS.b, code: '0.2', sortOrder: 2 })
  const repository = createFakeLessonCatalogRepository([b, a], {
    [LESSON_IDS.a]: emptyFunnel({ started: 4, completed: 2 }),
  })
  return { repository }
}

describe('ListLessonCatalogUseCase', () => {
  it('lista em ordem da trilha com pré-requisito e funil derivado', async () => {
    const { repository } = setup()

    const entries = await new ListLessonCatalogUseCase(repository).execute()

    expect(entries.map((e) => e.lesson.code)).toEqual(['0.1', '0.2'])
    expect(entries.map((e) => e.prerequisiteCode)).toEqual([null, '0.1'])
    expect(entries[0].funnel.completionRate).toBeCloseTo(0.5)
    expect(entries[1].funnel.completionRate).toBeNull()
  })
})

describe('SetLessonPublishedUseCase', () => {
  it('despublica e publica de volta', async () => {
    const { repository } = setup()
    const useCase = new SetLessonPublishedUseCase(repository)

    const off = await useCase.execute(LESSON_IDS.b, false)
    expect(off.lesson.published).toBe(false)

    const on = await useCase.execute(LESSON_IDS.b, true)
    expect(on.lesson.published).toBe(true)
  })

  it('recusa repetir o estado atual', async () => {
    const { repository } = setup()

    await expect(
      new SetLessonPublishedUseCase(repository).execute(LESSON_IDS.a, true),
    ).rejects.toThrow(LessonPublicationConflictError)
  })

  it('recusa lição inexistente', async () => {
    const { repository } = setup()

    await expect(
      new SetLessonPublishedUseCase(repository).execute(LESSON_IDS.unknown, false),
    ).rejects.toThrow(LessonNotFoundError)
  })
})
