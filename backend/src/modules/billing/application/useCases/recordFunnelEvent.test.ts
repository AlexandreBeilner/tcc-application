import { describe, expect, it } from 'vitest'
import { createFakeFunnelRecorder } from '../../test/fakes/fakes'
import { NOW } from '../../test/fixtures'
import { RecordFunnelEventUseCase } from './recordFunnelEvent'

describe('RecordFunnelEventUseCase', () => {
  it('grava o evento com a origem e a chave do dia', async () => {
    const recorder = createFakeFunnelRecorder()
    await new RecordFunnelEventUseCase(recorder, () => NOW).execute('u1', {
      event: 'invite_viewed',
      source: 'league',
    })

    expect(recorder.events).toEqual([
      {
        userId: 'u1',
        name: 'invite_viewed',
        source: 'league',
        plan: null,
        dedupeKey: 'invite_viewed:u1:league:2026-10-10',
        at: NOW,
      },
    ])
  })

  it('repetir o mesmo evento no mesmo dia não infla o funil', async () => {
    const recorder = createFakeFunnelRecorder()
    const useCase = new RecordFunnelEventUseCase(recorder, () => NOW)
    await useCase.execute('u1', { event: 'plans_opened', source: 'direct' })
    await useCase.execute('u1', { event: 'plans_opened', source: 'direct' })
    expect(recorder.events).toHaveLength(1)
  })

  it('o plano escolhido vai junto na compra iniciada', async () => {
    const recorder = createFakeFunnelRecorder()
    await new RecordFunnelEventUseCase(recorder, () => NOW).execute('u1', {
      event: 'purchase_started',
      plan: 'annual',
    })
    expect(recorder.events[0]).toMatchObject({ source: null, plan: 'annual' })
  })
})
