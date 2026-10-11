import { describe, expect, it } from 'vitest'
import { FUNNEL_RETENTION_MONTHS } from '../../domain/funnel'
import { PurgeOldFunnelEventsUseCase } from './purgeOldFunnelEvents'

describe('PurgeOldFunnelEventsUseCase', () => {
  it('apaga o que passou de 12 meses e devolve quantos', async () => {
    const cutoffs: Date[] = []
    const useCase = new PurgeOldFunnelEventsUseCase(
      {
        async purgeOlderThan(cutoff) {
          cutoffs.push(cutoff)
          return 7
        },
      },
      () => new Date('2026-10-11T12:00:00Z'),
    )

    expect(FUNNEL_RETENTION_MONTHS).toBe(12)
    expect(await useCase.execute()).toBe(7)
    expect(cutoffs[0].toISOString()).toBe('2025-10-11T12:00:00.000Z')
  })
})
