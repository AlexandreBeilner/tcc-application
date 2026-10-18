import { describe, expect, it } from 'vitest'
import { createFakeDailyMetricsRepository } from '../../../test/fakes/fakeDailyRepositories'
import { RecordDailyMetricUseCase } from '../recordDailyMetric'
import { GetDailyMetricsUseCase } from './metrics'

const NOW = new Date('2026-11-10T12:00:00Z')

describe('RecordDailyMetricUseCase', () => {
  it('cada evento soma ao contador certo do dia UTC', async () => {
    const repo = createFakeDailyMetricsRepository()
    const record = new RecordDailyMetricUseCase(repo)

    await record.execute({ event: 'started', now: NOW })
    await record.execute({ event: 'started', now: NOW })
    await record.execute({ event: 'completed', now: NOW })
    await record.execute({ event: 'signup', now: NOW })
    await record.execute({ event: 'login', now: new Date('2026-11-11T00:00:00Z') })

    expect(Object.fromEntries(repo.counts)).toEqual({
      '2026-11-10|anon_started': 2,
      '2026-11-10|anon_completed': 1,
      '2026-11-10|origin_signup': 1,
      '2026-11-11|origin_login': 1,
    })
  })
})

describe('GetDailyMetricsUseCase', () => {
  it('junta contadores e jogos de quem tem conta, mais recente primeiro, com zeros', async () => {
    const repo = createFakeDailyMetricsRepository([
      { date: '2026-11-10', started: 5, completed: 4 },
      { date: '2026-11-08', started: 1, completed: 1 },
    ])
    await new RecordDailyMetricUseCase(repo).execute({ event: 'started', now: NOW })
    const get = new GetDailyMetricsUseCase(repo, () => NOW)

    const days = await get.execute({ days: 4 })

    expect(days.map((d) => d.date)).toEqual([
      '2026-11-10',
      '2026-11-09',
      '2026-11-08',
      '2026-11-07',
    ])
    expect(days[0]).toMatchObject({ anonStarted: 1, loggedStarted: 5, loggedCompleted: 4 })
    expect(days[1]).toMatchObject({ anonStarted: 0, loggedStarted: 0, signups: 0 })
    expect(days[2]).toMatchObject({ loggedStarted: 1, loggedCompleted: 1 })
  })

  it('limita a janela (padrão 30, máximo 90) e ignora o que está fora dela', async () => {
    const repo = createFakeDailyMetricsRepository([
      { date: '2026-01-01', started: 9, completed: 9 },
    ])
    const get = new GetDailyMetricsUseCase(repo, () => NOW)

    expect(await get.execute()).toHaveLength(30)
    expect(await get.execute({ days: 500 })).toHaveLength(90)
    expect(await get.execute({ days: 0 })).toHaveLength(1)
    expect((await get.execute({ days: 30 })).every((d) => d.loggedStarted === 0)).toBe(true)
  })
})
