import { describe, expect, it } from 'vitest'
import {
  ProposalDeniedError,
  ProposalNotFoundError,
  CompanyNotFoundError,
} from '../../domain/errors'
import type { AgendaTemplate } from '../../domain/lifecycle'
import { DEFAULT_PROPOSAL_PARAMS, type ProposalParams } from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import { createFakeProposalRepository } from '../../test/fakes/fakeProposalRepository'
import type { CompanyStanding } from '../ports/companyStandingReader'
import { ListCompanyProposalsUseCase } from './listCompanyProposals'
import { ProposeAgendaUseCase } from './proposeAgenda'
import { SupportProposalUseCase } from './supportProposal'
import { WithdrawProposalSupportUseCase } from './withdrawProposalSupport'

const NOW = new Date('2026-10-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const COMPANY = 'company-1'

function tpl(key: string, sector: string | null): AgendaTemplate {
  return {
    key,
    kind: SHAREHOLDER_KIND,
    sector,
    title: `Pauta ${key}`,
    description: 'd',
    options: [
      { key: 'a', label: 'A', gain: 'ganho', loss: 'perda', effect: {} },
      { key: 'b', label: 'B', gain: 'ganho', loss: 'perda', effect: {} },
    ],
  }
}

function setup(over: { params?: Partial<ProposalParams> } = {}) {
  let clock = NOW
  const now = () => clock
  const params = { ...DEFAULT_PROPOSAL_PARAMS, ...over.params }
  const repository = createFakeProposalRepository()
  const pros = new Set(['ana', 'bia', 'caio', 'dani'])
  const standings = new Map<string, Partial<CompanyStanding>>()
  const holders = new Set(['ana', 'bia', 'caio', 'dani', 'edu'])
  let cooldownDaysLeft = 0
  const gate = {
    assertPro: async (userId: string) => {
      if (!pros.has(userId))
        throw Object.assign(new Error('requer plano PRO'), { code: 'PRO_REQUIRED' })
    },
  }
  const reader = {
    get: async (companyId: string, userId: string) =>
      companyId === 'desconhecida'
        ? null
        : {
            companyId,
            name: 'Acme',
            sector: 'Varejo',
            holdsShares: holders.has(userId),
            cooldownDaysLeft,
            ...standings.get(userId),
          },
  }
  const templates = [
    tpl('geral', null),
    tpl('geral_b', null),
    tpl('varejo', 'Varejo'),
    tpl('energia', 'Energia'),
  ]
  const catalog = { listActive: async () => templates }
  const getParams = () => params
  return {
    repository,
    holders,
    pros,
    propose: new ProposeAgendaUseCase(gate, reader, catalog, repository, getParams, now),
    support: new SupportProposalUseCase(gate, reader, repository, getParams, now),
    withdraw: new WithdrawProposalSupportUseCase(repository),
    list: new ListCompanyProposalsUseCase(
      reader,
      catalog,
      repository,
      { isPro: async (id) => pros.has(id) },
      getParams,
      now,
    ),
    setCooldown: (days: number) => (cooldownDaysLeft = days),
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  }
}

const propose = (ctx: ReturnType<typeof setup>, userId: string, templateKey = 'geral') =>
  ctx.propose.execute({ companyId: COMPANY, templateKey, userId })

async function denied(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ProposalDeniedError)
  return (err as ProposalDeniedError).reason
}

describe('ProposeAgendaUseCase', () => {
  it('PRO acionista propõe pauta do catálogo e entra como primeiro apoio', async () => {
    const ctx = setup()
    const { proposal, joinedExisting } = await propose(ctx, 'ana')
    expect(joinedExisting).toBe(false)
    expect(proposal).toMatchObject({
      templateKey: 'geral',
      supportCount: 1,
      supportedByMe: true,
      status: 'active',
    })
    expect(proposal.expiresAt.getTime() - NOW.getTime()).toBe(30 * DAY)
  })

  it('quem não é PRO recebe o erro do guard (403 requer plano PRO pelo handler)', async () => {
    const ctx = setup()
    await expect(propose(ctx, 'edu')).rejects.toMatchObject({ code: 'PRO_REQUIRED' })
    expect(ctx.repository.proposals).toHaveLength(0)
  })

  it('exige ações da empresa e que ela não esteja em período de espera', async () => {
    const ctx = setup()
    ctx.holders.delete('ana')
    expect(await denied(propose(ctx, 'ana'))).toBe('not_shareholder')
    ctx.setCooldown(12)
    const err = await propose(ctx, 'bia').catch((e: unknown) => e as ProposalDeniedError)
    expect(err).toMatchObject({ reason: 'company_in_cooldown' })
    expect((err as Error).message).toContain('12 dias')
    expect(ctx.repository.proposals).toHaveLength(0)
  })

  it('pauta fora do catálogo ou de outro setor é recusada; a geral vale em qualquer setor', async () => {
    const ctx = setup()
    expect(await denied(propose(ctx, 'ana', 'inexistente'))).toBe('template_unavailable')
    expect(await denied(propose(ctx, 'ana', 'energia'))).toBe('template_unavailable')
    await expect(propose(ctx, 'ana', 'varejo')).resolves.toBeTruthy()
  })

  it('empresa que o motor não conhece dá 404 de empresa', async () => {
    const ctx = setup()
    await expect(
      ctx.propose.execute({ companyId: 'desconhecida', templateKey: 'geral', userId: 'ana' }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError)
  })

  it('respeita o teto mensal', async () => {
    const ctx = setup({ params: { monthlyCap: 2 } })
    await propose(ctx, 'ana', 'geral')
    await propose(ctx, 'ana', 'varejo')
    expect(await denied(propose(ctx, 'ana', 'geral_b'))).toBe('monthly_cap_reached')
    expect(ctx.repository.proposals).toHaveLength(2)
  })

  it('o teto é por pessoa: outra pessoa PRO ainda pode propor', async () => {
    const ctx = setup({ params: { monthlyCap: 1 } })
    await propose(ctx, 'ana', 'geral')
    await expect(propose(ctx, 'bia', 'varejo')).resolves.toBeTruthy()
  })

  it('o teto zera na virada do mês de Brasília', async () => {
    const ctx = setup({ params: { monthlyCap: 1 } })
    await propose(ctx, 'ana', 'geral')
    expect(await denied(propose(ctx, 'ana', 'varejo'))).toBe('monthly_cap_reached')
    ctx.advance(30 * DAY)
    await expect(propose(ctx, 'ana', 'varejo')).resolves.toBeTruthy()
  })

  it('propor de novo uma pauta já na fila vira apoio e não gasta o teto', async () => {
    const ctx = setup({ params: { monthlyCap: 1 } })
    await propose(ctx, 'ana', 'geral')
    const second = await propose(ctx, 'bia', 'geral')
    expect(second.joinedExisting).toBe(true)
    expect(second.proposal).toMatchObject({ supportCount: 2, supportedByMe: true })
    expect(ctx.repository.proposals).toHaveLength(1)
    // O teto da bia (1) continua inteiro.
    await expect(propose(ctx, 'bia', 'varejo')).resolves.toMatchObject({ joinedExisting: false })
  })

  it('proposta vencida libera a pauta para uma nova', async () => {
    const ctx = setup()
    const first = await propose(ctx, 'ana', 'geral')
    ctx.advance(31 * DAY)
    const again = await propose(ctx, 'bia', 'geral')
    expect(again.joinedExisting).toBe(false)
    expect(again.proposal.id).not.toBe(first.proposal.id)
  })
})

describe('SupportProposalUseCase', () => {
  it('PRO acionista apoia; apoiar de novo não duplica', async () => {
    const ctx = setup()
    const { proposal } = await propose(ctx, 'ana')
    const first = await ctx.support.execute({ proposalId: proposal.id, userId: 'bia' })
    expect(first).toMatchObject({
      alreadySupported: false,
      proposal: { supportCount: 2, supportedByMe: true },
    })
    const again = await ctx.support.execute({ proposalId: proposal.id, userId: 'bia' })
    expect(again).toMatchObject({ alreadySupported: true, proposal: { supportCount: 2 } })
  })

  it('exige PRO, ações da empresa e empresa fora do período de espera', async () => {
    const ctx = setup()
    const { proposal } = await propose(ctx, 'ana')
    await expect(
      ctx.support.execute({ proposalId: proposal.id, userId: 'edu' }),
    ).rejects.toMatchObject({
      code: 'PRO_REQUIRED',
    })
    ctx.holders.delete('bia')
    expect(await denied(ctx.support.execute({ proposalId: proposal.id, userId: 'bia' }))).toBe(
      'not_shareholder',
    )
    ctx.setCooldown(5)
    expect(await denied(ctx.support.execute({ proposalId: proposal.id, userId: 'caio' }))).toBe(
      'company_in_cooldown',
    )
  })

  it('proposta inexistente dá 404; vencida ou já usada dá proposal_not_active', async () => {
    const ctx = setup()
    await expect(ctx.support.execute({ proposalId: 'nada', userId: 'bia' })).rejects.toBeInstanceOf(
      ProposalNotFoundError,
    )
    const { proposal } = await propose(ctx, 'ana')
    ctx.advance(31 * DAY)
    expect(await denied(ctx.support.execute({ proposalId: proposal.id, userId: 'bia' }))).toBe(
      'proposal_not_active',
    )
  })
})

describe('WithdrawProposalSupportUseCase', () => {
  it('retira o apoio sem apagar a proposta e sem devolver o teto, e não exige PRO', async () => {
    const ctx = setup({ params: { monthlyCap: 1 } })
    const { proposal } = await propose(ctx, 'ana')
    await ctx.support.execute({ proposalId: proposal.id, userId: 'bia' })
    // Quem cancelou o plano ainda desfaz o apoio.
    ctx.pros.delete('bia')
    const out = await ctx.withdraw.execute({ proposalId: proposal.id, userId: 'bia' })
    expect(out).toMatchObject({
      withdrawn: true,
      proposal: { supportCount: 1, supportedByMe: false },
    })
    expect((await ctx.withdraw.execute({ proposalId: proposal.id, userId: 'bia' })).withdrawn).toBe(
      false,
    )
    // A proponente retirando o próprio apoio não devolve o teto dela.
    await ctx.withdraw.execute({ proposalId: proposal.id, userId: 'ana' })
    expect(ctx.repository.proposals).toHaveLength(1)
    expect(await denied(propose(ctx, 'ana', 'varejo'))).toBe('monthly_cap_reached')
    await expect(
      ctx.withdraw.execute({ proposalId: 'nada', userId: 'ana' }),
    ).rejects.toBeInstanceOf(ProposalNotFoundError)
  })
})

describe('ListCompanyProposalsUseCase', () => {
  it('lista a fila ordenada, com posição só de quem tem o mínimo, e nunca revela quem apoiou', async () => {
    const ctx = setup()
    const a = await propose(ctx, 'ana', 'geral')
    await ctx.support.execute({ proposalId: a.proposal.id, userId: 'bia' })
    await ctx.support.execute({ proposalId: a.proposal.id, userId: 'caio' })
    await propose(ctx, 'dani', 'varejo')

    const view = await ctx.list.execute({ companyId: COMPANY, userId: 'bia' })
    expect(view.proposals.map((p) => [p.templateKey, p.supportCount, p.queuePosition])).toEqual([
      ['geral', 3, 1],
      ['varejo', 1, null],
    ])
    expect(view.proposals[0]).toMatchObject({
      supportedByMe: true,
      proposedByMe: false,
      title: 'Pauta geral',
    })
    expect(view.proposals[0].options).toEqual([
      { label: 'A', gain: 'ganho', loss: 'perda' },
      { label: 'B', gain: 'ganho', loss: 'perda' },
    ])
    expect(JSON.stringify(view)).not.toContain('"proposedBy"')
    expect(view).toMatchObject({
      company: { id: COMPANY, name: 'Acme', sector: 'Varejo' },
      isPro: true,
      holdsShares: true,
      blockedReason: null,
      limits: { monthlyCap: 3, usedThisMonth: 0, minSupport: 2, ttlDays: 30 },
    })
    // Só as pautas gerais e do setor da empresa; a em fila é marcada.
    expect(view.availableTemplates.map((t) => [t.key, t.hasActiveProposal])).toEqual([
      ['geral', true],
      ['geral_b', false],
      ['varejo', true],
    ])
  })

  it('mostra o uso do teto e o motivo de bloqueio sem exigir PRO para ler', async () => {
    const ctx = setup()
    await propose(ctx, 'ana')
    ctx.setCooldown(7)
    const own = await ctx.list.execute({ companyId: COMPANY, userId: 'ana' })
    expect(own.limits.usedThisMonth).toBe(1)
    expect(own.proposals[0].proposedByMe).toBe(true)
    const outsider = await ctx.list.execute({ companyId: COMPANY, userId: 'edu' })
    expect(outsider).toMatchObject({
      isPro: false,
      blockedReason: 'company_in_cooldown',
      cooldownDaysLeft: 7,
    })
    await expect(
      ctx.list.execute({ companyId: 'desconhecida', userId: 'ana' }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError)
  })

  it('não lista proposta vencida', async () => {
    const ctx = setup()
    await propose(ctx, 'ana')
    ctx.advance(31 * DAY)
    expect((await ctx.list.execute({ companyId: COMPANY, userId: 'ana' })).proposals).toHaveLength(
      0,
    )
  })
})
