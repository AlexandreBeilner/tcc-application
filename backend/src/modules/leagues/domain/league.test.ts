import { describe, expect, it } from 'vitest'
import { InvalidLeagueNameError } from './errors'
import { isLeagueArchived, isOpen, normalizeLeagueName, type League } from './league'

describe('normalizeLeagueName', () => {
  it.each([
    ['  Turma  do   TCC ', 'Turma do TCC'],
    ['abc', 'abc'],
    ['a'.repeat(40), 'a'.repeat(40)],
  ])('aceita e normaliza %j', (raw, expected) => {
    expect(normalizeLeagueName(raw)).toBe(expected)
  })

  it.each([['ab'], ['   a  '], [''], ['a'.repeat(41)]])('recusa %j', (raw) => {
    expect(() => normalizeLeagueName(raw)).toThrow(InvalidLeagueNameError)
  })
})

describe('isLeagueArchived', () => {
  it('arquivada só quando o dono não é PRO agora', () => {
    expect(isLeagueArchived(false)).toBe(true)
    expect(isLeagueArchived(true)).toBe(false)
  })
})

describe('isOpen', () => {
  const base: League = {
    id: 'l',
    ownerId: 'o',
    name: 'Liga',
    window: 'week',
    createdAt: new Date(),
    closedAt: null,
  }
  it('aberta enquanto o dono não encerrou', () => {
    expect(isOpen(base)).toBe(true)
    expect(isOpen({ ...base, closedAt: new Date() })).toBe(false)
  })
})
