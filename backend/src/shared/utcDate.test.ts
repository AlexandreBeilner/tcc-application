import { describe, expect, it } from 'vitest'
import { utcDateString } from './utcDate'

describe('utcDateString', () => {
  it('formata a data em YYYY-MM-DD, em UTC', () => {
    expect(utcDateString(new Date('2026-03-05T23:59:59Z'))).toBe('2026-03-05')
  })

  it('não escorrega pro dia seguinte por causa de fuso local', () => {
    expect(utcDateString(new Date('2026-03-05T00:00:00Z'))).toBe('2026-03-05')
  })
})
