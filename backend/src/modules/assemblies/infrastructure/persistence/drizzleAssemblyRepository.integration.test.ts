import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import type { NewAssemblyInput } from '../../domain/assembly'
import { validateTemplateInput } from '../../domain/agendaTemplates'
import { parseEngineEffects } from '../engine/engineShareholderEffect'
import { createDrizzleAgendaCatalog } from './drizzleAgendaCatalog'
import { createDrizzleAssemblyRepository } from './drizzleAssemblyRepository'

// Integração (MO.6.1): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga as
// tabelas de assembleia e os usuários que ele mesmo cria). Prova a abertura idempotente, a troca de voto e a trava de
// janela sob concorrência com o fechamento.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositório de assembleias (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]
  const now = new Date('2026-10-10T12:00:00Z')
  const input: NewAssemblyInput = {
    kind: 'shareholder',
    subjectRef: 'BNDD3',
    dedupeKey: 'BNDD3:2026-Q3',
    snapshotAt: now,
    opensAt: now,
    closesAt: new Date('2026-10-17T12:00:00Z'),
    effectAppliesAt: new Date('2026-10-20T12:00:00Z'),
    options: [
      { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: { x: 1 } },
      { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
    ],
  }

  async function clean() {
    await db.delete(schema.assemblyVotes)
    await db.delete(schema.assemblyOptions)
    await db.delete(schema.assemblies)
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await clean()
    const suffix = randomUUID().slice(0, 8)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'bia', 'caio'].map((u) => ({
          name: u,
          username: `${u}-${suffix}`,
          email: `${u}-${suffix}@exemplo.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    ids = rows.map((r) => r.id)
  })

  afterAll(async () => {
    // Só remove o que este arquivo criou: não depende (nem atrapalha) o estado dos outros testes.
    await clean()
    await db.delete(schema.users).where(inArray(schema.users.id, ids))
    await pool.end()
  })

  it('cria com opções em ordem e reexecutar a abertura não duplica', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const first = await repo.create(input, now)
    const again = await repo.create(input, now)
    expect(first.created).toBe(true)
    expect(again.created).toBe(false)
    expect(again.assembly.id).toBe(first.assembly.id)
    expect(first.options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(first.options[0].effect).toEqual({ x: 1 })
    expect(await db.select().from(schema.assemblies)).toHaveLength(1)
  })

  it('guarda a declaração de dividendo que a assembleia libera e acha a assembleia pela chave (MO.6.13)', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const declarationId = randomUUID()
    const profit = {
      ...input,
      dedupeKey: 'shareholder:company-1:91',
      declarationId,
      options: [
        {
          key: 'a',
          label: 'A',
          gain: 'g',
          loss: 'l',
          effect: { effects: [{ metric: 'payout_ratio_pct', direction: -1, intensity: 1 }] },
        },
        {
          key: 'b',
          label: 'B',
          gain: 'g',
          loss: 'l',
          effect: { effects: [{ metric: 'dividend_policy', value: 'annual' }] },
        },
      ],
    }
    const created = await repo.create(profit, now)
    expect(created.assembly.declarationId).toBe(declarationId)
    expect(created.options[0].effect).toEqual(profit.options[0].effect)
    // Sem declaração é nulo, e a reabertura com a mesma chave devolve a que já existe.
    const plain = await repo.create(input, now)
    expect(plain.assembly.declarationId).toBeNull()
    const again = await repo.create({ ...profit, declarationId: randomUUID() }, now)
    expect(again.created).toBe(false)
    expect(again.assembly.declarationId).toBe(declarationId)

    const found = await repo.findByDedupeKey('shareholder:company-1:91')
    expect(found?.assembly.id).toBe(created.assembly.id)
    expect(found?.options).toHaveLength(2)
    expect(await repo.findByDedupeKey('nao-existe')).toBeNull()
  })

  it('só aceita voto com a assembleia aberta e dentro da janela; trocar o voto mantém uma linha', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly, options } = await repo.create(input, now)
    const vote = (optionId: string, at = now) =>
      repo.upsertVote({ assemblyId: assembly.id, userId: ids[0], optionId }, at)

    expect(await vote(options[0].id)).toBe(false) // ainda agendada
    expect(await repo.markOpen(assembly.id)).toBe(true)
    expect(await repo.markOpen(assembly.id)).toBe(false)
    expect(await vote(options[0].id)).toBe(true)
    expect(await vote(options[1].id, new Date('2026-10-12T00:00:00Z'))).toBe(true)
    const votes = await repo.listVotes(assembly.id)
    expect(votes).toHaveLength(1)
    expect(votes[0].optionId).toBe(options[1].id)
    expect(await vote(options[0].id, new Date('2026-10-17T12:00:00Z'))).toBe(false) // no fechamento
  })

  it('fecha uma vez só e depois disso o voto é recusado', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly, options } = await repo.create(input, now)
    await repo.markOpen(assembly.id)
    const decision = {
      outcome: 'approved' as const,
      reason: 'decided' as const,
      winningOptionId: options[0].id,
      voterCount: 3,
      decidedAt: now,
    }
    expect(await repo.close(assembly.id, decision)).toBe(true)
    expect(await repo.close(assembly.id, decision)).toBe(false)
    const closed = await repo.findById(assembly.id)
    expect(closed?.assembly).toMatchObject({ status: 'closed', outcome: 'approved', voterCount: 3 })
    expect(
      await repo.upsertVote(
        { assemblyId: assembly.id, userId: ids[0], optionId: options[0].id },
        now,
      ),
    ).toBe(false)
    expect(await repo.listByStatus('closed', 10)).toHaveLength(1)
  })

  it('lista as abertas vencidas e as aprovadas com efeito devido, e marca o efeito uma vez só', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly, options } = await repo.create(
      { ...input, title: 'Orçamento', subjectLabel: 'Acme', templateKey: 'capital_budget' },
      now,
    )
    await repo.markOpen(assembly.id)
    expect(await repo.listOpenDue(new Date('2026-10-17T11:59:59Z'), 10)).toHaveLength(0)
    const due = await repo.listOpenDue(new Date('2026-10-17T12:00:00Z'), 10)
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({
      title: 'Orçamento',
      subjectLabel: 'Acme',
      templateKey: 'capital_budget',
      effectAppliedAt: null,
    })

    await repo.close(assembly.id, {
      outcome: 'approved',
      reason: 'decided',
      winningOptionId: options[0].id,
      voterCount: 3,
      decidedAt: now,
    })
    expect(await repo.listApprovedPendingEffect(new Date('2026-10-20T11:59:59Z'), 10)).toHaveLength(
      0,
    )
    const pending = await repo.listApprovedPendingEffect(new Date('2026-10-20T12:00:00Z'), 10)
    expect(pending).toHaveLength(1)
    expect(pending[0].options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(await repo.markEffectApplied(assembly.id, now)).toBe(true)
    expect(await repo.markEffectApplied(assembly.id, now)).toBe(false)
    expect(await repo.listApprovedPendingEffect(new Date('2026-10-21T00:00:00Z'), 10)).toHaveLength(
      0,
    )
  })

  it('assembleia não aprovada nunca entra na fila de efeitos', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly } = await repo.create(input, now)
    await repo.markOpen(assembly.id)
    await repo.close(assembly.id, {
      outcome: 'not_approved',
      reason: 'quorum',
      winningOptionId: null,
      voterCount: 1,
      decidedAt: now,
    })
    expect(await repo.listApprovedPendingEffect(new Date('2027-01-01T00:00:00Z'), 10)).toHaveLength(
      0,
    )
  })

  it('publicação do resultado: só fechadas sem marca entram na fila e a marca vale uma vez só (MO.6.7)', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const open = await repo.create({ ...input, dedupeKey: 'open' }, now)
    await repo.markOpen(open.assembly.id)
    const closed = await repo.create({ ...input, dedupeKey: 'closed' }, now)
    await repo.markOpen(closed.assembly.id)
    await repo.close(closed.assembly.id, {
      outcome: 'not_approved',
      reason: 'quorum',
      winningOptionId: null,
      voterCount: 1,
      decidedAt: now,
    })

    const queue = await repo.listClosedUnannounced(10)
    expect(queue.map((a) => a.id)).toEqual([closed.assembly.id])
    expect(queue[0].resultAnnouncedAt).toBeNull()

    expect(await repo.markResultAnnounced(closed.assembly.id, now)).toBe(true)
    expect(await repo.markResultAnnounced(closed.assembly.id, now)).toBe(false)
    expect(await repo.listClosedUnannounced(10)).toHaveLength(0)
    expect((await repo.findById(closed.assembly.id))?.assembly.resultAnnouncedAt).toEqual(now)
  })

  it('conta assembleias distintas em que a pessoa votou, trocar o voto não conta de novo (MO.6.7)', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const first = await repo.create({ ...input, dedupeKey: 'p1' }, now)
    const second = await repo.create({ ...input, dedupeKey: 'p2' }, now)
    for (const created of [first, second]) await repo.markOpen(created.assembly.id)
    expect(await repo.countVotedAssemblies(ids[0])).toBe(0)

    await repo.castVote(
      { assemblyId: first.assembly.id, userId: ids[0], optionId: first.options[0].id },
      now,
    )
    await repo.castVote(
      { assemblyId: first.assembly.id, userId: ids[0], optionId: first.options[1].id },
      now,
    )
    expect(await repo.countVotedAssemblies(ids[0])).toBe(1)

    await repo.castVote(
      { assemblyId: second.assembly.id, userId: ids[0], optionId: second.options[0].id },
      now,
    )
    expect(await repo.countVotedAssemblies(ids[0])).toBe(2)
    expect(await repo.countVotedAssemblies(ids[1])).toBe(0)
  })

  it('o catálogo semeado (MO.6.15) tem 28 pautas com troca real, efeito composto e finalidade', async () => {
    const templates = await createDrizzleAgendaCatalog(db).listActive('shareholder')
    expect(templates).toHaveLength(28)
    expect(templates.filter((t) => t.purpose === 'profit')).toHaveLength(10)
    expect(templates.filter((t) => t.purpose === 'general')).toHaveLength(18)
    expect(templates.some((t) => t.sector === null)).toBe(true)
    // Toda pauta decide o destino do lucro (profit) só com alavanca de lucro; a comum só mexe em
    // crescimento e qualidade. Um setor sem pauta de lucro nunca seria liberado pela assembleia.
    const profitMetrics = ['payout_ratio_pct', 'pn_dividend_premium_pct', 'dividend_policy']
    for (const template of templates) {
      const metrics = template.options.flatMap((o) =>
        parseEngineEffects(o.effect).map((e) => e.metric),
      )
      if (template.purpose === 'profit') {
        expect(
          metrics.some((m) => profitMetrics.includes(m)),
          template.key,
        ).toBe(true)
      } else {
        expect(
          metrics.every((m) => !profitMetrics.includes(m)),
          template.key,
        ).toBe(true)
      }
    }
    const profitSectors = new Set(
      templates.filter((t) => t.purpose === 'profit').map((t) => t.sector),
    )
    expect(profitSectors.size).toBe(7) // qualquer setor (null) e os seis setores
    // Mistura de sentidos: nada de catálogo que só empurra para cima (ponto 053).
    const directions = templates.flatMap((t) =>
      t.options.flatMap((o) =>
        parseEngineEffects(o.effect).flatMap((e) => ('direction' in e ? [e.direction] : [])),
      ),
    )
    const up = directions.filter((d) => d === 1).length
    expect(up / directions.length).toBeGreaterThan(0.4)
    expect(up / directions.length).toBeLessThan(0.6)
    const sectors = new Set(templates.map((t) => t.sector).filter(Boolean))
    expect(sectors).toEqual(
      new Set([
        'Varejo',
        'Energia',
        'Mineração',
        'Agronegócio',
        'Bancário/Financeiro',
        'Tecnologia',
      ]),
    )
    for (const template of templates) {
      expect(template.options.length, template.key).toBeGreaterThanOrEqual(2)
      expect(template.options.length, template.key).toBeLessThanOrEqual(4)
      for (const option of template.options) {
        expect(option.gain && option.loss && option.label, template.key).toBeTruthy()
        const effects = parseEngineEffects(option.effect)
        expect(effects.length, `${template.key}/${option.key}`).toBeGreaterThanOrEqual(1)
        expect(effects.length, `${template.key}/${option.key}`).toBeLessThanOrEqual(2)
        expect(
          `${template.title}${template.description}${option.label}${option.gain}${option.loss}`,
        ).not.toMatch(/[–—]/)
      }
      // O mesmo validador do painel aceita a pauta semeada.
      expect(() => validateTemplateInput(template), template.key).not.toThrow()
    }
  })

  describe('castVote (MO.6.4)', () => {
    const open = async (repo: ReturnType<typeof createDrizzleAssemblyRepository>, key: string) => {
      const created = await repo.create({ ...input, dedupeKey: key }, now)
      await repo.markOpen(created.assembly.id)
      return { id: created.assembly.id, a: created.options[0].id, b: created.options[1].id }
    }

    it('voto novo grava o voto; trocar mantém uma linha', async () => {
      const repo = createDrizzleAssemblyRepository(db)
      const a = await open(repo, 'cv-1')
      expect(await repo.castVote({ assemblyId: a.id, userId: ids[0], optionId: a.a }, now)).toEqual(
        { status: 'cast', changed: false },
      )
      expect(await repo.castVote({ assemblyId: a.id, userId: ids[0], optionId: a.b }, now)).toEqual(
        { status: 'cast', changed: true },
      )
      expect(await repo.listVotes(a.id)).toHaveLength(1)
      expect((await repo.findVote(a.id, ids[0]))?.optionId).toBe(a.b)
    })

    it('a mesma pessoa vota em várias assembleias', async () => {
      const repo = createDrizzleAssemblyRepository(db)
      const a = await open(repo, 'cv-2')
      const b = await open(repo, 'cv-3')
      const results = await Promise.all([
        repo.castVote({ assemblyId: a.id, userId: ids[1], optionId: a.a }, now),
        repo.castVote({ assemblyId: b.id, userId: ids[1], optionId: b.a }, now),
      ])
      expect(results.map((r) => r.status)).toEqual(['cast', 'cast'])
    })

    it('fora da janela recusa e não grava', async () => {
      const repo = createDrizzleAssemblyRepository(db)
      const a = await open(repo, 'cv-4')
      expect(
        await repo.castVote(
          { assemblyId: a.id, userId: ids[0], optionId: a.a },
          new Date('2026-10-17T12:00:00Z'),
        ),
      ).toEqual({ status: 'closed' })
      expect(await repo.findVote(a.id, ids[0])).toBeNull()
    })

    it('voto simultâneo ao fechamento: ou entra antes da apuração ou é recusado', async () => {
      const repo = createDrizzleAssemblyRepository(db)
      const a = await open(repo, 'cv-7')
      const [vote] = await Promise.all([
        repo.castVote({ assemblyId: a.id, userId: ids[2], optionId: a.a }, now),
        repo.close(a.id, {
          outcome: 'not_approved',
          reason: 'quorum',
          winningOptionId: null,
          voterCount: 0,
          decidedAt: now,
        }),
      ])
      const votes = await repo.listVotes(a.id)
      expect(votes).toHaveLength(vote.status === 'cast' ? 1 : 0)
    })
  })

  it('listPublic: abertas por fechamento, encerradas por mais recente, filtro por empresa e sem agendadas', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const day = 24 * 60 * 60 * 1000
    const make = async (subjectRef: string, closesInDays: number) => {
      const closesAt = new Date(now.getTime() + closesInDays * day)
      const { assembly } = await repo.create(
        {
          ...input,
          subjectRef,
          dedupeKey: `${subjectRef}:${closesInDays}`,
          snapshotAt: new Date(closesAt.getTime() - 7 * day),
          opensAt: new Date(closesAt.getTime() - 7 * day),
          closesAt,
          effectAppliesAt: new Date(closesAt.getTime() + day),
        },
        now,
      )
      return assembly.id
    }
    const a = await make('c1', 5)
    const b = await make('c2', 2)
    const c = await make('c1', -3)
    const d = await make('c1', -1)
    await make('c3', 9) // fica agendada
    for (const id of [a, b, c, d]) await repo.markOpen(id)
    for (const id of [c, d]) {
      await repo.close(id, {
        outcome: 'not_approved',
        reason: 'quorum',
        winningOptionId: null,
        voterCount: 0,
        decidedAt: now,
      })
    }
    expect((await repo.listPublic({ status: 'open', limit: 10 })).map((x) => x.id)).toEqual([b, a])
    expect((await repo.listPublic({ status: 'closed', limit: 10 })).map((x) => x.id)).toEqual([
      d,
      c,
    ])
    expect(
      (await repo.listPublic({ status: 'closed', subjectRef: 'c1', limit: 1 })).map((x) => x.id),
    ).toEqual([d])
    expect(await repo.listPublic({ status: 'open', subjectRef: 'c3', limit: 10 })).toEqual([])
  })
})
