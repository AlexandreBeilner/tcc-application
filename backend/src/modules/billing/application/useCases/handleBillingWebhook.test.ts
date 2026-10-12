import { describe, expect, it } from 'vitest'
import {
  createFakeBillingUserLookup,
  createFakeBillingWebhookEventLog,
  createFakeEntitlementProvider,
  createFakeBillingMailer,
  createFakeFunnelRecorder,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, entitlement } from '../../test/fixtures'
import { HandleBillingWebhookUseCase, type BillingWebhookEvent } from './handleBillingWebhook'
import { SyncSubscriptionUseCase } from './syncSubscription'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

function setup() {
  const provider = createFakeEntitlementProvider({ [USER_A]: entitlement(), [USER_B]: null })
  const repo = createFakeSubscriptionRepository()
  const log = createFakeBillingWebhookEventLog()
  const sync = new SyncSubscriptionUseCase(
    provider,
    repo,
    createFakeSubscriptionCache(),
    createFakeBillingMailer(),
    createFakeFunnelRecorder(),
    () => NOW,
  )
  const useCase = new HandleBillingWebhookUseCase(
    log,
    createFakeBillingUserLookup([USER_A, USER_B]),
    sync,
    () => NOW,
  )
  return { provider, repo, log, useCase }
}

const event = (overrides: Partial<BillingWebhookEvent> = {}): BillingWebhookEvent => ({
  id: 'evt-1',
  type: 'INITIAL_PURCHASE',
  occurredAt: NOW,
  appUserIds: [USER_A],
  ...overrides,
})

describe('HandleBillingWebhookUseCase', () => {
  it('compra inicial reconsulta o provedor e grava a projeção', async () => {
    const { repo, log, useCase } = setup()

    expect(await useCase.execute(event())).toBe('synced')

    expect(repo.rows.get(USER_A)?.productId).toBe('pro_monthly')
    expect(log.recorded.get('evt-1')).toBe('INITIAL_PURCHASE')
  })

  it('evento repetido não reaplica', async () => {
    const { provider, useCase } = setup()
    await useCase.execute(event())
    provider.calls.length = 0

    expect(await useCase.execute(event())).toBe('duplicate')
    expect(provider.calls).toEqual([])
  })

  it.each(['TEST', 'EXPERIMENT_ENROLLMENT', 'VIRTUAL_CURRENCY_TRANSACTION', 'ALGO_NOVO'])(
    '%s é registrado e ignorado, sem chamar o provedor',
    async (type) => {
      const { provider, log, useCase } = setup()
      expect(await useCase.execute(event({ type }))).toBe('ignored')
      expect(provider.calls).toEqual([])
      expect(log.recorded.has('evt-1')).toBe(true)
    },
  )

  it('ids anônimos do RevenueCat são descartados', async () => {
    const { provider, useCase } = setup()
    await useCase.execute(event({ appUserIds: ['$RCAnonymousID:abc123', 'não-é-uuid'] }))
    expect(provider.calls).toEqual([])
  })

  it('usuário que não é nosso é ignorado, mas o evento é registrado', async () => {
    const { provider, log, useCase } = setup()
    const stranger = '33333333-3333-4333-8333-333333333333'
    expect(await useCase.execute(event({ appUserIds: [stranger] }))).toBe('synced')
    expect(provider.calls).toEqual([])
    expect(log.recorded.has('evt-1')).toBe(true)
  })

  it('TRANSFER sincroniza origem e destino', async () => {
    const { provider, useCase } = setup()
    await useCase.execute(event({ type: 'TRANSFER', appUserIds: [USER_A, USER_B] }))
    expect(provider.calls.sort()).toEqual([USER_A, USER_B].sort())
  })

  it('o mesmo usuário citado em vários campos é sincronizado uma vez só, mesmo com caixa diferente', async () => {
    const { provider, useCase } = setup()
    await useCase.execute(event({ appUserIds: [USER_A, USER_A.toUpperCase(), USER_A] }))
    expect(provider.calls).toEqual([USER_A])
  })

  it('falha do provedor sobe e NÃO registra o evento (o RevenueCat reenvia)', async () => {
    const { provider, log, useCase } = setup()
    provider.failWith = new Error('fora do ar')

    await expect(useCase.execute(event())).rejects.toThrow('fora do ar')
    expect(log.recorded.has('evt-1')).toBe(false)
  })
})
