import { describe, expect, it, vi } from 'vitest'
import type { Assembly } from '../../domain/assembly'
import { AssemblyNotFoundError } from '../../domain/errors'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import type { Scoreboard } from '../../domain/scoreboard'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { AssemblyKindRegistry } from '../assemblyKinds'
import { CreateAssemblyUseCase } from './createAssembly'
import { GetAssemblyUseCase } from './getAssembly'
import { holdsDividend, ListAssembliesUseCase } from './listAssemblies'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-10T12:00:00Z')

async function setup() {
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: { apply: async () => undefined },
  })
  const repository = createFakeAssemblyRepository()
  const create = new CreateAssemblyUseCase(kinds, repository, () => NOW)
  const make = async (
    subjectRef: string,
    closesInDays: number,
    status: 'scheduled' | 'open' | 'closed',
  ) => {
    const { assembly, options } = await create.execute({
      kind: SHAREHOLDER_KIND,
      subjectRef,
      dedupeKey: `${subjectRef}:${closesInDays}:${status}`,
      snapshotAt: new Date(NOW.getTime() + (closesInDays - 7) * DAY),
      opensAt: new Date(NOW.getTime() + (closesInDays - 7) * DAY),
      closesAt: new Date(NOW.getTime() + closesInDays * DAY),
      effectAppliesAt: new Date(NOW.getTime() + (closesInDays + 1) * DAY),
      title: `Pauta ${subjectRef}`,
      subjectLabel: `Empresa ${subjectRef}`,
      templateKey: 'tpl',
      options: [
        {
          key: 'a',
          label: 'A',
          gain: 'g',
          loss: 'l',
          effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.5 },
        },
        { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: { weird: true } },
      ],
    })
    if (status !== 'scheduled') await repository.markOpen(assembly.id)
    if (status === 'closed') {
      await repository.close(assembly.id, {
        outcome: 'approved',
        reason: 'decided',
        winningOptionId: options[0].id,
        voterCount: 3,
        decidedAt: NOW,
      })
    }
    return { assembly, options }
  }
  const holdings = {
    takenAt: NOW,
    holdings: [
      { userId: 'ana', quantity: 30 },
      { userId: 'bia', quantity: 10 },
    ],
  }
  const snapshots = { take: async () => holdings, get: vi.fn(async () => holdings) }
  const cacheStore = new Map<string, Scoreboard>()
  const cache = {
    get: vi.fn(async (id: string) => cacheStore.get(id) ?? null),
    set: vi.fn(async (id: string, board: Scoreboard) => void cacheStore.set(id, board)),
  }
  const catalog = {
    listActive: async () => [
      {
        key: 'tpl',
        kind: SHAREHOLDER_KIND,
        sector: null,
        title: 't',
        description: 'Contexto da pauta',
        options: [],
      },
    ],
  }
  return {
    repository,
    make,
    cache,
    snapshots,
    list: new ListAssembliesUseCase(repository),
    get: new GetAssemblyUseCase(kinds, repository, snapshots, catalog, cache, () => 3),
  }
}

describe('ListAssembliesUseCase', () => {
  it('separa abertas (fecham primeiro antes) das encerradas (mais recentes antes) e esconde as agendadas', async () => {
    const ctx = await setup()
    await ctx.make('c1', 5, 'open')
    await ctx.make('c2', 2, 'open')
    await ctx.make('c3', -3, 'closed')
    await ctx.make('c4', -1, 'closed')
    await ctx.make('c5', 7, 'scheduled')
    const res = await ctx.list.execute({ closedLimit: 20 })
    expect(res.open.map((a) => a.subjectRef)).toEqual(['c2', 'c1'])
    expect(res.closed.map((a) => a.subjectRef)).toEqual(['c4', 'c3'])
    expect(res.closed[0]).toMatchObject({ status: 'closed', outcome: 'approved', voterCount: 3 })
  })

  it('filtra por status, por empresa e respeita o teto das encerradas', async () => {
    const ctx = await setup()
    await ctx.make('c1', 5, 'open')
    await ctx.make('c2', -3, 'closed')
    await ctx.make('c2', -1, 'closed')
    expect((await ctx.list.execute({ status: 'open', closedLimit: 20 })).closed).toEqual([])
    expect((await ctx.list.execute({ status: 'closed', closedLimit: 20 })).open).toEqual([])
    expect((await ctx.list.execute({ companyId: 'c1', closedLimit: 20 })).closed).toEqual([])
    expect((await ctx.list.execute({ closedLimit: 1 })).closed).toHaveLength(1)
  })
})

describe('GetAssemblyUseCase', () => {
  it('devolve ficha, placar e nenhum resultado enquanto está aberta', async () => {
    const ctx = await setup()
    const { assembly, options } = await ctx.make('c1', 5, 'open')
    await ctx.repository.upsertVote(
      { assemblyId: assembly.id, userId: 'ana', optionId: options[0].id },
      NOW,
    )
    await ctx.repository.upsertVote(
      { assemblyId: assembly.id, userId: 'bia', optionId: options[1].id },
      NOW,
    )
    const detail = await ctx.get.execute(assembly.id)
    expect(detail.assembly).toMatchObject({
      title: 'Pauta c1',
      description: 'Contexto da pauta',
      status: 'open',
    })
    expect(detail.options[0].effect).toEqual({ metric: 'growth', direction: 1, intensity: 0.5 })
    expect(detail.options[0].effects).toEqual([{ metric: 'growth', direction: 1, intensity: 0.5 }])
    expect(detail.options[1].effect).toBeNull()
    expect(detail.options[1].effects).toEqual([])
    expect(detail.scoreboard).toEqual({
      voters: 2,
      options: [
        { optionId: options[0].id, voters: 1, weightPercent: 75 },
        { optionId: options[1].id, voters: 1, weightPercent: 25 },
      ],
    })
    expect(detail.result).toBeNull()
    expect(detail.minVoters).toBe(3)
    expect(JSON.stringify(detail)).not.toMatch(/ana|bia/)
  })

  it('placar de aberta usa o cache; o de encerrada não', async () => {
    const ctx = await setup()
    const open = await ctx.make('c1', 5, 'open')
    await ctx.get.execute(open.assembly.id)
    await ctx.get.execute(open.assembly.id)
    expect(ctx.snapshots.get).toHaveBeenCalledTimes(1)
    expect(ctx.cache.set).toHaveBeenCalledTimes(1)
    const closed = await ctx.make('c2', -2, 'closed')
    await ctx.get.execute(closed.assembly.id)
    await ctx.get.execute(closed.assembly.id)
    expect(ctx.snapshots.get).toHaveBeenCalledTimes(3)
    expect(ctx.cache.set).toHaveBeenCalledTimes(1)
  })

  it('encerrada traz o resultado público; agendada e inexistente dão 404', async () => {
    const ctx = await setup()
    const closed = await ctx.make('c2', -2, 'closed')
    const detail = await ctx.get.execute(closed.assembly.id)
    expect(detail.result).toMatchObject({
      outcome: 'approved',
      reason: 'decided',
      winningOptionId: closed.options[0].id,
      voterCount: 3,
    })
    const scheduled = await ctx.make('c3', 7, 'scheduled')
    await expect(ctx.get.execute(scheduled.assembly.id)).rejects.toBeInstanceOf(
      AssemblyNotFoundError,
    )
    await expect(ctx.get.execute('nada')).rejects.toBeInstanceOf(AssemblyNotFoundError)
  })
})

describe('ficha da pauta com efeito composto (MO.6.13)', () => {
  it('lista os dois efeitos na ordem da pauta, sem valor absoluto e sem lado recomendado', async () => {
    const ctx = await setup()
    const { assembly, options } = await ctx.repository.create(
      {
        kind: SHAREHOLDER_KIND,
        subjectRef: 'c1',
        dedupeKey: 'composto',
        opensAt: NOW,
        snapshotAt: NOW,
        closesAt: new Date(NOW.getTime() + 7 * DAY),
        effectAppliesAt: new Date(NOW.getTime() + 8 * DAY),
        options: [
          {
            key: 'a',
            label: 'A',
            gain: 'g',
            loss: 'l',
            effect: {
              effects: [
                { metric: 'payout_ratio_pct', direction: -1, intensity: 1 },
                { metric: 'base_growth_pct', direction: 1, intensity: 0.5 },
              ],
            },
          },
          {
            key: 'b',
            label: 'B',
            gain: 'g',
            loss: 'l',
            effect: { effects: [{ metric: 'dividend_policy', value: 'annual' }] },
          },
        ],
      },
      NOW,
    )
    await ctx.repository.markOpen(assembly.id)
    const detail = await ctx.get.execute(assembly.id)
    expect(detail.options.map((o) => o.effects)).toEqual([
      [
        { metric: 'payout', direction: -1, intensity: 1 },
        { metric: 'growth', direction: 1, intensity: 0.5 },
      ],
      [{ metric: 'dividend_policy', value: 'annual' }],
    ])
    // `effect` segue sendo o primeiro, para quem ainda lê um só.
    expect(detail.options[0].effect).toEqual({ metric: 'payout', direction: -1, intensity: 1 })
    expect(options).toHaveLength(2)
  })
})

describe('dividendo retido pela assembleia (MO.6.13)', () => {
  const base = {
    declarationId: 'decl-1',
    status: 'open',
    outcome: null,
    effectAppliedAt: null,
  } as Partial<Assembly>
  const hold = (patch: Partial<Assembly>) => holdsDividend({ ...base, ...patch } as Assembly)

  it('retém enquanto aberta e, se aprovada, até o efeito ser entregue', () => {
    expect(hold({})).toBe(true)
    expect(hold({ status: 'scheduled' })).toBe(true)
    expect(hold({ status: 'closed', outcome: 'approved' })).toBe(true)
  })

  it('libera quando o efeito foi entregue ou a pauta não passou', () => {
    expect(hold({ status: 'closed', outcome: 'approved', effectAppliedAt: new Date() })).toBe(false)
    expect(hold({ status: 'closed', outcome: 'not_approved' })).toBe(false)
  })

  it('assembleia sem declaração nunca retém', () => {
    expect(hold({ declarationId: null })).toBe(false)
  })

  it('o resumo público leva o indicador', async () => {
    const ctx = await setup()
    const { assembly } = await ctx.make('c1', 5, 'open')
    expect((await ctx.list.execute({ closedLimit: 5 })).open[0].dividendOnHold).toBe(false)
    expect(assembly.declarationId).toBeNull()
  })
})
