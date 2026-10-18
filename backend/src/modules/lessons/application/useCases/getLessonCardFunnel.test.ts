import { describe, expect, it } from 'vitest'
import { LessonNotFoundError } from '../../domain/errors'
import { createFakeLessonCardReachRepository } from '../../test/fakes/fakeLessonCardReachRepository'
import { createFakeLessonCatalogRepository } from '../../test/fakes/fakeLessonCatalogRepository'
import { buildCatalogLesson, LESSON_IDS } from '../../test/fakes/lessonFixtures'
import { GetLessonCardFunnelUseCase } from './getLessonCardFunnel'

const NOW = new Date('2026-10-18T12:00:00Z')

async function setup() {
  const catalog = createFakeLessonCatalogRepository([
    buildCatalogLesson({ id: LESSON_IDS.a, published: false }),
  ])
  const reach = createFakeLessonCardReachRepository()
  const record = (userId: string, cardIndex: number, day: string) =>
    reach.recordReach({ userId, lessonId: LESSON_IDS.a, position: { phase: 0, cardIndex }, day })
  await record('u1', 0, '2026-10-18')
  await record('u2', 0, '2026-10-17')
  await record('u1', 1, '2026-10-18')
  await record('u3', 0, '2026-09-01')
  return new GetLessonCardFunnelUseCase(catalog, reach, () => NOW)
}

describe('GetLessonCardFunnelUseCase', () => {
  it('soma a janela de dias e aponta a maior queda', async () => {
    const funnel = await (await setup()).execute(LESSON_IDS.a, 7)

    expect(funnel.days).toBe(7)
    expect(funnel.since).toBe('2026-10-12')
    expect(funnel.lesson).toEqual({ id: LESSON_IDS.a, code: '0.1', title: 'O que é investir' })
    expect(funnel.bars.map((b) => [b.cardIndex, b.reached])).toEqual([
      [0, 2],
      [1, 1],
    ])
    expect(funnel.biggestDrop).toEqual({ phase: 0, cardIndex: 1 })
  })

  it('a janela de 1 dia é só hoje; sem pedido usa 30 dias; o teto é 365', async () => {
    const useCase = await setup()
    expect((await useCase.execute(LESSON_IDS.a, 1)).since).toBe('2026-10-18')
    expect((await useCase.execute(LESSON_IDS.a)).days).toBe(30)
    expect((await useCase.execute(LESSON_IDS.a, 9999)).days).toBe(365)
    expect((await useCase.execute(LESSON_IDS.a, 0)).days).toBe(1)
  })

  it('enxerga lição despublicada e recusa lição inexistente', async () => {
    const useCase = await setup()
    await expect(useCase.execute(LESSON_IDS.unknown)).rejects.toBeInstanceOf(LessonNotFoundError)
  })
})
