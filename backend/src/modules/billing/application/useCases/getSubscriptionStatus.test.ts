import { describe, expect, it } from 'vitest'
import { buildSubscription } from '../../domain/subscription'
import { ProRequiredError } from '../../domain/errors'
import { ProAccessGuard } from '../proAccessGuard'
import {
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, day, entitlement } from '../../test/fixtures'
import { GetSubscriptionStatusUseCase } from './getSubscriptionStatus'

function setup(rows = [buildSubscription('pro-user', entitlement(), NOW, null)]) {
  const repo = createFakeSubscriptionRepository(rows)
  const cache = createFakeSubscriptionCache()
  let clock = NOW
  const useCase = new GetSubscriptionStatusUseCase(repo, cache, () => clock)
  return { repo, cache, useCase, setClock: (d: Date) => (clock = d) }
}

describe('GetSubscriptionStatusUseCase', () => {
  it('assinante ativo é PRO', async () => {
    expect((await setup().useCase.execute('pro-user')).isPro).toBe(true)
  })

  it('quem nunca assinou é free e isso também fica em cache', async () => {
    const { useCase, cache } = setup()
    expect((await useCase.execute('free-user')).isPro).toBe(false)
    expect(cache.entries.get('free-user')).toEqual({ subscription: null })
  })

  it('segunda leitura vem do cache, sem consultar o banco', async () => {
    const { useCase, repo } = setup()
    await useCase.execute('pro-user')
    repo.rows.clear() // se consultasse o banco, viraria free
    expect((await useCase.execute('pro-user')).isPro).toBe(true)
  })

  it('cancelamento processado vale na próxima leitura (cache invalidado), sem depender de token', async () => {
    const { useCase, repo, cache } = setup()
    expect((await useCase.execute('pro-user')).isPro).toBe(true)

    repo.rows.set(
      'pro-user',
      buildSubscription('pro-user', entitlement({ expiresAt: day(-1) }), NOW, null),
    )
    await cache.invalidate('pro-user')

    expect((await useCase.execute('pro-user')).isPro).toBe(false)
  })

  it('vencimento no meio do TTL do cache vira free: a decisão usa a hora de agora', async () => {
    const { useCase, setClock } = setup()
    expect((await useCase.execute('pro-user')).isPro).toBe(true)
    setClock(day(21)) // passou do vencimento (day(20)) com o cache ainda quente
    expect((await useCase.execute('pro-user')).isPro).toBe(false)
  })
})

describe('ProAccessGuard', () => {
  it('deixa o PRO passar', async () => {
    const { useCase } = setup()
    await expect(new ProAccessGuard(useCase).assertPro('pro-user')).resolves.toBeUndefined()
  })

  it('barra quem é free com ProRequiredError', async () => {
    const { useCase } = setup()
    await expect(new ProAccessGuard(useCase).assertPro('free-user')).rejects.toBeInstanceOf(
      ProRequiredError,
    )
  })

  it('ProRequiredError carrega o code que o handler de erro reconhece', () => {
    expect(new ProRequiredError().code).toBe('PRO_REQUIRED')
  })
})
