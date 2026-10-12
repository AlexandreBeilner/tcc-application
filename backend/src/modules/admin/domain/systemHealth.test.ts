import { describe, expect, it } from 'vitest'
import {
  classifyLatency,
  classifyOutbox,
  DEGRADED_LATENCY_MS,
  OUTBOX_FAILED_ALERT_COUNT,
  OUTBOX_STALE_PENDING_MS,
} from './systemHealth'

describe('classifyLatency', () => {
  it('é ok até o limite e degradado acima dele', () => {
    expect(classifyLatency(0)).toBe('ok')
    expect(classifyLatency(DEGRADED_LATENCY_MS)).toBe('ok')
    expect(classifyLatency(DEGRADED_LATENCY_MS + 1)).toBe('degradado')
  })
})

describe('classifyOutbox', () => {
  const stats = { pending: 0, failedLast24h: 0, oldestPendingAgeMs: null }

  it('fila vazia é ok', () => {
    expect(classifyOutbox(stats)).toEqual({
      status: 'ok',
      detail: '0 pendente(s), 0 falha(s) em 24 h',
    })
  })

  it('pendente com exatamente 10 min ainda é ok; acima disso alerta', () => {
    const at = (ms: number) => classifyOutbox({ ...stats, pending: 1, oldestPendingAgeMs: ms })
    expect(at(OUTBOX_STALE_PENDING_MS).status).toBe('ok')
    expect(at(OUTBOX_STALE_PENDING_MS + 1).status).toBe('degradado')
    expect(at(95 * 60_000).detail).toContain('espera há 1 h 35 min')
  })

  it('falhas só alertam a partir do limite', () => {
    expect(classifyOutbox({ ...stats, failedLast24h: OUTBOX_FAILED_ALERT_COUNT - 1 }).status).toBe(
      'ok',
    )
    const alert = classifyOutbox({ ...stats, failedLast24h: OUTBOX_FAILED_ALERT_COUNT })
    expect(alert.status).toBe('degradado')
    expect(alert.detail).toContain('falhas acumulando')
  })
})
