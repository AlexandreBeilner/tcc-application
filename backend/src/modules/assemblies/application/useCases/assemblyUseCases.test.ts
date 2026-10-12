import { describe, expect, it, vi } from 'vitest'
import type { HoldingsSnapshot, KindPolicies, NewAssemblyInput } from '../../domain/assembly'
import { UnknownAssemblyKindError } from '../../domain/errors'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { AssemblyKindRegistry } from '../assemblyKinds'
import { CreateAssemblyUseCase } from './createAssembly'
import { TallyAssemblyUseCase } from './tallyAssembly'

const now = new Date('2026-10-10T12:00:00Z')
const options = [
  { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: {} },
  { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
]
function input(kind: string, dedupeKey = 'k1'): NewAssemblyInput {
  return {
    kind,
    subjectRef: 'ref',
    dedupeKey,
    snapshotAt: now,
    opensAt: now,
    closesAt: new Date('2026-10-17T12:00:00Z'),
    effectAppliesAt: new Date('2026-10-17T12:00:00Z'),
    options,
  }
}

// Kind fictício: sem posição, voto de peso 1. Prova que um kind novo entra só registrando
// políticas e efeito, sem tocar o núcleo (domínio, repositório e casos de uso).
const INVESTOR_MACRO = 'investor_macro'
const macroPolicies: KindPolicies = { isEligible: () => true, weightOf: () => 1 }

function setup() {
  const effect = { apply: vi.fn(async () => undefined) }
  const kinds = new AssemblyKindRegistry()
    .register(SHAREHOLDER_KIND, { policies: shareholderPolicies, effect })
    .register(INVESTOR_MACRO, { policies: macroPolicies, effect })
  const repository = createFakeAssemblyRepository()
  let snapshot: HoldingsSnapshot = { takenAt: now, holdings: [] }
  const snapshots = { get: vi.fn(async () => snapshot) }
  return {
    kinds,
    repository,
    create: new CreateAssemblyUseCase(kinds, repository, () => now),
    tally: new TallyAssemblyUseCase(kinds, repository, snapshots, () => ({ minVoters: 3 })),
    setSnapshot: (s: HoldingsSnapshot) => (snapshot = s),
  }
}

async function open(ctx: ReturnType<typeof setup>, kind: string) {
  const { assembly, options: opts } = await ctx.create.execute(input(kind))
  await ctx.repository.markOpen(assembly.id)
  return { id: assembly.id, a: opts[0].id, b: opts[1].id }
}

describe('CreateAssemblyUseCase', () => {
  it('cria com as opções em ordem e é idempotente pelo dedupeKey', async () => {
    const ctx = setup()
    const first = await ctx.create.execute(input(SHAREHOLDER_KIND))
    const again = await ctx.create.execute(input(SHAREHOLDER_KIND))
    expect(first.created).toBe(true)
    expect(first.options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(again.created).toBe(false)
    expect(again.assembly.id).toBe(first.assembly.id)
    expect(ctx.repository.items.size).toBe(1)
  })

  it('recusa kind sem registro', async () => {
    await expect(setup().create.execute(input('desconhecido'))).rejects.toBeInstanceOf(
      UnknownAssemblyKindError,
    )
  })
})

describe('TallyAssemblyUseCase', () => {
  it('shareholder: peso por ações do snapshot', async () => {
    const ctx = setup()
    const { id, a, b } = await open(ctx, SHAREHOLDER_KIND)
    ctx.setSnapshot({
      takenAt: now,
      holdings: [
        { userId: 'u1', quantity: 100 },
        { userId: 'u2', quantity: 30 },
        { userId: 'u3', quantity: 30 },
      ],
    })
    await ctx.repository.upsertVote({ assemblyId: id, userId: 'u1', optionId: a }, now)
    await ctx.repository.upsertVote({ assemblyId: id, userId: 'u2', optionId: b }, now)
    await ctx.repository.upsertVote({ assemblyId: id, userId: 'u3', optionId: b }, now)
    const result = await ctx.tally.execute(id)
    expect(result.winningOptionId).toBe(a)
    expect(result.totals.map((t) => t.weight)).toEqual([100, 60])
  })

  it('kind fictício (peso 1, sem posição) apura sem mudar o núcleo', async () => {
    const ctx = setup()
    const { id, a, b } = await open(ctx, INVESTOR_MACRO)
    for (const [user, option] of [
      ['u1', b],
      ['u2', b],
      ['u3', a],
    ]) {
      await ctx.repository.upsertVote({ assemblyId: id, userId: user, optionId: option }, now)
    }
    const result = await ctx.tally.execute(id)
    expect(result.winningOptionId).toBe(b)
    expect(result.totals.map((t) => t.weight)).toEqual([1, 2])
  })

  it('trocar o voto até o fechamento mantém uma linha só e vale o último', async () => {
    const ctx = setup()
    const { id, a, b } = await open(ctx, INVESTOR_MACRO)
    await ctx.repository.upsertVote({ assemblyId: id, userId: 'u1', optionId: a }, now)
    await ctx.repository.upsertVote({ assemblyId: id, userId: 'u1', optionId: b }, now)
    expect(await ctx.repository.listVotes(id)).toHaveLength(1)
    expect((await ctx.repository.listVotes(id))[0].optionId).toBe(b)
  })

  it('não aceita voto depois do fechamento', async () => {
    const ctx = setup()
    const { id, a } = await open(ctx, INVESTOR_MACRO)
    const late = new Date('2026-10-17T12:00:00Z')
    expect(
      await ctx.repository.upsertVote({ assemblyId: id, userId: 'u1', optionId: a }, late),
    ).toBe(false)
  })
})
