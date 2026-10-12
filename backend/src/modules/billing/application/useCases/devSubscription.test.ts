import { describe, expect, it } from 'vitest'
import {
  createFakeFunnelRecorder,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW } from '../../test/fixtures'
import { toStatus } from '../../domain/subscription'
import { DEV_PRODUCT_PREFIX, DevSubscriptionUseCase } from './devSubscription'

function setup() {
  const repo = createFakeSubscriptionRepository([])
  const cache = createFakeSubscriptionCache()
  const funnel = createFakeFunnelRecorder()
  return {
    repo,
    cache,
    funnel,
    useCase: new DevSubscriptionUseCase(repo, cache, funnel, () => NOW),
  }
}

describe('DevSubscriptionUseCase', () => {
  it('compra mensal grava assinatura ativa da loja informada, com produto marcado como falso', async () => {
    const { repo, useCase } = setup()
    await useCase.purchase('u1', 'monthly', 'play_store')

    const row = repo.rows.get('u1')
    expect(row?.productId).toBe(`${DEV_PRODUCT_PREFIX}monthly`)
    expect(toStatus(row ?? null, NOW)).toMatchObject({
      isPro: true,
      plan: 'monthly',
      store: 'play_store',
      willRenew: true,
    })
  })

  it('compra anual vira plano anual', async () => {
    const { repo, useCase } = setup()
    await useCase.purchase('u1', 'annual', 'app_store')
    expect(toStatus(repo.rows.get('u1') ?? null, NOW)).toMatchObject({
      plan: 'annual',
      store: 'app_store',
    })
  })

  it('invalida o cache, para a próxima leitura enxergar a compra', async () => {
    const { cache, useCase } = setup()
    cache.entries.set('u1', { subscription: null })
    await useCase.purchase('u1', 'monthly', 'play_store')
    expect(cache.entries.has('u1')).toBe(false)
  })

  it('cancelar encerra a vigência agora e mantém a linha', async () => {
    const { repo, useCase } = setup()
    await useCase.purchase('u1', 'monthly', 'play_store')
    await useCase.cancel('u1')
    expect(repo.rows.has('u1')).toBe(true)
    expect(toStatus(repo.rows.get('u1') ?? null, new Date(NOW.getTime() + 1000)).isPro).toBe(false)
  })

  it('registra "assinou" e "cancelou" no funil', async () => {
    const { funnel, useCase } = setup()
    await useCase.purchase('u1', 'annual', 'play_store')
    await useCase.cancel('u1')
    expect(funnel.events.map((e) => [e.name, e.plan])).toEqual([
      ['subscribed', 'annual'],
      ['cancelled', 'annual'],
    ])
  })

  it('cancelar quem nunca assinou não faz nada', async () => {
    const { repo, funnel, useCase } = setup()
    await useCase.cancel('u1')
    expect(repo.rows.size).toBe(0)
    expect(funnel.events).toHaveLength(0)
  })
})
