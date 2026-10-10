import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeAchievementsExporter } from '../../test/fakes/fakeAchievementsExporter'
import { createFakeFriendshipsExporter } from '../../test/fakes/fakeFriendshipsExporter'
import { createFakeLessonProgressExporter } from '../../test/fakes/fakeLessonProgressExporter'
import { createFakeMissionProgressExporter } from '../../test/fakes/fakeMissionProgressExporter'
import { createFakeProgressionExporter } from '../../test/fakes/fakeProgressionExporter'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { ExportUserDataUseCase } from './exportUserData'

async function build() {
  const userRepository = createFakeUserRepository()
  const alice = await userRepository.createUser({
    name: 'Alice',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'hashed:senha',
  })
  const bob = await userRepository.createUser({
    name: 'Bob',
    email: 'bob@example.com',
    username: 'bob',
    passwordHash: 'hashed:senha',
  })

  const accountMailer = createFakeAccountMailer()
  const useCase = new ExportUserDataUseCase(
    userRepository,
    createFakeProgressionExporter({
      [alice.id]: {
        xp: 100,
        level: 2,
        currentStreak: 3,
        longestStreak: 5,
        lastQualifyingActivityDate: '2026-08-24',
      },
    }),
    createFakeLessonProgressExporter({
      [alice.id]: [
        { lessonId: 'l1', currentStep: 3, completedAt: new Date('2026-08-20T00:00:00Z') },
      ],
    }),
    createFakeAchievementsExporter({
      [alice.id]: [{ achievementId: 'a1', unlockedAt: new Date('2026-08-21T00:00:00Z') }],
    }),
    createFakeFriendshipsExporter({
      [alice.id]: [
        {
          id: 'f1',
          requesterId: alice.id,
          addresseeId: bob.id,
          status: 'accepted',
          createdAt: new Date('2026-08-19T00:00:00Z'),
          respondedAt: new Date('2026-08-19T01:00:00Z'),
        },
      ],
    }),
    createFakeMissionProgressExporter({
      [alice.id]: [
        { missionId: 'm1', missionDate: '2026-08-24', status: 'completed', completedAt: null },
      ],
    }),
    accountMailer,
    () => 'evento-1',
  )

  return { useCase, alice, bob, accountMailer }
}

describe('ExportUserDataUseCase', () => {
  it('agrega os dados do usuário nas tabelas que o backend já possui', async () => {
    const { useCase, alice } = await build()

    const result = await useCase.execute({ userId: alice.id })

    expect(result.user.username).toBe('alice')
    expect(result.progression.xp).toBe(100)
    expect(result.lessonProgress).toHaveLength(1)
    expect(result.achievements).toHaveLength(1)
    expect(result.friendships).toHaveLength(1)
    expect(result.missionProgress).toHaveLength(1)
  })

  it('nunca inclui password_hash no bloco de usuário', async () => {
    const { useCase, alice } = await build()

    const result = await useCase.execute({ userId: alice.id })

    expect(Object.keys(result.user)).not.toContain('passwordHash')
  })

  it('devolve só os dados do próprio usuário, nunca de outro', async () => {
    const { useCase, bob } = await build()

    const result = await useCase.execute({ userId: bob.id })

    expect(result.user.username).toBe('bob')
    // Bob não tem nenhum dado seedado nos fakes — confirma que o export de
    // alice não vaza pra cá.
    expect(result.lessonProgress).toEqual([])
    expect(result.achievements).toEqual([])
    expect(result.friendships).toEqual([])
    expect(result.missionProgress).toEqual([])
  })

  it('404 pra usuário inexistente', async () => {
    const { useCase } = await build()

    await expect(useCase.execute({ userId: 'nope' })).rejects.toBeInstanceOf(UserNotFoundError)
  })

  it('avisa por e-mail que os dados foram exportados (E7)', async () => {
    const { useCase, alice, accountMailer } = await build()

    await useCase.execute({ userId: alice.id })

    expect(accountMailer.exports).toEqual([
      { userId: alice.id, to: 'alice@example.com', name: 'Alice', eventId: 'evento-1' },
    ])
  })

  it('falha ao enfileirar o aviso não impede a exportação', async () => {
    const { useCase, alice, accountMailer } = await build()
    accountMailer.failWith(new Error('outbox fora do ar'))

    const data = await useCase.execute({ userId: alice.id })

    expect(data.user.id).toBe(alice.id)
  })
})
