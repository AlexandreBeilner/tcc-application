import { describe, expect, it } from 'vitest'
import { generateReferralCode, parseReferralCode } from './referral'

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
