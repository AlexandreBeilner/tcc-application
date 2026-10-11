import { describe, expect, it } from 'vitest'
import { AssemblyKindRegistry } from '../assemblyKinds'
import {
  AgendaTemplateConflictError,
  AgendaTemplateNotFoundError,
  AssemblyNotFoundError,
  AssemblyPauseConflictError,
  AssemblyPauseNotFoundError,
  InvalidAgendaTemplateError,
  InvalidAssemblyPauseError,
} from '../../domain/errors'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAgendaCatalogAdmin } from '../../test/fakes/fakeAgendaCatalogAdmin'
import { createFakeAssemblyPauseRepository } from '../../test/fakes/fakeAssemblyPauseRepository'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { GetAdminAssemblyDetailUseCase, ListAdminAssembliesUseCase } from './adminAssemblies'
import {
  CreateAgendaTemplateUseCase,
  ListAgendaTemplatesAdminUseCase,
  SetAgendaTemplateActiveUseCase,
  UpdateAgendaTemplateUseCase,
} from './agendaTemplatesAdmin'
import {
  LiftAssemblyPauseUseCase,
  ListAssemblyPausesUseCase,
  PauseAssembliesUseCase,
} from './assemblyPauses'

const T = new Date('2026-10-11T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const effect = { metric: 'base_growth_pct', direction: 1, intensity: 0.5 }
const content = {
  sector: null,
  title: 'Orçamento de capital',
  description: 'A empresa separa parte do lucro para investir.',
  options: [
    {
      key: 'expandir',
      label: 'Ampliar a capacidade',
      gain: 'Cresce mais.',
      loss: 'Margem menor.',
      effect,
    },
    {
      key: 'eficiencia',
      label: 'Ganhar eficiência',
      gain: 'Margem maior.',
      loss: 'Cresce menos.',
      effect,
    },
  ],
}

describe('pausas (casos de uso)', () => {
  it('pausa, lista como vigente e a retomada vai para o histórico', async () => {
    const pauses = createFakeAssemblyPauseRepository()
    const pause = await new PauseAssembliesUseCase(pauses, () => T).execute('admin-1', {
      scope: 'global',
      reason: 'revisão das pautas',
    })
    const listing = new ListAssemblyPausesUseCase(pauses)
    expect((await listing.execute()).active.map((p) => p.id)).toEqual([pause.id])

    await new LiftAssemblyPauseUseCase(pauses, () => T).execute('admin-2', pause.id)
    const after = await listing.execute()
    expect(after.active).toEqual([])
    expect(after.recent[0]).toMatchObject({ id: pause.id, liftedBy: 'admin-2', liftedAt: T })
  })

  it('uma só pausa vigente por escopo (global e por empresa são escopos diferentes)', async () => {
    const pauses = createFakeAssemblyPauseRepository()
    const pause = new PauseAssembliesUseCase(pauses, () => T)
    await pause.execute('a', { scope: 'global', reason: 'motivo um' })
    await expect(
      pause.execute('a', { scope: 'global', reason: 'motivo dois' }),
    ).rejects.toBeInstanceOf(AssemblyPauseConflictError)
    await pause.execute('a', {
      scope: 'subject',
      kind: SHAREHOLDER_KIND,
      subjectRef: 'c1',
      reason: 'motivo',
    })
    await expect(
      pause.execute('a', {
        scope: 'subject',
        kind: SHAREHOLDER_KIND,
        subjectRef: 'c1',
        reason: 'outra',
      }),
    ).rejects.toThrow(/esta empresa/)
    // Depois de retomada, o escopo volta a aceitar uma pausa.
    const [first] = await pauses.listActive()
    await pauses.lift(first.id, 'a', T)
    await expect(pause.execute('a', { scope: 'global', reason: 'de novo' })).resolves.toBeDefined()
  })

  it('recusa pausa inválida sem gravar', async () => {
    const pauses = createFakeAssemblyPauseRepository()
    await expect(
      new PauseAssembliesUseCase(pauses, () => T).execute('a', { scope: 'global', reason: ' ' }),
    ).rejects.toBeInstanceOf(InvalidAssemblyPauseError)
    expect(pauses.items).toHaveLength(0)
  })

  it('retomar pausa inexistente ou já retomada é recusado', async () => {
    const pauses = createFakeAssemblyPauseRepository()
    const lift = new LiftAssemblyPauseUseCase(pauses, () => T)
    await expect(lift.execute('a', 'nao-existe')).rejects.toBeInstanceOf(AssemblyPauseNotFoundError)
    const created = await new PauseAssembliesUseCase(pauses, () => T).execute('a', {
      scope: 'global',
      reason: 'motivo',
    })
    await lift.execute('a', created.id)
    await expect(lift.execute('a', created.id)).rejects.toBeInstanceOf(AssemblyPauseConflictError)
  })
})

describe('catálogo de pautas (casos de uso)', () => {
  it('cria nova pauta ativa, valida e recusa chave repetida', async () => {
    const catalog = createFakeAgendaCatalogAdmin()
    const create = new CreateAgendaTemplateUseCase(catalog)
    const created = await create.execute('capital_budget', content)
    expect(created).toMatchObject({ key: 'capital_budget', active: true, kind: SHAREHOLDER_KIND })
    await expect(create.execute('capital_budget', content)).rejects.toBeInstanceOf(
      AgendaTemplateConflictError,
    )
    await expect(create.execute('Chave Ruim', content)).rejects.toBeInstanceOf(
      InvalidAgendaTemplateError,
    )
    await expect(create.execute('outra_pauta', { ...content, options: [] })).rejects.toBeInstanceOf(
      InvalidAgendaTemplateError,
    )
    expect(await new ListAgendaTemplatesAdminUseCase(catalog).execute()).toHaveLength(1)
  })

  it('edita o conteúdo sem trocar a chave nem o estado ativo', async () => {
    const catalog = createFakeAgendaCatalogAdmin()
    await new CreateAgendaTemplateUseCase(catalog).execute('capital_budget', content)
    await new SetAgendaTemplateActiveUseCase(catalog).execute('capital_budget', false)
    const updated = await new UpdateAgendaTemplateUseCase(catalog).execute('capital_budget', {
      ...content,
      title: 'Orçamento do próximo ciclo',
    })
    expect(updated).toMatchObject({
      key: 'capital_budget',
      title: 'Orçamento do próximo ciclo',
      active: false,
    })
  })

  it('editar ou ativar pauta que não existe é 404 de domínio', async () => {
    const catalog = createFakeAgendaCatalogAdmin()
    await expect(
      new UpdateAgendaTemplateUseCase(catalog).execute('nao_existe', content),
    ).rejects.toBeInstanceOf(AgendaTemplateNotFoundError)
    await expect(
      new SetAgendaTemplateActiveUseCase(catalog).execute('nao_existe', true),
    ).rejects.toBeInstanceOf(AgendaTemplateNotFoundError)
  })

  it('uma edição inválida não altera a pauta guardada', async () => {
    const catalog = createFakeAgendaCatalogAdmin()
    await new CreateAgendaTemplateUseCase(catalog).execute('capital_budget', content)
    await expect(
      new UpdateAgendaTemplateUseCase(catalog).execute('capital_budget', {
        ...content,
        options: [
          content.options[0],
          { ...content.options[1], effect: { ...effect, intensity: 3 } },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidAgendaTemplateError)
    expect(catalog.items.get('capital_budget')?.title).toBe('Orçamento de capital')
  })
})

describe('leitura do painel (casos de uso)', () => {
  async function setup() {
    const repository = createFakeAssemblyRepository()
    const pauses = createFakeAssemblyPauseRepository()
    const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
      policies: shareholderPolicies,
      effect: { apply: async () => undefined },
    })
    const { assembly, options } = await repository.create(
      {
        kind: SHAREHOLDER_KIND,
        subjectRef: 'company-1',
        dedupeKey: 'shareholder:company-1:91',
        opensAt: T,
        snapshotAt: T,
        closesAt: new Date(T.getTime() + 7 * DAY),
        effectAppliesAt: new Date(T.getTime() + 8 * DAY),
        title: 'Pauta',
        subjectLabel: 'Acme',
        minVoters: 3,
        options: content.options.map((o) => ({ ...o })),
      },
      T,
    )
    await repository.markOpen(assembly.id)
    return { repository, pauses, kinds, assembly, options }
  }

  it('lista todos os estados, inclusive a agendada, e marca o que uma pausa cobre', async () => {
    const { repository, pauses } = await setup()
    await repository.create(
      {
        kind: SHAREHOLDER_KIND,
        subjectRef: 'company-2',
        dedupeKey: 'shareholder:company-2:92',
        opensAt: T,
        snapshotAt: T,
        closesAt: new Date(T.getTime() + DAY),
        effectAppliesAt: new Date(T.getTime() + 2 * DAY),
        options: content.options.map((o) => ({ ...o })),
      },
      T,
    )
    await pauses.create(
      { scope: 'subject', kind: SHAREHOLDER_KIND, subjectRef: 'company-2', reason: 'motivo' },
      'a',
      T,
    )
    const rows = await new ListAdminAssembliesUseCase(repository, pauses, () => T).execute()
    expect(rows.map((r) => [r.subjectRef, r.status, r.paused])).toEqual(
      expect.arrayContaining([
        ['company-1', 'open', false],
        ['company-2', 'scheduled', true],
      ]),
    )
    const onlyOpen = await new ListAdminAssembliesUseCase(repository, pauses, () => T).execute(
      'open',
    )
    expect(onlyOpen.map((r) => r.subjectRef)).toEqual(['company-1'])
  })

  it('o detalhe mostra o voto por pessoa com o peso na data de corte e descarta quem não era acionista', async () => {
    const { repository, pauses, kinds, assembly, options } = await setup()
    const snapshot = {
      takenAt: T,
      holdings: [
        { userId: 'u1', quantity: 10 },
        { userId: 'u2', quantity: 30 },
      ],
    }
    for (const [userId, optionIndex] of [
      ['u1', 0],
      ['u2', 1],
      ['u3', 0],
    ] as const) {
      await repository.upsertVote(
        { assemblyId: assembly.id, userId, optionId: options[optionIndex].id },
        T,
      )
    }
    const detail = await new GetAdminAssemblyDetailUseCase(
      kinds,
      repository,
      { take: async () => snapshot, get: async () => snapshot },
      pauses,
      () => 99,
      () => T,
    ).execute(assembly.id)

    expect(detail.minVoters).toBe(3)
    expect(detail.holders).toBe(2)
    expect(detail.countedVoters).toBe(2)
    expect(
      detail.votes.map((v: { userId: string; weight: number | null; eligible: boolean }) => [
        v.userId,
        v.weight,
        v.eligible,
      ]),
    ).toEqual([
      ['u1', 10, true],
      ['u2', 30, true],
      ['u3', null, false],
    ])
    expect(detail.options.map((o) => [o.key, o.voters, o.weight])).toEqual([
      ['expandir', 1, 10],
      ['eficiencia', 1, 30],
    ])
  })

  it('assembleia anterior ao parâmetro usa o quórum de agora; agendada não pede snapshot', async () => {
    const { repository, pauses, kinds } = await setup()
    const scheduled = await repository.create(
      {
        kind: SHAREHOLDER_KIND,
        subjectRef: 'company-3',
        dedupeKey: 'shareholder:company-3:93',
        opensAt: T,
        snapshotAt: T,
        closesAt: new Date(T.getTime() + DAY),
        effectAppliesAt: new Date(T.getTime() + 2 * DAY),
        options: content.options.map((o) => ({ ...o })),
      },
      T,
    )
    let snapshotCalls = 0
    const detail = await new GetAdminAssemblyDetailUseCase(
      kinds,
      repository,
      {
        take: async () => ({ takenAt: T, holdings: [] }),
        get: async () => {
          snapshotCalls += 1
          return { takenAt: T, holdings: [] }
        },
      },
      pauses,
      () => 5,
      () => T,
    ).execute(scheduled.assembly.id)
    expect(detail.minVoters).toBe(5)
    expect(detail.votes).toEqual([])
    expect(snapshotCalls).toBe(0)
  })

  it('assembleia inexistente é recusada', async () => {
    const { repository, pauses, kinds } = await setup()
    await expect(
      new GetAdminAssemblyDetailUseCase(
        kinds,
        repository,
        {
          take: async () => ({ takenAt: T, holdings: [] }),
          get: async () => ({ takenAt: T, holdings: [] }),
        },
        pauses,
        () => 3,
      ).execute('nao-existe'),
    ).rejects.toBeInstanceOf(AssemblyNotFoundError)
  })

  it('efeito pendente: aprovada, devida e ainda não entregue', async () => {
    const { repository, pauses, assembly, options } = await setup()
    await repository.close(assembly.id, {
      outcome: 'approved',
      reason: 'decided',
      winningOptionId: options[0].id,
      voterCount: 3,
      decidedAt: T,
    })
    const at = (ms: number) => () => new Date(T.getTime() + ms)
    const list = (clock: () => Date) =>
      new ListAdminAssembliesUseCase(repository, pauses, clock).execute()
    expect((await list(at(0)))[0].effectPending).toBe(false)
    expect((await list(at(9 * DAY)))[0].effectPending).toBe(true)
    await repository.markEffectApplied(assembly.id, T)
    expect((await list(at(9 * DAY)))[0].effectPending).toBe(false)
  })
})
