import { describe, expect, it } from 'vitest'
import {
  generateReferralCode,
  nextMilestone,
  parseReferralCode,
  promoEndFor,
  reachedMilestones,
} from './referral'

const LADDER = [
  { threshold: 5, rewardDays: 7 },
  { threshold: 20, rewardDays: 7 },
  { threshold: 50, rewardDays: 7 },
]

describe('código de indicação', () => {
  it('gera 8 caracteres do alfabeto sem ambiguidade', () => {
    let i = 0
    const code = generateReferralCode(() => i++ % 31)
    expect(code).toHaveLength(8)
    expect(parseReferralCode(code)).toBe(code)
  })

  it.each([
    ['abcd2345', 'ABCD2345'],
    ['  ABCD2345 ', 'ABCD2345'],
  ])('normaliza %j', (raw, expected) => {
    expect(parseReferralCode(raw)).toBe(expected)
  })

  it.each([['ABCD234'], ['ABCD23456'], ['ABCD0234'], ['ABCDI234'], [''], [null], [42]])(
    'recusa %j',
    (raw) => {
      expect(parseReferralCode(raw)).toBeNull()
    },
  )
})

describe('reachedMilestones', () => {
  it.each([
    [0, []],
    [4, []],
    [5, [5]],
    [19, [5]],
    [20, [5, 20]],
    [50, [5, 20, 50]],
    [99, [5, 20, 50]],
    [100, [5, 20, 50, 100]],
    [260, [5, 20, 50, 100, 150, 200, 250]],
  ])('com %i indicações alcança %j', (count, thresholds) => {
    expect(reachedMilestones(count, LADDER).map((m) => m.threshold)).toEqual(thresholds)
  })

  it('cada marco da cauda vale 1 semana', () => {
    const tail = reachedMilestones(150, LADDER).filter((m) => m.threshold > 50)
    expect(tail.every((m) => m.rewardDays === 7)).toBe(true)
  })

  it('aceita a escada fora de ordem e vazia', () => {
    expect(reachedMilestones(20, [...LADDER].reverse()).map((m) => m.threshold)).toEqual([5, 20])
    expect(reachedMilestones(100, []).map((m) => m.threshold)).toEqual([50, 100])
  })
})

describe('nextMilestone', () => {
  it.each([
    [0, 5],
    [5, 20],
    [49, 50],
    [50, 100],
    [99, 100],
    [100, 150],
  ])('com %i indicações o próximo marco é %i', (count, threshold) => {
    expect(nextMilestone(count, LADDER).threshold).toBe(threshold)
  })
})

describe('promoEndFor', () => {
  const now = new Date('2026-10-11T00:00:00Z')
  it('começa agora para quem não é PRO', () => {
    expect(promoEndFor(now, null, 7)).toEqual(new Date('2026-10-18T00:00:00Z'))
  })
  it('empilha depois do acesso atual', () => {
    expect(promoEndFor(now, new Date('2026-11-01T00:00:00Z'), 7)).toEqual(
      new Date('2026-11-08T00:00:00Z'),
    )
  })
  it('ignora acesso que já acabou', () => {
    expect(promoEndFor(now, new Date('2026-10-01T00:00:00Z'), 7)).toEqual(
      new Date('2026-10-18T00:00:00Z'),
    )
  })
})
