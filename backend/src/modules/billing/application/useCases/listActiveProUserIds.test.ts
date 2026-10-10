import { describe, expect, it } from 'vitest'
import { buildSubscription } from '../../domain/subscription'
import { createFakeSubscriptionRepository } from '../../test/fakes/fakes'
import { NOW, day, entitlement } from '../../test/fixtures'
import { ListActiveProUserIdsUseCase } from './listActiveProUserIds'

function sub(userId: string, overrides = {}) {
  return buildSubscription(userId, entitlement(overrides), NOW, null)
}

describe('ListActiveProUserIdsUseCase', () => {
  const repo = createFakeSubscriptionRepository([
    sub('ativo'),
    sub('vencido', { expiresAt: day(-3) }),
    sub('reembolsado', { refundedAt: day(-1) }),
    sub('vitalicio', { store: 'promotional', expiresAt: null }),
  ])
  const useCase = new ListActiveProUserIdsUseCase(repo, () => NOW)

  it('devolve só quem tem plano ativo agora', async () => {
    const ids = await useCase.execute(['ativo', 'vencido', 'reembolsado', 'vitalicio', 'nunca'])
    expect([...ids].sort()).toEqual(['ativo', 'vitalicio'])
  })

  it('lista vazia não consulta nada e devolve conjunto vazio', async () => {
    expect((await useCase.execute([])).size).toBe(0)
  })

  it('ids repetidos não duplicam a consulta', async () => {
    const ids = await useCase.execute(['ativo', 'ativo'])
    expect([...ids]).toEqual(['ativo'])
  })
})
