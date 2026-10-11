import { describe, expect, it, vi } from 'vitest'
import type { HoldingsSnapshot } from '../../domain/assembly'
import { DEFAULT_LIFECYCLE_PARAMS, type AgendaTemplate } from '../../domain/lifecycle'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { AssemblyKindRegistry } from '../assemblyKinds'
import type { CompanyReportFact } from '../ports/companyReportSource'
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
  let holdings: HoldingsSnapshot = { takenAt: t0, holdings: [] }
  const snapshots = {
    take: vi.fn(async () => holdings),
    get: vi.fn(async () => holdings),
  }
  let reports: CompanyReportFact[] = [report]
  const reportSource = { listRecentReports: vi.fn(async () => reports) }
  const catalog = { listActive: vi.fn(async () => options.templates ?? [template]) }
  const create = new CreateAssemblyUseCase(kinds, repository, now)
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => ({
    minVoters: options.minVoters ?? 3,
  }))
  const open = new OpenDueAssembliesUseCase(
    create,
    repository,
    reportSource,
    catalog,
    snapshots,
    () => DEFAULT_LIFECYCLE_PARAMS,
    now,
  )
  const close = new CloseDueAssembliesUseCase(repository, tally, now)
  const apply = new ApplyDueAssemblyEffectsUseCase(kinds, repository, now)
  return {
    repository,
    effect,
    snapshots,
    reportSource,
    open,
    close,
    apply,
    run: new RunAssemblyLifecycleUseCase(close, open, apply),
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
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
    )
    const result = await run.execute()
    expect(result.close.failed).toBe(1)
    expect(result.open.opened).toBe(1)
  })
})
