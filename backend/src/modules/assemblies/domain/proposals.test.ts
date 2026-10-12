import { describe, expect, it } from 'vitest'
import type { AgendaTemplate } from './lifecycle'
import {
  DEFAULT_PROPOSAL_PARAMS,
  pickProposedTemplate,
  proposalDenialMessage,
  proposalExpiry,
  proposalMonthRange,
  rankProposals,
  resolveProposalAccess,
  type AgendaProposal,
} from './proposals'

const NOW = new Date('2026-10-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function proposal(over: Partial<AgendaProposal> & { id: string }): AgendaProposal {
  return {
    kind: 'shareholder',
    subjectRef: 'c1',
    templateKey: 'k',
    proposedBy: 'u',
    status: 'active',
    createdAt: new Date(NOW.getTime() - DAY),
    expiresAt: new Date(NOW.getTime() + DAY),
    supportCount: 2,
    supportedByMe: false,
    ...over,
  }
}

function template(key: string, sector: string | null, kind = 'shareholder'): AgendaTemplate {
  return { key, kind, sector, title: key, description: 'd', options: [] }
}

describe('rankProposals', () => {
  const params = { minSupport: 2 }

  it('ordena por apoio e desempata pela proposta mais antiga', () => {
    const ranked = rankProposals(
      [
        proposal({ id: 'a', supportCount: 2, createdAt: new Date(NOW.getTime() - 1 * DAY) }),
        proposal({ id: 'b', supportCount: 5 }),
        proposal({ id: 'c', supportCount: 2, createdAt: new Date(NOW.getTime() - 3 * DAY) }),
      ],
      NOW,
      params,
    )
    expect(ranked.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('empate de apoio e de data cai no id, nunca na ordem de entrada', () => {
    const same = new Date(NOW.getTime() - DAY)
    const ids = (order: string[]) =>
      rankProposals(
        order.map((id) => proposal({ id, createdAt: same })),
        NOW,
        params,
      ).map((p) => p.id)
    expect(ids(['z', 'a', 'm'])).toEqual(['a', 'm', 'z'])
    expect(ids(['m', 'z', 'a'])).toEqual(['a', 'm', 'z'])
  })

  it('descarta abaixo do mínimo de apoios, expiradas e não ativas', () => {
    const ranked = rankProposals(
      [
        proposal({ id: 'pouco', supportCount: 1 }),
        proposal({ id: 'vencida', expiresAt: new Date(NOW.getTime() - 1) }),
        proposal({ id: 'usada', status: 'consumed' }),
        proposal({ id: 'ok', supportCount: 2 }),
      ],
      NOW,
      params,
    )
    expect(ranked.map((p) => p.id)).toEqual(['ok'])
  })

  it('o mínimo é parâmetro', () => {
    const list = [proposal({ id: 'a', supportCount: 3 })]
    expect(rankProposals(list, NOW, { minSupport: 4 })).toHaveLength(0)
    expect(rankProposals(list, NOW, { minSupport: 3 })).toHaveLength(1)
  })
})

describe('pickProposedTemplate', () => {
  it('pega a primeira da fila cuja pauta ainda vale para o setor', () => {
    const ranked = [
      proposal({ id: '1', templateKey: 'energia' }),
      proposal({ id: '2', templateKey: 'geral' }),
    ]
    const templates = [template('energia', 'Energia'), template('geral', null)]
    expect(pickProposedTemplate(ranked, templates, 'shareholder', 'Varejo')?.proposal.id).toBe('2')
    expect(pickProposedTemplate(ranked, templates, 'shareholder', 'Energia')?.proposal.id).toBe('1')
  })

  it('pauta que saiu do catálogo ou é de outro kind não serve; sem nenhuma devolve null', () => {
    const ranked = [
      proposal({ id: '1', templateKey: 'sumiu' }),
      proposal({ id: '2', templateKey: 'outro' }),
    ]
    expect(
      pickProposedTemplate(ranked, [template('outro', null, 'duel')], 'shareholder', 'Varejo'),
    ).toBeNull()
  })
})

describe('regras de acesso e datas', () => {
  it('só acionista de hoje e fora do período de espera pode propor ou apoiar', () => {
    expect(resolveProposalAccess({ holdsShares: false, cooldownDaysLeft: 0 })).toBe(
      'not_shareholder',
    )
    expect(resolveProposalAccess({ holdsShares: true, cooldownDaysLeft: 4 })).toBe(
      'company_in_cooldown',
    )
    expect(resolveProposalAccess({ holdsShares: true, cooldownDaysLeft: 0 })).toBeNull()
  })

  it('o mês do teto é o de Brasília (UTC-3), com limites exatos', () => {
    // 01/10 01:00 em Brasília ainda é setembro? Não: 01/10 04:00Z = 01/10 01:00 BRT = outubro.
    expect(proposalMonthRange(new Date('2026-10-01T04:00:00Z')).monthKey).toBe('2026-10')
    expect(proposalMonthRange(new Date('2026-10-01T02:59:00Z')).monthKey).toBe('2026-09')
    const r = proposalMonthRange(new Date('2026-10-15T12:00:00Z'))
    expect(r.from.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(proposalMonthRange(new Date('2026-12-20T12:00:00Z')).to.toISOString()).toBe(
      '2027-01-01T03:00:00.000Z',
    )
  })

  it('o prazo vem do parâmetro e as mensagens não culpam nem usam travessão', () => {
    expect(proposalExpiry(NOW, { ttlDays: 30 }).getTime() - NOW.getTime()).toBe(30 * DAY)
    for (const reason of [
      'not_shareholder',
      'company_in_cooldown',
      'monthly_cap_reached',
      'proposal_not_active',
      'template_unavailable',
    ] as const) {
      expect(proposalDenialMessage(reason, DEFAULT_PROPOSAL_PARAMS, 3)).not.toMatch(/—/)
    }
    expect(proposalDenialMessage('company_in_cooldown', DEFAULT_PROPOSAL_PARAMS, 1)).toContain(
      '1 dia ',
    )
    expect(
      proposalDenialMessage('monthly_cap_reached', { ...DEFAULT_PROPOSAL_PARAMS, monthlyCap: 5 }),
    ).toContain('5 propostas')
  })
})
