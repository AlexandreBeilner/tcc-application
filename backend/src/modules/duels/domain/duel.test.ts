import { describe, expect, it } from 'vitest'
import {
  decideDuel,
  duelEnd,
  invitationExpiry,
  occupiesSlot,
  samePercent,
  viewerOutcome,
  type Duel,
} from './duel'

const op = (returnPct: number, operated = true) => ({ returnPct, operated })

describe('decideDuel', () => {
  it.each([
    ['maior rentabilidade vence (desafiante)', op(5), op(2), 'challenger', 'profitability'],
    ['maior rentabilidade vence (desafiado)', op(-1), op(0.5), 'opponent', 'profitability'],
    ['os dois no vermelho: perde menos vence', op(-5), op(-2), 'opponent', 'profitability'],
    ['mesma rentabilidade na precisão exibida é empate', op(3.001), op(3.004), 'draw', 'tie'],
    ['0,00% dos dois, ambos operaram, é empate', op(0), op(0), 'draw', 'tie'],
    [
      'só o desafiante operou: vence por abandono',
      op(-8),
      op(0, false),
      'challenger',
      'abandonment',
    ],
    ['só o desafiado operou: vence por abandono', op(0, false), op(-8), 'opponent', 'abandonment'],
    ['nenhum operou: empate', op(0, false), op(0, false), 'draw', 'both_inactive'],
  ] as const)('%s', (_name, challenger, opponent, outcome, reason) => {
    expect(decideDuel(challenger, opponent)).toEqual({ outcome, reason })
  })
})

describe('samePercent', () => {
  it('compara com 2 casas', () => {
    expect(samePercent(1.004, 1.001)).toBe(true)
    expect(samePercent(1.01, 1.02)).toBe(false)
  })
})

describe('prazos', () => {
  it('duelo dura 7 dias e o desafio vale 7 dias', () => {
    const t = new Date('2026-10-10T12:00:00Z')
    expect(duelEnd(t).toISOString()).toBe('2026-10-17T12:00:00.000Z')
    expect(invitationExpiry(t).toISOString()).toBe('2026-10-17T12:00:00.000Z')
  })
})

function duel(overrides: Partial<Duel>): Duel {
  return {
    id: 'd',
    challengerId: 'a',
    opponentId: 'b',
    status: 'active',
    createdAt: new Date(),
    expiresAt: new Date(),
    startsAt: null,
    endsAt: null,
    finishedAt: null,
    outcome: null,
    reason: null,
    challengerPct: null,
    opponentPct: null,
    challengerOperated: null,
    opponentOperated: null,
    xpAwardedAt: null,
    ...overrides,
  }
}

describe('occupiesSlot', () => {
  it('ativo ocupa vaga dos dois; pendente só de quem desafiou; encerrados não ocupam', () => {
    expect(occupiesSlot(duel({ status: 'active' }), 'a')).toBe(true)
    expect(occupiesSlot(duel({ status: 'active' }), 'b')).toBe(true)
    expect(occupiesSlot(duel({ status: 'pending' }), 'a')).toBe(true)
    expect(occupiesSlot(duel({ status: 'pending' }), 'b')).toBe(false)
    for (const status of ['finished', 'declined', 'cancelled', 'expired'] as const) {
      expect(occupiesSlot(duel({ status }), 'a')).toBe(false)
    }
    expect(occupiesSlot(duel({ status: 'active' }), 'c')).toBe(false)
  })
})

describe('viewerOutcome', () => {
  it('traduz o desfecho para quem olha', () => {
    const finished = duel({ status: 'finished', outcome: 'challenger' })
    expect(viewerOutcome(finished, 'a')).toBe('won')
    expect(viewerOutcome(finished, 'b')).toBe('lost')
    expect(viewerOutcome(duel({ status: 'finished', outcome: 'draw' }), 'b')).toBe('draw')
    expect(viewerOutcome(duel({ status: 'active' }), 'a')).toBeNull()
  })
})
