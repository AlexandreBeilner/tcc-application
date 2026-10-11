import { describe, expect, it, vi } from 'vitest'
import type { HoldingsSnapshot } from '../../domain/assembly'
import { DEFAULT_LIFECYCLE_PARAMS, type AgendaTemplate } from '../../domain/lifecycle'
import { DEFAULT_PROPOSAL_PARAMS } from '../../domain/proposals'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { createFakeProposalRepository } from '../../test/fakes/fakeProposalRepository'
import { createFakeAssemblyPauseRepository } from '../../test/fakes/fakeAssemblyPauseRepository'
import { AssemblyKindRegistry } from '../assemblyKinds'
import type { CompanyReportFact } from '../ports/companyReportSource'
import { AnnounceClosedAssembliesUseCase } from './announceClosedAssemblies'
import { ApplyDueAssemblyEffectsUseCase } from './applyDueAssemblyEffects'
import { CloseDueAssembliesUseCase } from './closeDueAssemblies'
import { CreateAssemblyUseCase } from './createAssembly'
import { OpenDueAssembliesUseCase } from './openDueAssemblies'
import { RunAssemblyLifecycleUseCase } from './runAssemblyLifecycle'
import { TallyAssemblyUseCase } from './tallyAssembly'

const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-10T12:00:00Z')

const template: AgendaTemplate = {
  key: 'capital_budget',
  kind: SHAREHOLDER_KIND,
  sector: null,
  title: 'Orçamento de capital',
  description: 'd',
  options: [
    {
      key: 'expandir',
      label: 'Expandir',
      gain: 'g',
      loss: 'l',
      effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.8 },
    },
    {
      key: 'eficiencia',
      label: 'Eficiência',
      gain: 'g',
      loss: 'l',
      effect: { metric: 'quality_multiplier', direction: 1, intensity: 0.8 },
    },
  ],
}

const report: CompanyReportFact = {
  companyId: 'company-1',
  name: 'Acme',
  sector: 'Tecnologia',
  tickers: ['ACME3'],
  reportDay: 91,
  daysSinceReport: 2,
}

function setup(options: { minVoters?: number; templates?: AgendaTemplate[] } = {}) {
  let clock = t0
  const now = () => clock
  const effect = { apply: vi.fn(async () => undefined) }
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect,
  })
  const repository = createFakeAssemblyRepository()
  const proposals = createFakeProposalRepository()
  const pauses = createFakeAssemblyPauseRepository()
  let holdings: HoldingsSnapshot = { takenAt: t0, holdings: [] }
  const snapshots = {
    take: vi.fn(async () => holdings),
    get: vi.fn(async () => holdings),
  }
  let reports: CompanyReportFact[] = [report]
  const reportSource = { listRecentReports: vi.fn(async () => reports) }
  const catalog = { listActive: vi.fn(async () => options.templates ?? [template]) }
  const create = new CreateAssemblyUseCase(kinds, repository, now)
  let currentMinVoters = options.minVoters ?? 3
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => ({
    minVoters: currentMinVoters,
  }))
  const cooldownLeft = new Map<string, number>()
  const cooldowns = {
    daysLeft: vi.fn(async (companyId: string) => cooldownLeft.get(companyId) ?? 0),
  }
  const open = new OpenDueAssembliesUseCase(
    create,
    repository,
    reportSource,
    catalog,
    snapshots,
    proposals,
    () => DEFAULT_PROPOSAL_PARAMS,
    () => DEFAULT_LIFECYCLE_PARAMS,
    pauses,
    cooldowns,
    () => currentMinVoters,
    now,
  )
  const close = new CloseDueAssembliesUseCase(repository, tally, now)
  const apply = new ApplyDueAssemblyEffectsUseCase(kinds, repository, pauses, now)
  const feed = { publishParticipation: vi.fn(async () => undefined) }
  const mailer = { sendResult: vi.fn(async () => undefined) }
  const announce = new AnnounceClosedAssembliesUseCase(
    kinds,
    repository,
    snapshots,
    feed,
    mailer,
    now,
  )
  return {
    feed,
    mailer,
    announce,
    repository,
    proposals,
    pauses,
    cooldownLeft,
    cooldowns,
    effect,
    snapshots,
    reportSource,
    open,
    close,
    apply,
    run: new RunAssemblyLifecycleUseCase(close, open, apply, announce),
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    setMinVoters: (n: number) => (currentMinVoters = n),
    setHoldings: (h: HoldingsSnapshot) => (holdings = h),
    setReports: (r: CompanyReportFact[]) => (reports = r),
    first: () => [...repository.items.values()][0],
  }
}

async function vote(
  ctx: ReturnType<typeof setup>,
  users: Array<[string, number]>,
  optionIndex = 0,
) {
  const { assembly, options } = ctx.first()
  for (const [userId] of users) {
    await ctx.repository.upsertVote(
      { assemblyId: assembly.id, userId, optionId: options[optionIndex].id },
      ctx.first().assembly.opensAt,
    )
  }
}

describe('OpenDueAssembliesUseCase', () => {
  it('abre a assembleia da empresa com o contexto da pauta e pede o snapshot', async () => {
    const ctx = setup()
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })
    const { assembly, options } = ctx.first()
    expect(assembly).toMatchObject({
      kind: SHAREHOLDER_KIND,
      subjectRef: 'company-1',
      subjectLabel: 'Acme',
      title: 'Orçamento de capital',
      templateKey: 'capital_budget',
      status: 'open',
      dedupeKey: 'shareholder:company-1:91',
    })
    expect(assembly.closesAt.getTime() - assembly.opensAt.getTime()).toBe(7 * DAY)
    expect(options.map((o) => o.key)).toEqual(['expandir', 'eficiencia'])
    expect(ctx.snapshots.take).toHaveBeenCalledTimes(1)
  })

  it('pede ao motor os balanços de 2 a 9 dias atrás (atraso e janela de recuperação em parâmetro)', async () => {
    const ctx = setup()
    await ctx.open.execute()
    expect(ctx.reportSource.listRecentReports).toHaveBeenCalledWith(2, 9)
  })

  it('reexecutar o job não duplica a abertura nem repete o snapshot', async () => {
    const ctx = setup()
    await ctx.open.execute()
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 0 })
    expect(ctx.repository.items.size).toBe(1)
    expect(ctx.snapshots.take).toHaveBeenCalledTimes(1)
  })

  it('retoma uma assembleia que ficou agendada por falha no meio (snapshot fora do ar)', async () => {
    const ctx = setup()
    ctx.snapshots.take.mockRejectedValueOnce(new Error('motor fora do ar'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 1 })
    expect(ctx.first().assembly.status).toBe('scheduled')
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })
    expect(ctx.repository.items.size).toBe(1)
  })

  it('uma falha numa empresa não impede as outras', async () => {
    const ctx = setup()
    ctx.setReports([report, { ...report, companyId: 'company-2', name: 'Beta' }])
    ctx.snapshots.take.mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 1 })
  })

  it('empresa em período de espera não abre; sai do cooldown dentro da janela e abre (ponto 050)', async () => {
    const ctx = setup()
    ctx.cooldownLeft.set('company-1', 12)
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 0 })
    expect(ctx.repository.items.size).toBe(0)
    expect(ctx.snapshots.take).not.toHaveBeenCalled()

    ctx.cooldownLeft.set('company-1', 0)
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })
  })

  it('o cooldown de uma empresa não barra a outra, e motor fora do ar conta como falha', async () => {
    const ctx = setup()
    ctx.setReports([report, { ...report, companyId: 'company-2', name: 'Beta' }])
    ctx.cooldownLeft.set('company-1', 3)
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })

    ctx.cooldowns.daysLeft.mockRejectedValueOnce(new Error('motor fora'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ctx.setReports([{ ...report, companyId: 'company-3', name: 'Gama' }])
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 1 })
  })

  it('empresa sem pauta candidata não abre nada', async () => {
    const ctx = setup({ templates: [{ ...template, sector: 'Energia' }] })
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 0 })
    expect(ctx.repository.items.size).toBe(0)
  })
})

describe('CloseDueAssembliesUseCase', () => {
  it('não fecha antes do prazo', async () => {
    const ctx = setup()
    await ctx.open.execute()
    ctx.advance(7 * DAY - 1)
    expect(await ctx.close.execute()).toEqual({ closed: 0, approved: 0, failed: 0 })
    expect(ctx.first().assembly.status).toBe('open')
  })

  it('sem o mínimo de votantes fecha como não aprovada (quorum)', async () => {
    const ctx = setup()
    await ctx.open.execute()
    ctx.setHoldings({
      takenAt: t0,
      holdings: [
        { userId: 'u1', quantity: 10 },
        { userId: 'u2', quantity: 10 },
      ],
    })
    await vote(ctx, [
      ['u1', 10],
      ['u2', 10],
    ])
    ctx.advance(7 * DAY)
    expect(await ctx.close.execute()).toEqual({ closed: 1, approved: 0, failed: 0 })
    expect(ctx.first().assembly).toMatchObject({
      status: 'closed',
      outcome: 'not_approved',
      outcomeReason: 'quorum',
      voterCount: 2,
      winningOptionId: null,
    })
  })

  it('com o mínimo de votantes aprova a opção de maior peso e a reexecução não fecha de novo', async () => {
    const ctx = setup()
    await ctx.open.execute()
    ctx.setHoldings({
      takenAt: t0,
      holdings: ['u1', 'u2', 'u3'].map((userId) => ({ userId, quantity: 10 })),
    })
    await vote(
      ctx,
      [
        ['u1', 10],
        ['u2', 10],
        ['u3', 10],
      ],
      1,
    )
    ctx.advance(7 * DAY)
    expect(await ctx.close.execute()).toEqual({ closed: 1, approved: 1, failed: 0 })
    const { assembly, options } = ctx.first()
    expect(assembly).toMatchObject({
      outcome: 'approved',
      outcomeReason: 'decided',
      winningOptionId: options[1].id,
      voterCount: 3,
    })
    expect(await ctx.close.execute()).toEqual({ closed: 0, approved: 0, failed: 0 })
  })

  it('motor fora do ar na apuração deixa a assembleia aberta para a próxima rodada', async () => {
    const ctx = setup()
    await ctx.open.execute()
    ctx.advance(7 * DAY)
    ctx.snapshots.get.mockRejectedValueOnce(new Error('motor fora do ar'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await ctx.close.execute()).toEqual({ closed: 0, approved: 0, failed: 1 })
    expect(ctx.first().assembly.status).toBe('open')
    expect((await ctx.close.execute()).closed).toBe(1)
  })
})

describe('ApplyDueAssemblyEffectsUseCase', () => {
  async function closedApproved(ctx: ReturnType<typeof setup>) {
    await ctx.open.execute()
    ctx.setHoldings({
      takenAt: t0,
      holdings: ['u1', 'u2', 'u3'].map((userId) => ({ userId, quantity: 10 })),
    })
    await vote(ctx, [
      ['u1', 10],
      ['u2', 10],
      ['u3', 10],
    ])
    ctx.advance(7 * DAY)
    await ctx.close.execute()
  }

  it('só envia ao motor 1 dia depois do fechamento, uma única vez', async () => {
    const ctx = setup()
    await closedApproved(ctx)
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 0 })
    ctx.advance(1 * DAY)
    expect(await ctx.apply.execute()).toEqual({ applied: 1, failed: 0 })
    expect(ctx.effect.apply).toHaveBeenCalledTimes(1)
    expect(ctx.effect.apply.mock.calls[0]).toMatchObject([
      { id: ctx.first().assembly.id },
      { key: 'expandir' },
    ])
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 0 })
    expect(ctx.effect.apply).toHaveBeenCalledTimes(1)
  })

  it('assembleia não aprovada nunca chega ao motor', async () => {
    const ctx = setup()
    await ctx.open.execute()
    ctx.advance(8 * DAY)
    await ctx.close.execute()
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 0 })
    expect(ctx.effect.apply).not.toHaveBeenCalled()
  })

  it('falha do motor deixa o efeito pendente e a rodada seguinte repete', async () => {
    const ctx = setup()
    await closedApproved(ctx)
    ctx.advance(1 * DAY)
    ctx.effect.apply.mockRejectedValueOnce(new Error('motor fora do ar'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 1 })
    expect(ctx.first().assembly.effectAppliedAt).toBeNull()
    expect(await ctx.apply.execute()).toEqual({ applied: 1, failed: 0 })
  })
})

describe('RunAssemblyLifecycleUseCase', () => {
  it('percorre o ciclo inteiro com relógio falso: abre, fecha e aplica sem duplicar', async () => {
    const ctx = setup()
    expect((await ctx.run.execute()).open.opened).toBe(1)
    ctx.setHoldings({
      takenAt: t0,
      holdings: ['u1', 'u2', 'u3'].map((userId) => ({ userId, quantity: 5 })),
    })
    await vote(ctx, [
      ['u1', 5],
      ['u2', 5],
      ['u3', 5],
    ])
    ctx.advance(7 * DAY)
    const closing = await ctx.run.execute()
    expect(closing.close).toEqual({ closed: 1, approved: 1, failed: 0 })
    ctx.advance(1 * DAY)
    expect((await ctx.run.execute()).apply.applied).toBe(1)
    const again = await ctx.run.execute()
    expect(again.close.closed + again.apply.applied).toBe(0)
    expect(ctx.effect.apply).toHaveBeenCalledTimes(1)
  })

  it('uma etapa que quebra não impede as outras', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ok = { execute: vi.fn(async () => ({ opened: 1, failed: 0 })) }
    const run = new RunAssemblyLifecycleUseCase(
      { execute: vi.fn().mockRejectedValue(new Error('x')) },
      ok,
      { execute: vi.fn(async () => ({ applied: 0, failed: 0 })) },
      { execute: vi.fn(async () => ({ announced: 0, failed: 0 })) },
    )
    const result = await run.execute()
    expect(result.close.failed).toBe(1)
    expect(result.open.opened).toBe(1)
  })
})

describe('OpenDueAssembliesUseCase: pauta vinda das propostas (MO.6.5)', () => {
  const other: AgendaTemplate = {
    ...template,
    key: 'debt_policy',
    title: 'Política de endividamento',
  }
  const third: AgendaTemplate = { ...template, key: 'dividends', title: 'Destinação do lucro' }

  async function propose(
    ctx: ReturnType<typeof setup>,
    templateKey: string,
    supporters: string[],
    ageDays = 1,
  ) {
    const { proposal } = await ctx.proposals
      .propose({
        kind: SHAREHOLDER_KIND,
        subjectRef: 'company-1',
        templateKey,
        userId: supporters[0],
        now: new Date(t0.getTime() - ageDays * DAY),
        expiresAt: new Date(t0.getTime() + 20 * DAY),
        monthFrom: new Date(0),
        monthTo: new Date(t0.getTime() + 365 * DAY),
        monthlyCap: 10,
      })
      .then((r) => ({ proposal: (r as { proposal: { id: string } }).proposal }))
    for (const u of supporters.slice(1)) await ctx.proposals.addSupport(proposal.id, u, t0)
    return proposal.id
  }

  it('a proposta mais apoiada vira a pauta e é consumida; as outras seguem na fila', async () => {
    const ctx = setup({ templates: [template, other, third] })
    const loser = await propose(ctx, 'debt_policy', ['a', 'b'])
    const winner = await propose(ctx, 'dividends', ['c', 'd', 'e'])
    await ctx.open.execute()
    expect(ctx.first().assembly.templateKey).toBe('dividends')
    expect(ctx.proposals.consumed).toEqual([
      { proposalId: winner, assemblyId: ctx.first().assembly.id },
    ])
    expect(ctx.proposals.proposals.find((p) => p.id === loser)?.status).toBe('active')
  })

  it('empate de apoio vai para a proposta mais antiga', async () => {
    const ctx = setup({ templates: [template, other, third] })
    await propose(ctx, 'dividends', ['a', 'b'], 1)
    await propose(ctx, 'debt_policy', ['c', 'd'], 5)
    await ctx.open.execute()
    expect(ctx.first().assembly.templateKey).toBe('debt_policy')
  })

  it('proposta sem o mínimo de apoios não vence: vale o sorteio do catálogo', async () => {
    const ctx = setup({ templates: [template] })
    await propose(ctx, 'capital_budget', ['a'])
    await ctx.open.execute()
    // Sem fila elegível a pauta é a do sorteio (a única do catálogo), e consumi-la é inofensivo.
    expect(ctx.first().assembly.templateKey).toBe('capital_budget')
  })

  it('só uma proposta com apoio suficiente muda a pauta em relação ao sorteio', async () => {
    const ctx = setup({ templates: [template, other] })
    await propose(ctx, 'debt_policy', ['a'])
    await ctx.open.execute()
    const sorteada = ctx.first().assembly.templateKey
    const ctx2 = setup({ templates: [template, other] })
    await propose(ctx2, 'debt_policy', ['a', 'b'])
    await ctx2.open.execute()
    expect(ctx2.first().assembly.templateKey).toBe('debt_policy')
    expect([template.key, other.key]).toContain(sorteada)
  })

  it('proposta cuja pauta saiu do catálogo é ignorada', async () => {
    const ctx = setup({ templates: [template] })
    await propose(ctx, 'sumiu', ['a', 'b', 'c'])
    await ctx.open.execute()
    expect(ctx.first().assembly.templateKey).toBe('capital_budget')
  })

  it('proposta vencida não conta e é marcada como expirada', async () => {
    const ctx = setup({ templates: [template, other] })
    const id = await propose(ctx, 'debt_policy', ['a', 'b', 'c'])
    ctx.proposals.proposals.find((p) => p.id === id)!.expiresAt = new Date(t0.getTime() - 1)
    await ctx.open.execute()
    expect(ctx.proposals.proposals.find((p) => p.id === id)?.status).toBe('expired')
    expect(ctx.proposals.consumed).toHaveLength(0)
  })

  it('reexecutar não consome de novo nem troca a pauta', async () => {
    const ctx = setup({ templates: [template, other] })
    await propose(ctx, 'debt_policy', ['a', 'b'])
    await ctx.open.execute()
    await ctx.open.execute()
    expect(ctx.repository.items.size).toBe(1)
    expect(ctx.proposals.consumed).toHaveLength(1)
  })
})

describe('AnnounceClosedAssembliesUseCase (MO.6.7)', () => {
  async function closedAssembly(voters: string[], minVoters = 3) {
    const ctx = setup({ minVoters })
    ctx.setHoldings({
      takenAt: t0,
      holdings: [
        { userId: 'ana', quantity: 30 },
        { userId: 'bia', quantity: 10 },
        { userId: 'caio', quantity: 5 },
        { userId: 'dani', quantity: 1 },
      ],
    })
    await ctx.open.execute()
    ctx.advance(DAY)
    await ctx.repository.markOpen(ctx.first().assembly.id)
    await vote(
      ctx,
      voters.map((id) => [id, 1] as [string, number]),
    )
    ctx.advance(8 * DAY)
    await ctx.close.execute()
    return ctx
  }

  it('feed só de quem votou e e-mail para todo acionista da data de corte', async () => {
    const ctx = await closedAssembly(['ana', 'bia', 'caio'])
    expect(await ctx.announce.execute()).toEqual({ announced: 1, failed: 0 })
    const fed = ctx.feed.publishParticipation.mock.calls.map((c) => c[0]).sort()
    expect(fed).toEqual(['ana', 'bia', 'caio'])
    const mailed = ctx.mailer.sendResult.mock.calls.map((c) => c[0]).sort()
    expect(mailed).toEqual(['ana', 'bia', 'caio', 'dani'])
    expect(ctx.first().assembly.resultAnnouncedAt).not.toBeNull()
  })

  it('o resumo leva só o desfecho e a pauta, nunca o voto por pessoa', async () => {
    const ctx = await closedAssembly(['ana', 'bia', 'caio'])
    await ctx.announce.execute()
    const [, summary] = ctx.feed.publishParticipation.mock.calls[0]
    expect(summary).toMatchObject({
      subjectLabel: 'Acme',
      title: 'Orçamento de capital',
      outcome: 'approved',
      reason: 'decided',
      winningLabel: 'Expandir',
    })
    expect(JSON.stringify(summary)).not.toMatch(/optionId|weight|quantity/)
  })

  it('sem o mínimo de votantes publica do mesmo jeito, sem opção vencedora', async () => {
    const ctx = await closedAssembly(['ana'])
    await ctx.announce.execute()
    const [, summary] = ctx.mailer.sendResult.mock.calls[0]
    expect(summary).toMatchObject({ outcome: 'not_approved', reason: 'quorum', winningLabel: null })
    expect(ctx.feed.publishParticipation).toHaveBeenCalledTimes(1)
    expect(ctx.mailer.sendResult).toHaveBeenCalledTimes(4)
  })

  it('assembleia ainda aberta não é publicada, e já publicada não repete', async () => {
    const ctx = setup()
    ctx.setHoldings({ takenAt: t0, holdings: [{ userId: 'ana', quantity: 3 }] })
    await ctx.open.execute()
    expect(await ctx.announce.execute()).toEqual({ announced: 0, failed: 0 })

    const closed = await closedAssembly(['ana', 'bia', 'caio'])
    await closed.announce.execute()
    expect(await closed.announce.execute()).toEqual({ announced: 0, failed: 0 })
    expect(closed.mailer.sendResult).toHaveBeenCalledTimes(4)
  })

  it('falha de um envio não marca a assembleia: a rodada seguinte repete (idempotente)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ctx = await closedAssembly(['ana', 'bia', 'caio'])
    ctx.mailer.sendResult.mockRejectedValueOnce(new Error('fora do ar'))
    expect(await ctx.announce.execute()).toEqual({ announced: 0, failed: 1 })
    expect(ctx.first().assembly.resultAnnouncedAt).toBeNull()
    // Os demais destinatários da rodada que falhou foram atendidos.
    expect(ctx.mailer.sendResult).toHaveBeenCalledTimes(4)

    expect(await ctx.announce.execute()).toEqual({ announced: 1, failed: 0 })
    expect(ctx.first().assembly.resultAnnouncedAt).not.toBeNull()
  })

  it('a rodada do ciclo publica o resultado depois de fechar', async () => {
    const ctx = await closedAssembly(['ana', 'bia', 'caio'])
    const result = await ctx.run.execute()
    expect(result.announce.announced).toBe(1)
  })
})

describe('pausa do painel no ciclo (MO.6.8)', () => {
  async function closedApproved(ctx: ReturnType<typeof setup>) {
    await ctx.open.execute()
    ctx.setHoldings({
      takenAt: t0,
      holdings: ['u1', 'u2', 'u3'].map((userId) => ({ userId, quantity: 10 })),
    })
    await vote(ctx, [
      ['u1', 10],
      ['u2', 10],
      ['u3', 10],
    ])
    ctx.advance(7 * DAY)
    await ctx.close.execute()
  }

  const pauseBy = (
    ctx: ReturnType<typeof setup>,
    scope: 'global' | 'subject',
    subjectRef?: string,
  ) =>
    ctx.pauses.create(
      {
        scope,
        kind: scope === 'subject' ? SHAREHOLDER_KIND : null,
        subjectRef: subjectRef ?? null,
        reason: 'revisão',
      },
      'admin-1',
      t0,
    )

  it('pausa global impede abrir, sem nem consultar o motor, e retomar abre dentro da janela', async () => {
    const ctx = setup()
    const created = await pauseBy(ctx, 'global')
    expect(await ctx.open.execute()).toEqual({ opened: 0, failed: 0 })
    expect(ctx.reportSource.listRecentReports).not.toHaveBeenCalled()
    expect(ctx.repository.items.size).toBe(0)

    if (created.status !== 'created') throw new Error('pausa não criada')
    await ctx.pauses.lift(created.pause.id, 'admin-1', t0)
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })
  })

  it('pausa de uma empresa só barra a dela', async () => {
    const ctx = setup()
    ctx.setReports([report, { ...report, companyId: 'company-2', name: 'Beta', reportDay: 92 }])
    await pauseBy(ctx, 'subject', 'company-1')
    expect(await ctx.open.execute()).toEqual({ opened: 1, failed: 0 })
    expect(ctx.first().assembly.subjectRef).toBe('company-2')
  })

  it('pausa impede aplicar o efeito, que fica pendente e é entregue depois de retomar', async () => {
    const ctx = setup()
    await closedApproved(ctx)
    ctx.advance(1 * DAY)
    const created = await pauseBy(ctx, 'subject', 'company-1')
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 0 })
    expect(ctx.effect.apply).not.toHaveBeenCalled()
    expect(ctx.first().assembly.effectAppliedAt).toBeNull()

    if (created.status !== 'created') throw new Error('pausa não criada')
    await ctx.pauses.lift(created.pause.id, 'admin-1', t0)
    expect(await ctx.apply.execute()).toEqual({ applied: 1, failed: 0 })
  })

  it('pausa global também segura o efeito de qualquer empresa', async () => {
    const ctx = setup()
    await closedApproved(ctx)
    ctx.advance(1 * DAY)
    await pauseBy(ctx, 'global')
    expect(await ctx.apply.execute()).toEqual({ applied: 0, failed: 0 })
    expect(ctx.effect.apply).not.toHaveBeenCalled()
  })

  it('a pausa não impede fechar e apurar: o prazo de voto é uma promessa a quem vota', async () => {
    const ctx = setup()
    await ctx.open.execute()
    await pauseBy(ctx, 'global')
    ctx.advance(8 * DAY)
    expect((await ctx.run.execute()).close.closed).toBe(1)
  })
})

describe('quórum congelado na abertura (MO.6.8)', () => {
  it('mudar o parâmetro depois de abrir não muda o quórum da assembleia aberta', async () => {
    const ctx = setup({ minVoters: 3 })
    await ctx.open.execute()
    expect(ctx.first().assembly.minVoters).toBe(3)

    // O painel baixa o quórum para 1, mas esta assembleia abriu com 3: um voto só não decide.
    ctx.setMinVoters(1)
    ctx.setHoldings({ takenAt: t0, holdings: [{ userId: 'u1', quantity: 10 }] })
    await vote(ctx, [['u1', 10]])
    ctx.advance(8 * DAY)
    await ctx.close.execute()
    expect(ctx.first().assembly).toMatchObject({ outcome: 'not_approved', outcomeReason: 'quorum' })
  })

  it('a assembleia aberta depois da mudança nasce com o quórum novo', async () => {
    const ctx = setup({ minVoters: 3 })
    ctx.setMinVoters(5)
    await ctx.open.execute()
    expect(ctx.first().assembly.minVoters).toBe(5)
  })
})
