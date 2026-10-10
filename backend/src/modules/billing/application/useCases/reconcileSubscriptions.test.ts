import { describe, expect, it } from 'vitest'
import type { ReconciliationAudience } from '../ports/reconciliationAudience'
import {
  createFakeEntitlementProvider,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, day, entitlement } from '../../test/fixtures'
import { buildSubscription } from '../../domain/subscription'
import { ReconcileSubscriptionsUseCase, type ReconcileOptions } from './reconcileSubscriptions'
import { SyncSubscriptionUseCase } from './syncSubscription'

const OPTIONS: ReconcileOptions = {
  staleAfterMs: 12 * 3_600_000,
  expiredGraceMs: 3 * 86_400_000,
  batchSize: 10,
  delayBetweenMs: 0,
}

function setup(ids: string[]) {
  const calls: Parameters<ReconciliationAudience['findStale']>[0][] = []
  const audience: ReconciliationAudience = {
    async findStale(params) {
      calls.push(params)
      return ids
    },
  }
  const provider = createFakeEntitlementProvider()
  const repo = createFakeSubscriptionRepository()
  const sync = new SyncSubscriptionUseCase(provider, repo, createFakeSubscriptionCache(), () => NOW)
  const useCase = new ReconcileSubscriptionsUseCase(audience, sync, OPTIONS, () => NOW)
  return { calls, provider, repo, useCase }
}

describe('ReconcileSubscriptionsUseCase', () => {
  it('pede ao audience quem está velho e quem vale conferir, com o lote configurado', async () => {
    const { calls, useCase } = setup([])
    await useCase.execute()
    expect(calls).toEqual([
      {
        staleBefore: new Date(NOW.getTime() - OPTIONS.staleAfterMs),
        relevantSince: new Date(NOW.getTime() - OPTIONS.expiredGraceMs),
        limit: 10,
      },
    ])
  })

  it('corrige a divergência: ativa localmente, mas o provedor já não tem o entitlement', async () => {
    const { provider, repo, useCase } = setup(['u1'])
    repo.rows.set('u1', buildSubscription('u1', entitlement({ expiresAt: day(20) }), day(-2), null))
    provider.states.set('u1', null) // cancelamento/transferência que o webhook perdeu

    const result = await useCase.execute()

    expect(result).toEqual({ checked: 1, failed: 0 })
    expect(repo.rows.get('u1')?.expiresAt).toEqual(NOW)
  })

  it('corrige o outro lado: vencida localmente, mas renovada no provedor', async () => {
    const { provider, repo, useCase } = setup(['u1'])
    repo.rows.set('u1', buildSubscription('u1', entitlement({ expiresAt: day(-1) }), day(-2), null))
    provider.states.set('u1', entitlement({ expiresAt: day(30) }))

    await useCase.execute()

    expect(repo.rows.get('u1')?.expiresAt).toEqual(day(30))
  })

  it('uma falha não para o lote: os demais são conferidos e a falha é contada', async () => {
    const { provider, repo, useCase } = setup(['u1', 'u2'])
    provider.states.set('u2', entitlement())
    const original = provider.getEntitlement.bind(provider)
    provider.getEntitlement = async (userId) => {
      if (userId === 'u1') throw new Error('timeout')
      return original(userId)
    }

    const result = await useCase.execute()

    expect(result).toEqual({ checked: 2, failed: 1 })
    expect(repo.rows.has('u2')).toBe(true)
  })
})
