import { describe, expect, it } from 'vitest'
import { InvalidProgressionAdjustmentError } from '../../domain/errors'
import { createFakeAchievementChecker } from '../../test/fakes/fakeAchievementChecker'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { AdjustProgressionUseCase } from './adjustProgression'

function build() {
  const repository = createFakeProgressionRepository()
  const checker = createFakeAchievementChecker()
  const useCase = new AdjustProgressionUseCase(repository, checker, () => '2026-10-03')
  return { repository, checker, useCase }
}

describe('AdjustProgressionUseCase', () => {
  it('soma XP e recalcula o nível a partir do total, inclusive com salto de níveis', async () => {
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1', xpDelta: 700 })

    expect(result).toMatchObject({ xp: 700, level: 4 })
  })

  it('tira XP e o nível desce junto', async () => {
    const { useCase } = build()
    await useCase.execute({ userId: 'u1', xpDelta: 700 })

    const result = await useCase.execute({ userId: 'u1', xpDelta: -500 })

    expect(result).toMatchObject({ xp: 200, level: 2 })
  })

  it('recusa tirar mais XP do que o usuário tem e deixa o saldo intacto', async () => {
    const { useCase, repository } = build()
    await useCase.execute({ userId: 'u1', xpDelta: 100 })

    await expect(useCase.execute({ userId: 'u1', xpDelta: -101 })).rejects.toBeInstanceOf(
      InvalidProgressionAdjustmentError,
    )
    expect((await repository.findByUserId('u1'))?.xp).toBe(100)
  })

  it.each([
    ['sem nada', {}],
    ['xp zero', { xpDelta: 0 }],
    ['xp fracionado', { xpDelta: 1.5 }],
    ['xp NaN', { xpDelta: Number.NaN }],
    ['streak negativo', { currentStreak: -1 }],
    ['streak fracionado', { currentStreak: 2.5 }],
    ['streak infinito', { currentStreak: Number.POSITIVE_INFINITY }],
  ])('recusa ajuste inválido (%s)', async (_name, input) => {
    const { useCase } = build()

    await expect(useCase.execute({ userId: 'u1', ...input })).rejects.toBeInstanceOf(
      InvalidProgressionAdjustmentError,
    )
  })

  it('define o streak, mantém o maior histórico e marca a sequência como viva hoje', async () => {
    const { useCase } = build()

    const first = await useCase.execute({ userId: 'u1', currentStreak: 12 })
    const lowered = await useCase.execute({ userId: 'u1', currentStreak: 3 })

    expect(first).toMatchObject({
      currentStreak: 12,
      longestStreak: 12,
      lastQualifyingActivityDate: '2026-10-03',
    })
    expect(lowered).toMatchObject({ currentStreak: 3, longestStreak: 12 })
  })

  it('zerar o streak limpa a data da última atividade e não mexe no XP', async () => {
    const { useCase } = build()
    await useCase.execute({ userId: 'u1', xpDelta: 100 })
    await useCase.execute({ userId: 'u1', currentStreak: 5 })

    const result = await useCase.execute({ userId: 'u1', currentStreak: 0 })

    expect(result).toMatchObject({
      xp: 100,
      currentStreak: 0,
      lastQualifyingActivityDate: null,
    })
  })

  it('reavalia as conquistas depois de gravar, e uma falha nisso não desfaz o ajuste', async () => {
    const { useCase, checker, repository } = build()
    checker.failWith = new Error('motor fora')
    const errorSpy = console.error
    console.error = () => undefined
    try {
      await useCase.execute({ userId: 'u1', xpDelta: 100 })
    } finally {
      console.error = errorSpy
    }

    expect(checker.calls).toEqual(['u1'])
    expect((await repository.findByUserId('u1'))?.xp).toBe(100)
  })
})
