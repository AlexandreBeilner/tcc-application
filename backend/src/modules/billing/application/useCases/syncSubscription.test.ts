import { describe, expect, it } from 'vitest'
import { buildSubscription } from '../../domain/subscription'
import {
  createFakeEntitlementProvider,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, day, entitlement } from '../../test/fixtures'
import { SyncSubscriptionUseCase } from './syncSubscription'

function setup(initial: Record<string, ReturnType<typeof entitlement> | null> = {}) {
  const provider = createFakeEntitlementProvider(initial)
  const repo = createFakeSubscriptionRepository()
  const cache = createFakeSubscriptionCache()
  const useCase = new SyncSubscriptionUseCase(provider, repo, cache, () => NOW)
  return { provider, repo, cache, useCase }
}

describe('SyncSubscriptionUseCase', () => {
  it('grava a projeção com o que o provedor devolveu e invalida o cache', async () => {
    const { repo, cache, useCase } = setup({ u1: entitlement() })

    await useCase.execute('u1', { lastEventAt: day(-1) })

    expect(repo.rows.get('u1')).toMatchObject({
      userId: 'u1',
      productId: 'pro_monthly',
      period: 'monthly',
      lastEventAt: day(-1),
      updatedAt: NOW,
    })
    expect(cache.invalidated).toEqual(['u1'])
  })

  it('é convergente: rodar duas vezes deixa o mesmo estado', async () => {
    const { repo, useCase } = setup({ u1: entitlement() })

    await useCase.execute('u1')
    const first = repo.rows.get('u1')
    await useCase.execute('u1')

    expect(repo.rows.get('u1')).toEqual(first)
  })

  it('evento fora de ordem converge: grava o estado de agora, não o do evento', async () => {
    const { provider, repo, useCase } = setup({ u1: entitlement({ expiresAt: day(-1) }) })
    await useCase.execute('u1') // chegou "expirou"
    provider.states.set('u1', entitlement({ expiresAt: day(30) })) // o provedor já renovou
    await useCase.execute('u1') // chegou o evento antigo depois

    expect(repo.rows.get('u1')?.expiresAt).toEqual(day(30))
  })

  it('entitlement que sumiu encerra a vigência agora, sem apagar a linha', async () => {
    const { repo, cache, useCase } = setup({ u1: null })
    repo.rows.set('u1', buildSubscription('u1', entitlement({ expiresAt: day(20) }), NOW, null))

    await useCase.execute('u1')

    const row = repo.rows.get('u1')
    expect(row).toBeDefined()
    expect(row?.expiresAt).toEqual(NOW)
    expect(row?.graceExpiresAt).toBeNull()
    expect(cache.invalidated).toEqual(['u1'])
  })

  it('sem entitlement e sem linha não cria nada', async () => {
    const { repo, useCase } = setup({ u1: null })
    await useCase.execute('u1')
    expect(repo.rows.size).toBe(0)
  })

  it('linha já vencida não é reescrita quando o entitlement some', async () => {
    const { repo, useCase } = setup({ u1: null })
    const expired = buildSubscription('u1', entitlement({ expiresAt: day(-5) }), day(-6), null)
    repo.rows.set('u1', expired)

    await useCase.execute('u1')

    expect(repo.rows.get('u1')).toBe(expired)
  })

  it('falha do provedor sobe e não grava nem invalida', async () => {
    const { provider, repo, cache, useCase } = setup({ u1: entitlement() })
    provider.failWith = new Error('RevenueCat fora do ar')

    await expect(useCase.execute('u1')).rejects.toThrow('RevenueCat fora do ar')
    expect(repo.rows.size).toBe(0)
    expect(cache.invalidated).toEqual([])
  })
})
