import { describe, expect, it } from 'vitest'
import { denialMessage, resolveVoteAccess, type VoteAccessFacts } from './voting'

const base: VoteAccessFacts = { open: true, eligible: true }

describe('resolveVoteAccess', () => {
  it.each<[string, Partial<VoteAccessFacts>, string | null]>([
    ['acionista com a votação aberta vota', {}, null],
    ['fora da janela', { open: false }, 'not_open'],
    ['sem posição na data de corte', { eligible: false }, 'not_shareholder'],
    ['a janela vem antes da posição', { open: false, eligible: false }, 'not_open'],
  ])('%s', (_name, facts, expected) => {
    expect(resolveVoteAccess({ ...base, ...facts })).toBe(expected)
  })
})

describe('denialMessage', () => {
  it.each(['not_open', 'not_shareholder'] as const)(
    'a mensagem de %s não tem travessão nem culpa',
    (reason) => {
      const text = denialMessage(reason)
      expect(text).not.toContain('—')
      expect(text.length).toBeGreaterThan(10)
    },
  )
})
