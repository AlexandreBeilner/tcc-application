import { describe, expect, it } from 'vitest'
import { RetrospectiveNotAvailableError } from '../../domain/errors'
import { createFakeActivity, createFakeRepository, createFakeReturns } from '../../test/fakes/fakes'
import { GenerateMonthlyRetrospectivesUseCase } from './generateMonthlyRetrospectives'
import {
  GenerateRetrospectiveUseCase,
  GetRetrospectiveUseCase,
  ListRetrospectiveMonthsUseCase,
} from './getRetrospective'

const NOW = new Date('2026-10-10T12:00:00Z')

function build() {
  const activity = createFakeActivity({
    ana: new Date('2026-07-15T00:00:00Z'),
    bia: new Date('2026-10-02T00:00:00Z'),
  })
  const returns = createFakeReturns({ ana: 4.2 })
  const repository = createFakeRepository()
  const generate = new GenerateRetrospectiveUseCase(activity, returns, repository)
  const list = new ListRetrospectiveMonthsUseCase(activity, () => NOW)
  return {
    activity,
    returns,
    repository,
    generate,
    list,
    get: new GetRetrospectiveUseCase(generate, list),
    monthly: new GenerateMonthlyRetrospectivesUseCase(activity, repository, generate, () => NOW),
  }
}

describe('GetRetrospectiveUseCase', () => {
  it('devolve o mês completo: maior sequência, rentabilidade, duelos e ligas', async () => {
    const ctx = build()
    const view = await ctx.get.execute('ana', '2026-09')

    expect(view).toMatchObject({ lessonsCompleted: 6, achievementsUnlocked: 2, level: 5 })
    expect(view).toMatchObject({
      activeDays: [1, 2, 3, 9],
      daysInMonth: 30,
      longestStreak: 3,
      bestReturnPct: 4.2,
      duelsPlayed: 1,
      duelsWon: 1,
      leaguesActive: 2,
    })
  })

  it('mede a rentabilidade do mês inteiro (primeiro instante até o primeiro do mês seguinte)', async () => {
    const ctx = build()
    await ctx.get.execute('ana', '2026-09')
    expect(ctx.returns.calls[0].from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(ctx.returns.calls[0].to.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('arquiva: ler de novo não recalcula', async () => {
    const ctx = build()
    await ctx.get.execute('ana', '2026-09')
    expect(ctx.activity.reads).toBe(1)

    const again = await ctx.get.execute('ana', '2026-09')
    expect(ctx.activity.reads).toBe(1)
    expect(again.bestReturnPct).toBe(4.2)
  })

  it('mês inválido, anterior à conta ou ainda aberto não existe', async () => {
    const ctx = build()
    for (const month of ['setembro', '2026-13', '2026-06', '2026-10', '2026-11']) {
      await expect(ctx.get.execute('ana', month)).rejects.toBeInstanceOf(
        RetrospectiveNotAvailableError,
      )
    }
    // conta criada em outubro ainda não tem nenhum mês fechado
    await expect(ctx.get.execute('bia', '2026-09')).rejects.toBeInstanceOf(
      RetrospectiveNotAvailableError,
    )
    expect((await ctx.list.execute('bia')).months).toEqual([])
    expect((await ctx.list.execute('ana')).months).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  it('falha do motor não grava um arquivo pela metade: tenta de novo na próxima leitura', async () => {
    const ctx = build()
    ctx.returns.failFor.add('ana')
    await expect(ctx.get.execute('ana', '2026-09')).rejects.toThrow()
    expect(ctx.repository.rows.size).toBe(0)

    ctx.returns.failFor.clear()
    expect((await ctx.get.execute('ana', '2026-09')).level).toBe(5)
  })
})

describe('GenerateMonthlyRetrospectivesUseCase', () => {
  it('gera o mês anterior de quem já existia e pula quem entrou depois', async () => {
    const ctx = build()
    const summary = await ctx.monthly.execute()
    expect(summary).toEqual({ month: '2026-09', generated: 1, skipped: 1, failed: 0 })
    expect(ctx.repository.rows.has('ana|2026-09')).toBe(true)
  })

  it('é idempotente e uma falha não para as outras contas', async () => {
    const ctx = build()
    ctx.returns.failFor.add('ana')
    expect(await ctx.monthly.execute()).toMatchObject({ generated: 0, failed: 1 })

    ctx.returns.failFor.clear()
    expect(await ctx.monthly.execute()).toMatchObject({ generated: 1, failed: 0 })
    expect(await ctx.monthly.execute()).toMatchObject({ generated: 0, skipped: 2 })
  })
})
