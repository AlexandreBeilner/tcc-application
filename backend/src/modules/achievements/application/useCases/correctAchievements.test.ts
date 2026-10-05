import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../domain/achievement'
import {
  AchievementAlreadyUnlockedError,
  AchievementNotFoundError,
  AchievementNotUnlockedError,
} from '../../domain/errors'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { GrantAchievementUseCase, RevokeAchievementUseCase } from './correctAchievements'

const streak7: Achievement = {
  id: 'a-streak-7',
  name: 'Primeira Semana',
  description: null,
  criteriaType: 'streak_days',
  criteriaValue: 7,
  isActive: true,
}

function build() {
  const repository = createFakeAchievementRepository([streak7])
  return {
    repository,
    grant: new GrantAchievementUseCase(repository),
    revoke: new RevokeAchievementUseCase(repository),
  }
}

describe('GrantAchievementUseCase', () => {
  it('concede a conquista sem checar o critério', async () => {
    const { grant, repository } = build()

    const result = await grant.execute('u1', streak7.id)

    expect(result).toEqual(streak7)
    expect(await repository.listUnlockedForUser('u1')).toHaveLength(1)
  })

  it('recusa conquista que não existe e conquista que o usuário já tem', async () => {
    const { grant } = build()

    await expect(grant.execute('u1', 'nao-existe')).rejects.toBeInstanceOf(AchievementNotFoundError)
    await grant.execute('u1', streak7.id)
    await expect(grant.execute('u1', streak7.id)).rejects.toBeInstanceOf(
      AchievementAlreadyUnlockedError,
    )
  })
})

describe('RevokeAchievementUseCase', () => {
  it('remove a conquista do usuário', async () => {
    const { grant, revoke, repository } = build()
    await grant.execute('u1', streak7.id)

    await revoke.execute('u1', streak7.id)

    expect(await repository.listUnlockedForUser('u1')).toEqual([])
  })

  it('recusa conquista que não existe e conquista que o usuário não tem', async () => {
    const { revoke } = build()

    await expect(revoke.execute('u1', 'nao-existe')).rejects.toBeInstanceOf(
      AchievementNotFoundError,
    )
    await expect(revoke.execute('u1', streak7.id)).rejects.toBeInstanceOf(
      AchievementNotUnlockedError,
    )
  })
})
