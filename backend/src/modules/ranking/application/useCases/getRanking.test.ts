import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../../domain/networth'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { GetRankingUseCase } from './getRanking'

function snapshot(total: number): Snapshot {
  return { cash: total, variableIncomeValue: 0, fixedIncomeValue: 0, tradesExecuted: 0, total }
}

describe('GetRankingUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ordena por rentabilidade desc e reporta a posição do usuário logado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z')) // quarta, semana 24–30 ago

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'u3', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const netWorthByUserAndAsOf = new Map<string, number>([
      ['u1|baseline', 10000],
      ['u1|now', 11000], // +10%
      ['u2|baseline', 10000],
      ['u2|now', 12000], // +20%
      ['u3|baseline', 10000],
      ['u3|now', 9000], // -10%
    ])
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        const key = `${input.userId}|${input.asOf ? 'baseline' : 'now'}`
        return snapshot(netWorthByUserAndAsOf.get(key) ?? 0)
      },
    }
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
    )

    const result = await useCase.execute({ window: 'week', requestingUserId: 'u1' })

    expect(result.entries.map((e) => e.userId)).toEqual(['u2', 'u1', 'u3'])
    expect(result.requestingUserPosition).toBe(2)
  })

  it('resultado consistente independente de quando o usuário entrou — baseline usa MAX(windowStart, accountCreatedAt)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z')) // quarta, semana 24–30 ago

    const userDirectory = createFakeUserDirectory([
      { id: 'antes', createdAt: new Date('2026-01-01T00:00:00Z') }, // criada antes da janela
      { id: 'meio', createdAt: new Date('2026-08-25T00:00:00Z') }, // criada no meio da janela
    ])
    const calls: { userId: string; asOf?: Date }[] = []
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        calls.push(input)
        return snapshot(10000)
      },
    }
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
    )

    await useCase.execute({ window: 'week', requestingUserId: 'antes' })

    const baselineCallFor = (userId: string) =>
      calls.find((c) => c.userId === userId && c.asOf !== undefined)

    // "antes": baseline é o início da janela (segunda 00:00 UTC).
    expect(baselineCallFor('antes')?.asOf?.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    // "meio": baseline é a própria criação da conta, não o início da janela.
    expect(baselineCallFor('meio')?.asOf?.toISOString()).toBe('2026-08-25T00:00:00.000Z')
  })

  it('resposta nunca inclui patrimônio absoluto — só profitabilityPct por usuário (RNF09)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const getNetWorth = {
      async execute() {
        return snapshot(12345)
      },
    }
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
    )

    const result = await useCase.execute({ window: 'month', requestingUserId: 'u1' })

    expect(Object.keys(result.entries[0])).toEqual(['userId', 'profitabilityPct'])
  })

  it('requestingUserPosition é null se o usuário logado não estiver na lista', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const getNetWorth = {
      async execute() {
        return snapshot(10000)
      },
    }
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
    )

    const result = await useCase.execute({ window: 'week', requestingUserId: 'fantasma' })

    expect(result.requestingUserPosition).toBeNull()
  })
})
