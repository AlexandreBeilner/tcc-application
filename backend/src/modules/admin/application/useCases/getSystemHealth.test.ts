import { describe, expect, it } from 'vitest'
import type { HealthProbe } from '../ports/healthProbe'
import { createFakeEmailOutboxHealthReader } from '../../test/fakes/fakeEmailOutboxHealthReader'
import { GetSystemHealthUseCase, type SystemProbes } from './getSystemHealth'

const ok: HealthProbe = { check: async () => {} }
const failing = (message: string): HealthProbe => ({
  check: async () => {
    throw new Error(message)
  },
})
const slow: HealthProbe = { check: () => new Promise((resolve) => setTimeout(resolve, 60)) }
const never: HealthProbe = { check: () => new Promise(() => {}) }

function probes(overrides: Partial<SystemProbes> = {}): SystemProbes {
  return { engine: ok, gamification_db: ok, market_db: ok, redis: ok, ...overrides }
}

const outbox = createFakeEmailOutboxHealthReader()

const byKey = (health: Awaited<ReturnType<GetSystemHealthUseCase['execute']>>) =>
  Object.fromEntries(health.components.map((c) => [c.key, c]))

describe('GetSystemHealthUseCase', () => {
  it('marca tudo ok e inclui o próprio backend', async () => {
    const health = await new GetSystemHealthUseCase(
      probes(),
      outbox,
      1000,
      () => new Date('2026-10-03T12:00:00Z'),
    ).execute()

    expect(health.checked_at).toBe('2026-10-03T12:00:00.000Z')
    expect(health.components.map((c) => c.key)).toEqual([
      'backend',
      'engine',
      'gamification_db',
      'market_db',
      'redis',
      'email_outbox',
    ])
    expect(health.components.every((c) => c.status === 'ok')).toBe(true)
  })

  it('um componente que falha vira "fora" com o motivo e os outros seguem ok', async () => {
    const health = byKey(
      await new GetSystemHealthUseCase(probes({ redis: failing('ECONNREFUSED') }), outbox, 1000).execute(),
    )
    expect(health.redis).toMatchObject({ status: 'fora', latency_ms: null, detail: 'ECONNREFUSED' })
    expect(health.engine.status).toBe('ok')
    expect(health.gamification_db.status).toBe('ok')
  })

  it('um componente que não responde no prazo vira "fora"', async () => {
    const health = byKey(await new GetSystemHealthUseCase(probes({ engine: never }), outbox, 30).execute())
    expect(health.engine.status).toBe('fora')
    expect(health.engine.detail).toContain('sem resposta')
  })

  it('mede a latência de quem respondeu', async () => {
    const health = byKey(
      await new GetSystemHealthUseCase(probes({ market_db: slow }), outbox, 1000).execute(),
    )
    expect(health.market_db.status).toBe('ok')
    expect(health.market_db.latency_ms).toBeGreaterThanOrEqual(50)
  })

  describe('fila de e-mail', () => {
    it('com a fila em dia fica ok e mostra os contadores', async () => {
      const health = byKey(
        await new GetSystemHealthUseCase(
          probes(),
          createFakeEmailOutboxHealthReader({ pending: 2, oldestPendingAgeMs: 30_000 }),
        ).execute(),
      )
      expect(health.email_outbox).toMatchObject({
        status: 'ok',
        detail: '2 pendente(s), 0 falha(s) em 24 h',
      })
    })

    it('pendente mais velho que 10 min vira degradado, dizendo há quanto tempo espera', async () => {
      const health = byKey(
        await new GetSystemHealthUseCase(
          probes(),
          createFakeEmailOutboxHealthReader({ pending: 1, oldestPendingAgeMs: 12 * 60_000 }),
        ).execute(),
      )
      expect(health.email_outbox.status).toBe('degradado')
      expect(health.email_outbox.detail).toContain('espera há 12 min')
    })

    it('falha na leitura da fila vira fora, sem derrubar os outros componentes', async () => {
      const health = byKey(
        await new GetSystemHealthUseCase(probes(), {
          read: async () => {
            throw new Error('tabela inacessível')
          },
        }).execute(),
      )
      expect(health.email_outbox).toMatchObject({
        status: 'fora',
        latency_ms: null,
        detail: 'tabela inacessível',
      })
      expect(health.engine.status).toBe('ok')
    })
  })
})
