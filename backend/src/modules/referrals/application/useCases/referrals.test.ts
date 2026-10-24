import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeReferralRepository, type FakeReferralRepository } from '../../test/fakes/fakes'
import { AttributeReferralUseCase } from './attributeReferral'
import { GetMyReferralUseCase } from './getMyReferral'
import { QualifyReferralUseCase } from './qualifyReferral'

const NOW = new Date('2026-10-11T00:00:00Z')

let referrals: FakeReferralRepository
let checks: string[]
let qualify: QualifyReferralUseCase
let attribute: AttributeReferralUseCase

beforeEach(() => {
  referrals = createFakeReferralRepository()
  checks = []
  qualify = new QualifyReferralUseCase(
    referrals,
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
    expect(checks).toEqual([])
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

  it('cada indicação válida reavalia as conquistas do indicador', async () => {
    await invite(3)
    expect(await referrals.countQualified('owner')).toBe(3)
    expect(checks).toEqual(['owner', 'owner', 'owner'])
  })

  it('falha ao reavaliar conquistas não desfaz a indicação', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = new QualifyReferralUseCase(
      referrals,
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
  const get = () => new GetMyReferralUseCase(referrals, () => 0)

  it('cria o código na primeira leitura e devolve o mesmo depois', async () => {
    const first = await get().execute('newbie')
    expect(first.code).toMatch(/^[A-Z2-9]{8}$/)
    expect((await get().execute('newbie')).code).toBe(first.code)
  })

  it('mostra convites válidos e pendentes', async () => {
    await attribute.execute('p1', 'ABCD2345')
    await invite(5, 10)
    expect(await get().execute('owner')).toEqual({
      code: 'ABCD2345',
      qualifiedCount: 5,
      pendingCount: 1,
    })
  })
})
