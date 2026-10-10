import { describe, expect, it } from 'vitest'
import { RetrospectiveNotAvailableError } from '../../domain/errors'
import {
  createFakeActivity,
  createFakeMembership,
  createFakeRepository,
  createFakeReturns,
} from '../../test/fakes/fakes'
import { GenerateMonthlyRetrospectivesUseCase } from './generateMonthlyRetrospectives'
import {
  GenerateRetrospectiveUseCase,
  GetRetrospectiveUseCase,
  ListRetrospectiveMonthsUseCase,
} from './getRetrospective'

const NOW = new Date('2026-10-10T12:00:00Z')

function build(proIds: string[] = []) {
  const activity = createFakeActivity({
    ana: new Date('2026-07-15T00:00:00Z'),
    bia: new Date('2026-10-02T00:00:00Z'),
  })
  const returns = createFakeReturns({ ana: 4.2 })
  const repository = createFakeRepository()
  const generate = new GenerateRetrospectiveUseCase(activity, returns, repository)
  const list = new ListRetrospectiveMonthsUseCase(activity, () => NOW)
  const membership = createFakeMembership(proIds)
  return {
    activity,
    returns,
    repository,
    generate,
    list,
    get: new GetRetrospectiveUseCase(generate, list, membership),
    monthly: new GenerateMonthlyRetrospectivesUseCase(activity, repository, generate, () => NOW),
    membership,
  }
}

describe('GetRetrospectiveUseCase', () => {
  it('PRO recebe o conteúdo completo: maior sequência, rentabilidade, duelos e ligas', async () => {
    const ctx = build(['ana'])
    const view = await ctx.get.execute('ana', '2026-09')

    expect(view.full).toBe(true)
    expect(view).toMatchObject({ lessonsCompleted: 6, achievementsUnlocked: 2, level: 5 })
    expect(view.premium).toMatchObject({
      activeDays: [1, 2, 3, 9],
      daysInMonth: 30,
      longestStreak: 3,
      bestReturnPct: 4.2,
      duelsPlayed: 1,
      duelsWon: 1,
      leaguesActive: 2,
    })
  })

  it('quem não é PRO recebe só as 3 métricas simples, sem o conteúdo premium', async () => {
    const view = await build().get.execute('ana', '2026-09')
    expect(view.full).toBe(false)
    expect(view.premium).toBeNull()
    expect(JSON.stringify(view)).not.toContain('4.2')
  })

  it('mede a rentabilidade do mês inteiro (primeiro instante até o primeiro do mês seguinte)', async () => {
    const ctx = build()
    await ctx.get.execute('ana', '2026-09')
    expect(ctx.returns.calls[0].from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(ctx.returns.calls[0].to.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('arquiva: ler de novo não recalcula, e assinar depois libera o arquivo completo', async () => {
    const ctx = build()
    await ctx.get.execute('ana', '2026-09')
    expect(ctx.activity.reads).toBe(1)

    ctx.membership.ids.add('ana')
    const upgraded = await ctx.get.execute('ana', '2026-09')
    expect(ctx.activity.reads).toBe(1)
    expect(upgraded.premium?.bestReturnPct).toBe(4.2)
  })

  it('cancelar o PRO não apaga: o arquivo segue, só volta à versão simples', async () => {
    const ctx = build(['ana'])
    await ctx.get.execute('ana', '2026-09')
    ctx.membership.ids.delete('ana')
    const view = await ctx.get.execute('ana', '2026-09')
    expect(view.full).toBe(false)
    expect(ctx.repository.rows.size).toBe(1)
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
