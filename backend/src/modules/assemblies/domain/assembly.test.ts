import { describe, expect, it } from 'vitest'
import {
  brtMonthKey,
  isFirstVote,
  isOpenForVoting,
  tallyVotes,
  validateNewAssembly,
  type AgendaOption,
  type Assembly,
  type HoldingsSnapshot,
  type NewAssemblyInput,
  type Vote,
} from './assembly'
import { InvalidAssemblyError } from './errors'
import { shareholderPolicies } from './shareholderPolicies'

const A: AgendaOption = {
  id: 'oa',
  assemblyId: 'x',
  key: 'a',
  label: 'A',
  gain: 'g',
  loss: 'l',
  effect: {},
  position: 0,
}
const B: AgendaOption = { ...A, id: 'ob', key: 'b', label: 'B', position: 1 }
const t = new Date('2026-10-10T12:00:00Z')

function vote(userId: string, optionId: string): Vote {
  return { assemblyId: 'x', userId, optionId, createdAt: t, updatedAt: t }
}

function snapshot(holdings: Record<string, number>): HoldingsSnapshot {
  return {
    takenAt: t,
    holdings: Object.entries(holdings).map(([userId, quantity]) => ({ userId, quantity })),
  }
}

describe('tallyVotes (política shareholder)', () => {
  const holdings = { u1: 100, u2: 30, u3: 30, u4: 10 }
  const cases: Array<{
    name: string
    votes: Vote[]
    snap?: Record<string, number>
    minVoters?: number
    outcome: string
    reason: string
    winner: string | null
    voters: number
    weights?: [number, number]
  }> = [
    {
      name: 'peso por ações, só entre quem votou (u4 não votou e não pesa)',
      votes: [vote('u1', 'oa'), vote('u2', 'ob'), vote('u3', 'ob')],
      outcome: 'approved',
      reason: 'decided',
      winner: 'oa',
      voters: 3,
      weights: [100, 60],
    },
    {
      name: 'muitos votos pequenos não vencem uma posição grande',
      votes: [vote('u1', 'ob'), vote('u2', 'oa'), vote('u3', 'oa')],
      outcome: 'approved',
      reason: 'decided',
      winner: 'ob',
      voters: 3,
      weights: [60, 100],
    },
    {
      name: 'empate no topo mantém o status quo',
      votes: [vote('u2', 'oa'), vote('u3', 'ob'), vote('u4', 'ob'), vote('u1', 'oa')],
      snap: { u1: 20, u2: 10, u3: 15, u4: 15 },
      outcome: 'not_approved',
      reason: 'tie',
      winner: null,
      voters: 4,
    },
    {
      name: 'abaixo do mínimo de votantes distintos não passa',
      votes: [vote('u1', 'oa'), vote('u2', 'oa')],
      outcome: 'not_approved',
      reason: 'quorum',
      winner: null,
      voters: 2,
    },
    {
      name: 'mínimo configurável',
      votes: [vote('u1', 'oa'), vote('u2', 'ob')],
      minVoters: 2,
      outcome: 'approved',
      reason: 'decided',
      winner: 'oa',
      voters: 2,
    },
    {
      name: 'voto sem posição na data de corte é descartado (e não conta para o mínimo)',
      votes: [vote('u1', 'oa'), vote('u2', 'oa'), vote('intruso', 'oa')],
      outcome: 'not_approved',
      reason: 'quorum',
      winner: null,
      voters: 2,
    },
    {
      name: 'voto em opção que não é da pauta é descartado',
      votes: [vote('u1', 'oa'), vote('u2', 'oa'), vote('u3', 'zzz')],
      outcome: 'not_approved',
      reason: 'quorum',
      winner: null,
      voters: 2,
    },
    {
      name: 'ninguém votou',
      votes: [],
      outcome: 'not_approved',
      reason: 'quorum',
      winner: null,
      voters: 0,
    },
  ]

  it.each(cases)('$name', (c) => {
    const result = tallyVotes([A, B], c.votes, snapshot(c.snap ?? holdings), shareholderPolicies, {
      minVoters: c.minVoters ?? 3,
    })
    expect(result.outcome).toBe(c.outcome)
    expect(result.reason).toBe(c.reason)
    expect(result.winningOptionId).toBe(c.winner)
    expect(result.voters).toBe(c.voters)
    if (c.weights) expect(result.totals.map((x) => x.weight)).toEqual(c.weights)
  })
})

describe('troca de voto', () => {
  it('um voto por pessoa: a apuração usa o último, sem contar duas vezes', () => {
    // O repositório faz upsert por (assembleia, pessoa); aqui o estado final é um voto só.
    const final = [vote('u1', 'ob'), vote('u2', 'oa'), vote('u3', 'oa')]
    const result = tallyVotes(
      [A, B],
      final,
      snapshot({ u1: 100, u2: 30, u3: 30 }),
      shareholderPolicies,
      { minVoters: 3 },
    )
    expect(result.voters).toBe(3)
    expect(result.winningOptionId).toBe('ob')
  })

  it('isFirstVote só é verdadeiro até a pessoa ter um voto gravado', () => {
    expect(isFirstVote([], 'u1')).toBe(true)
    expect(isFirstVote([vote('u1', 'oa')], 'u1')).toBe(false)
    expect(isFirstVote([vote('u2', 'oa')], 'u1')).toBe(true)
  })
})

describe('janela de voto', () => {
  const base = {
    status: 'open',
    opensAt: new Date('2026-10-10T00:00:00Z'),
    closesAt: new Date('2026-10-17T00:00:00Z'),
  } as Assembly
  it.each([
    ['antes de abrir', 'open', '2026-10-09T23:59:59Z', false],
    ['na abertura', 'open', '2026-10-10T00:00:00Z', true],
    ['durante', 'open', '2026-10-12T00:00:00Z', true],
    ['no instante do fechamento', 'open', '2026-10-17T00:00:00Z', false],
    ['já fechada', 'closed', '2026-10-12T00:00:00Z', false],
    ['ainda agendada', 'scheduled', '2026-10-12T00:00:00Z', false],
  ])('%s', (_name, status, at, expected) => {
    expect(isOpenForVoting({ ...base, status } as Assembly, new Date(at))).toBe(expected)
  })
})

describe('validateNewAssembly', () => {
  const ok: NewAssemblyInput = {
    kind: 'shareholder',
    subjectRef: 'BNDD3',
    dedupeKey: 'k',
    snapshotAt: new Date('2026-10-10T00:00:00Z'),
    opensAt: new Date('2026-10-10T00:00:00Z'),
    closesAt: new Date('2026-10-17T00:00:00Z'),
    effectAppliesAt: new Date('2026-10-17T00:00:00Z'),
    options: [A, B].map(({ key, label, gain, loss, effect }) => ({
      key,
      label,
      gain,
      loss,
      effect,
    })),
  }
  it('aceita datas em ordem e pauta de 2 opções', () => {
    expect(() => validateNewAssembly(ok)).not.toThrow()
  })
  it.each([
    ['corte depois da abertura', { snapshotAt: new Date('2026-10-11T00:00:00Z') }],
    ['fecha antes de abrir', { closesAt: new Date('2026-10-09T00:00:00Z') }],
    ['efeito antes do fechamento', { effectAppliesAt: new Date('2026-10-16T00:00:00Z') }],
    ['uma opção só', { options: [ok.options[0]] }],
    ['chaves repetidas', { options: [ok.options[0], ok.options[0]] }],
  ])('rejeita: %s', (_name, patch) => {
    expect(() => validateNewAssembly({ ...ok, ...patch })).toThrow(InvalidAssemblyError)
  })
})

describe('mês de calendário (fuso de Brasília)', () => {
  it.each([
    ['2026-10-15T12:00:00Z', '2026-10'],
    ['2026-11-01T02:59:59Z', '2026-10'], // 23:59:59 de 31/10 em Brasília
    ['2026-11-01T03:00:00Z', '2026-11'],
    ['2027-01-01T02:00:00Z', '2026-12'],
  ])('%s -> %s', (at, key) => {
    expect(brtMonthKey(new Date(at))).toBe(key)
  })
})
