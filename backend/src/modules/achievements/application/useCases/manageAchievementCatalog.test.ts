import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../domain/achievement'
import {
  AchievementNameTakenError,
  AchievementNotFoundError,
  InvalidAchievementError,
} from '../../domain/errors'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { createFakeProgressSnapshotReader } from '../../test/fakes/fakeProgressSnapshotReader'
import { CheckAndUnlockAchievementsUseCase } from './checkAndUnlockAchievements'
import { ListAchievementsUseCase } from './listAchievements'
import {
  CreateAchievementUseCase,
  ListAchievementCatalogUseCase,
  UpdateAchievementUseCase,
} from './manageAchievementCatalog'

const streak7: Achievement = {
  id: 'a1',
  name: 'Primeira Semana',
  description: 'Sete dias seguidos.',
  criteriaType: 'streak_days',
  criteriaValue: 7,
  isActive: true,
}

function build() {
  const repository = createFakeAchievementRepository([streak7])
  return {
    repository,
    list: new ListAchievementCatalogUseCase(repository),
    create: new CreateAchievementUseCase(repository),
    update: new UpdateAchievementUseCase(repository),
  }
}

describe('ListAchievementCatalogUseCase', () => {
  it('lista ativas e desativadas, com quantos usuários ganharam cada uma', async () => {
    const { repository, list, update } = build()
    await repository.unlock('u1', 'a1')
    await repository.unlock('u2', 'a1')
    await update.execute('a1', { isActive: false })

    const catalog = await list.execute()

    expect(catalog).toEqual([{ ...streak7, isActive: false, unlockedCount: 2 }])
  })
})

describe('CreateAchievementUseCase', () => {
  it('cria ativa, com o critério da lista fechada', async () => {
    const { create } = build()

    const created = await create.execute({
      name: ' Trader Ativo ',
      description: null,
      criteriaType: 'trades_executed',
      criteriaValue: 20,
    })

    expect(created).toMatchObject({
      name: 'Trader Ativo',
      criteriaType: 'trades_executed',
      criteriaValue: 20,
      isActive: true,
    })
  })

  it('recusa meta inválida, critério desconhecido e nome repetido', async () => {
    const { create } = build()
    const base = { description: null, criteriaType: 'streak_days' as const, criteriaValue: 5 }

    await expect(
      create.execute({ ...base, name: 'Nova', criteriaValue: 0 }),
    ).rejects.toBeInstanceOf(InvalidAchievementError)
    await expect(
      create.execute({
        ...base,
        name: 'Nova',
        criteriaType: 'expressao_livre' as unknown as 'streak_days',
      }),
    ).rejects.toBeInstanceOf(InvalidAchievementError)
    await expect(create.execute({ ...base, name: 'primeira semana' })).rejects.toBeInstanceOf(
      AchievementNameTakenError,
    )
  })
})

describe('UpdateAchievementUseCase', () => {
  it('edita só o que veio e mantém o resto', async () => {
    const { update } = build()

    const updated = await update.execute('a1', {
      description: 'Uma semana inteira.',
      criteriaValue: 10,
    })

    expect(updated).toEqual({
      ...streak7,
      description: 'Uma semana inteira.',
      criteriaValue: 10,
    })
  })

  it('valida o estado final: trocar pra um critério de contagem com meta em reais fracionada é recusado', async () => {
    const { update } = build()
    await update.execute('a1', { criteriaType: 'net_worth', criteriaValue: 12000.5 })

    await expect(update.execute('a1', { criteriaType: 'streak_days' })).rejects.toBeInstanceOf(
      InvalidAchievementError,
    )
  })

  it('recusa renomear pra um nome já usado por outra conquista, mas aceita manter o próprio', async () => {
    const { repository, update } = build()
    await repository.create({
      name: 'Fiel',
      description: null,
      criteriaType: 'streak_days',
      criteriaValue: 30,
    })

    await expect(update.execute('a1', { name: 'fiel' })).rejects.toBeInstanceOf(
      AchievementNameTakenError,
    )
    expect((await update.execute('a1', { name: 'Primeira Semana' })).name).toBe('Primeira Semana')
  })

  it('recusa conquista inexistente', async () => {
    const { update } = build()

    await expect(update.execute('nao-existe', { isActive: false })).rejects.toBeInstanceOf(
      AchievementNotFoundError,
    )
  })
})

describe('conquista desativada', () => {
  function buildWithSnapshot() {
    const repository = createFakeAchievementRepository([streak7])
    const update = new UpdateAchievementUseCase(repository)
    // Todo usuário de teste já cumpre o critério (streak de 30 dias).
    const cumpre = {
      netWorth: 0,
      streakDays: 30,
      lessonsCompleted: 0,
      tradesExecuted: 0,
      microDecisionsStreak: 0,
      tracksCompletedNoErrors: 0,
      lessonsReviewed: 0,
    }
    const snapshot = createFakeProgressSnapshotReader({ u1: cumpre, u2: cumpre })
    return {
      repository,
      update,
      check: new CheckAndUnlockAchievementsUseCase(repository, snapshot),
      listForUser: new ListAchievementsUseCase(repository, snapshot),
    }
  }

  it('não é mais concedida, mesmo com o critério cumprido', async () => {
    const { check, update, repository } = buildWithSnapshot()
    await update.execute('a1', { isActive: false })

    const newlyUnlocked = await check.execute({ userId: 'u1' })

    expect(newlyUnlocked).toEqual([])
    expect(await repository.listUnlockedForUser('u1')).toEqual([])
  })

  it('não revoga as já concedidas e continua na lista de quem a ganhou', async () => {
    const { check, update, listForUser, repository } = buildWithSnapshot()
    await check.execute({ userId: 'u1' })
    await update.execute('a1', { isActive: false })

    await check.execute({ userId: 'u1' })

    expect(await repository.listUnlockedForUser('u1')).toHaveLength(1)
    const mine = await listForUser.execute({ userId: 'u1' })
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ id: 'a1', unlocked: true })
  })

  it('some da lista de quem ainda não a ganhou, e volta quando reativada', async () => {
    const { update, listForUser } = buildWithSnapshot()
    await update.execute('a1', { isActive: false })

    expect(await listForUser.execute({ userId: 'u2' })).toEqual([])

    await update.execute('a1', { isActive: true })
    expect(await listForUser.execute({ userId: 'u2' })).toHaveLength(1)
  })
})
