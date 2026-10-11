import { describe, expect, it } from 'vitest'
import { InvalidAssemblyPauseError } from './errors'
import { isPaused, scopeKeyOf, validateNewPause, type AssemblyPause } from './pause'

function pause(overrides: Partial<AssemblyPause>): AssemblyPause {
  return {
    id: 'p1',
    scope: 'global',
    kind: null,
    subjectRef: null,
    reason: 'motivo',
    createdBy: 'admin-1',
    createdAt: new Date(0),
    liftedAt: null,
    liftedBy: null,
    ...overrides,
  }
}

describe('pausa das assembleias', () => {
  it('a chave do escopo distingue global de cada empresa', () => {
    expect(scopeKeyOf('global', null, null)).toBe('global')
    expect(scopeKeyOf('subject', 'shareholder', 'c1')).toBe('shareholder:c1')
    expect(scopeKeyOf('subject', 'shareholder', 'c2')).not.toBe(
      scopeKeyOf('subject', 'shareholder', 'c1'),
    )
  })

  it('a pausa global cobre qualquer assembleia', () => {
    expect(isPaused([pause({})], 'shareholder', 'c1')).toBe(true)
  })

  it('a pausa de uma empresa cobre só a dela', () => {
    const only = [pause({ scope: 'subject', kind: 'shareholder', subjectRef: 'c1' })]
    expect(isPaused(only, 'shareholder', 'c1')).toBe(true)
    expect(isPaused(only, 'shareholder', 'c2')).toBe(false)
    expect(isPaused(only, 'investor_macro', 'c1')).toBe(false)
  })

  it('pausa já retomada não cobre ninguém', () => {
    expect(isPaused([pause({ liftedAt: new Date(1) })], 'shareholder', 'c1')).toBe(false)
  })

  it('sem pausa, nada é coberto', () => {
    expect(isPaused([], 'shareholder', 'c1')).toBe(false)
  })

  describe('validateNewPause', () => {
    it('apara o motivo e normaliza a global sem empresa', () => {
      expect(validateNewPause({ scope: 'global', reason: '  revisão da pauta  ' })).toEqual({
        scope: 'global',
        kind: null,
        subjectRef: null,
        reason: 'revisão da pauta',
      })
    })

    it('a de uma empresa exige kind e empresa', () => {
      expect(
        validateNewPause({
          scope: 'subject',
          kind: 'shareholder',
          subjectRef: 'c1',
          reason: 'abc',
        }),
      ).toMatchObject({ scope: 'subject', kind: 'shareholder', subjectRef: 'c1' })
      expect(() => validateNewPause({ scope: 'subject', reason: 'abc' })).toThrow(
        InvalidAssemblyPauseError,
      )
    })

    it('a global não leva empresa', () => {
      expect(() => validateNewPause({ scope: 'global', subjectRef: 'c1', reason: 'abc' })).toThrow(
        /global/,
      )
    })

    it.each([
      ['curto', 'ab'],
      ['vazio', '   '],
      ['longo', 'x'.repeat(301)],
    ])('recusa motivo %s', (_n, reason) => {
      expect(() => validateNewPause({ scope: 'global', reason })).toThrow(InvalidAssemblyPauseError)
    })
  })
})
