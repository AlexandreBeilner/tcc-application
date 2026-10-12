import { describe, expect, it } from 'vitest'
import { denialMessage, resolveVoteAccess, type VoteAccessFacts } from './voting'

const params = { monthlyFreeCredits: 1, freeCreditMinLevel: 3 }
const base: VoteAccessFacts = {
  open: true,
  eligible: true,
  hasVoted: false,
  isPro: false,
  emailVerified: true,
  level: 3,
  creditsUsedThisMonth: 0,
}

describe('resolveVoteAccess', () => {
  it.each<[string, Partial<VoteAccessFacts>, string | null]>([
    ['não PRO com crédito, e-mail verificado e nível 3', {}, null],
    [
      'PRO sem e-mail verificado, nível 1 e sem crédito',
      { isPro: true, emailVerified: false, level: 1, creditsUsedThisMonth: 1 },
      null,
    ],
    ['fora da janela, mesmo sendo PRO', { open: false, isPro: true }, 'not_open'],
    [
      'sem posição na data de corte, mesmo sendo PRO',
      { eligible: false, isPro: true },
      'not_shareholder',
    ],
    [
      'sem posição vem antes de e-mail e nível',
      { eligible: false, emailVerified: false, level: 1 },
      'not_shareholder',
    ],
    ['e-mail não verificado', { emailVerified: false }, 'email_not_verified'],
    ['nível abaixo do mínimo', { level: 2 }, 'level_too_low'],
    ['e-mail vem antes do nível', { emailVerified: false, level: 1 }, 'email_not_verified'],
    ['crédito do mês esgotado', { creditsUsedThisMonth: 1 }, 'no_credit'],
    [
      'quem já votou troca o voto sem PRO, crédito, nível nem e-mail',
      { hasVoted: true, emailVerified: false, level: 1, creditsUsedThisMonth: 1 },
      null,
    ],
    [
      'quem já votou continua sujeito à janela e à posição',
      { hasVoted: true, open: false },
      'not_open',
    ],
  ])('%s', (_name, facts, expected) => {
    expect(resolveVoteAccess({ ...base, ...facts }, params)).toBe(expected)
  })

  it('respeita os parâmetros (nível e saldo não são fixos)', () => {
    expect(resolveVoteAccess({ ...base, level: 4 }, { ...params, freeCreditMinLevel: 5 })).toBe(
      'level_too_low',
    )
    expect(
      resolveVoteAccess({ ...base, creditsUsedThisMonth: 1 }, { ...params, monthlyFreeCredits: 2 }),
    ).toBeNull()
  })
})

describe('denialMessage', () => {
  it('usa o texto combinado para o crédito e cita o nível configurado', () => {
    expect(denialMessage('no_credit', params)).toBe('requer plano PRO ou crédito de voto')
    expect(denialMessage('level_too_low', { freeCreditMinLevel: 5 })).toContain('nível 5')
  })

  it.each([
    'not_open',
    'not_shareholder',
    'email_not_verified',
    'level_too_low',
    'no_credit',
  ] as const)('a mensagem de %s não tem travessão nem culpa', (reason) => {
    const text = denialMessage(reason, params)
    expect(text).not.toContain('—')
    expect(text.length).toBeGreaterThan(10)
  })
})
