import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakePromotionalPro,
  createFakeReferralRepository,
  createFakeRewardRepository,
  passThroughLock,
  type FakePromotionalPro,
  type FakeReferralRepository,
  type FakeRewardRepository,
} from '../../test/fakes/fakes'
import { AttributeReferralUseCase } from './attributeReferral'
import { GetMyReferralUseCase } from './getMyReferral'
import { QualifyReferralUseCase } from './qualifyReferral'

const LADDER = [
  { threshold: 5, rewardDays: 7 },
  { threshold: 20, rewardDays: 7 },
  { threshold: 50, rewardDays: 7 },
]
const NOW = new Date('2026-10-11T00:00:00Z')

let referrals: FakeReferralRepository
let rewards: FakeRewardRepository
let pro: FakePromotionalPro
let checks: string[]
let qualify: QualifyReferralUseCase
let attribute: AttributeReferralUseCase

beforeEach(() => {
  referrals = createFakeReferralRepository()
  rewards = createFakeRewardRepository(LADDER)
  pro = createFakePromotionalPro()
  checks = []
  qualify = new QualifyReferralUseCase(
    referrals,
    rewards,
    passThroughLock,
    pro,
    { check: async (id) => void checks.push(id) },
    () => NOW,
  )
  attribute = new AttributeReferralUseCase(referrals)
  referrals.codes.set('owner', 'ABCD2345')
})

async function invite(count: number, from = 0) {
  for (let i = from; i < from + count; i++) {
    expect(await attribute.execute(`friend-${i}`, 'ABCD2345')).toBe(true)
    await qualify.execute(`friend-${i}`)
  }
}

describe('AttributeReferralUseCase', () => {
  it('registra a indicação como pendente, normalizando o código', async () => {
    expect(await attribute.execute('f1', ' abcd2345 ')).toBe(true)
    expect(referrals.referrals.get('f1')).toEqual({ referrerId: 'owner', status: 'pending' })
  })

  it('bloqueia a auto-indicação', async () => {
    expect(await attribute.execute('owner', 'ABCD2345')).toBe(false)
    expect(referrals.referrals.size).toBe(0)
  })

  it('ignora código inválido, desconhecido ou ausente', async () => {
    expect(await attribute.execute('f1', 'curto')).toBe(false)
    expect(await attribute.execute('f1', 'ZZZZ2345')).toBe(false)
    expect(await attribute.execute('f1', undefined)).toBe(false)
    expect(referrals.referrals.size).toBe(0)
  })

  it('uma conta indicada conta uma vez só: a segunda indicação é ignorada', async () => {
    referrals.codes.set('other', 'EFGH6789')
    expect(await attribute.execute('f1', 'ABCD2345')).toBe(true)
    expect(await attribute.execute('f1', 'EFGH6789')).toBe(false)
    expect(referrals.referrals.get('f1')?.referrerId).toBe('owner')
  })
})

describe('QualifyReferralUseCase', () => {
  it('só vale depois da primeira lição: pendente não conta', async () => {
    await attribute.execute('f1', 'ABCD2345')
    expect(await referrals.countQualified('owner')).toBe(0)
    expect(pro.grants).toEqual([])
  })

  it('qualificar a mesma conta duas vezes conta uma vez', async () => {
    await attribute.execute('f1', 'ABCD2345')
    await qualify.execute('f1')
    await qualify.execute('f1')
    expect(await referrals.countQualified('owner')).toBe(1)
    expect(checks).toEqual(['owner'])
  })

  it('conta sem indicação não faz nada', async () => {
    await qualify.execute('ninguem')
    expect(checks).toEqual([])
  })

  it('o quinto marco concede 1 semana de PRO, uma única vez', async () => {
    await invite(4)
    expect(pro.grants).toEqual([])
    await invite(1, 4)
    expect(pro.grants).toEqual([{ userId: 'owner', endsAt: new Date('2026-10-18T00:00:00Z') }])
    await invite(3, 5)
    expect(pro.grants).toHaveLength(1)
  })

  it('os marcos seguintes empilham depois do acesso atual', async () => {
    await invite(20)
    expect(pro.grants.map((g) => g.endsAt.toISOString())).toEqual([
      '2026-10-18T00:00:00.000Z',
      '2026-10-25T00:00:00.000Z',
    ])
  })

  it('acima de 50 concede +1 semana a cada 50, sem teto', async () => {
    await invite(100)
    expect(pro.grants).toHaveLength(4)
    expect([...rewards.rows.values()].map((r) => r.threshold)).toEqual([5, 20, 50, 100])
  })

  it('falha do provedor deixa o marco pendente e a próxima indicação repete sem duplicar', async () => {
    pro.failNext = 1
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await invite(5)
    expect(rewards.rows.get('owner:5')?.status).toBe('pending')
    const persistedEnd = rewards.rows.get('owner:5')?.promoEndsAt
    expect(persistedEnd).toEqual(new Date('2026-10-18T00:00:00Z'))

    await invite(1, 5)
    expect(rewards.rows.get('owner:5')?.status).toBe('granted')
    expect(pro.grants).toEqual([{ userId: 'owner', endsAt: persistedEnd }])
    spy.mockRestore()
  })

  it('reexecutar o ajuste de marcos não concede de novo', async () => {
    await invite(5)
    await qualify.settleRewards('owner')
    await qualify.settleRewards('owner')
    expect(pro.grants).toHaveLength(1)
  })

  it('falha ao reavaliar conquistas não desfaz a indicação', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = new QualifyReferralUseCase(
      referrals,
      rewards,
      passThroughLock,
      pro,
      {
        check: async () => {
          throw new Error('x')
        },
      },
      () => NOW,
    )
    await attribute.execute('f1', 'ABCD2345')
    await failing.execute('f1')
    expect(await referrals.countQualified('owner')).toBe(1)
    spy.mockRestore()
  })
})

describe('GetMyReferralUseCase', () => {
  const get = () => new GetMyReferralUseCase(referrals, rewards, () => 0)

  it('cria o código na primeira leitura e devolve o mesmo depois', async () => {
    const first = await get().execute('newbie')
    expect(first.code).toMatch(/^[A-Z2-9]{8}$/)
    expect((await get().execute('newbie')).code).toBe(first.code)
  })

  it('mostra progresso, próximo marco e a escada', async () => {
    await attribute.execute('p1', 'ABCD2345')
    await invite(5, 10)
    const view = await get().execute('owner')
    expect(view.qualifiedCount).toBe(5)
    expect(view.pendingCount).toBe(1)
    expect(view.next).toEqual({ threshold: 20, rewardDays: 7, remaining: 15 })
    expect(view.milestones).toEqual([
      { threshold: 5, rewardDays: 7, reached: true, granted: true },
      { threshold: 20, rewardDays: 7, reached: false, granted: false },
      { threshold: 50, rewardDays: 7, reached: false, granted: false },
    ])
  })

  it('marco alcançado e ainda não concedido aparece como alcançado, não concedido', async () => {
    pro.failNext = 1
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await invite(5, 10)
    const view = await get().execute('owner')
    expect(view.milestones[0]).toMatchObject({ threshold: 5, reached: true, granted: false })
    spy.mockRestore()
  })
})
