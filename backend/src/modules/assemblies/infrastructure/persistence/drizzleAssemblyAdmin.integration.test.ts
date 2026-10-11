import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { eq, inArray, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleAgendaCatalog } from './drizzleAgendaCatalog'
import { createDrizzleAgendaCatalogAdmin } from './drizzleAgendaCatalogAdmin'
import { createDrizzleAssemblyPauseRepository } from './drizzleAssemblyPauseRepository'
import { createDrizzleAssemblyRepository } from './drizzleAssemblyRepository'
import { createDrizzleAssemblySettingsStore } from './drizzleAssemblySettingsStore'

// Integração (MO.6.8): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL. Prova a
// pausa única por escopo sob concorrência, a retomada condicional, os parâmetros gravados e o
// catálogo editável com o uso.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('painel das assembleias (banco real)', () => {
  let pool: Pool
  let db: Database
  let adminId: string
  const now = new Date('2026-10-11T12:00:00Z')
  const prefix = `t68_${randomUUID().slice(0, 6)}`

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
    const suffix = randomUUID().slice(0, 8)
    const [admin] = await db
      .insert(schema.users)
      .values({
        name: 'adm',
        username: `adm-${suffix}`,
        email: `adm-${suffix}@exemplo.com`,
        passwordHash: 'x',
      })
      .returning({ id: schema.users.id })
    adminId = admin.id
  })

  beforeEach(async () => {
    await db.delete(schema.assemblyPauses)
    await db.delete(schema.assemblySettings)
    await db.delete(schema.agendaTemplates).where(like(schema.agendaTemplates.key, `${prefix}%`))
  })

  afterAll(async () => {
    await db.delete(schema.assemblyPauses)
    await db.delete(schema.assemblySettings)
    await db.delete(schema.agendaTemplates).where(like(schema.agendaTemplates.key, `${prefix}%`))
    await db.delete(schema.users).where(inArray(schema.users.id, [adminId]))
    await pool.end()
  })

  describe('pausas', () => {
    const global = { scope: 'global' as const, kind: null, subjectRef: null, reason: 'motivo' }
    const company = (ref: string) => ({
      scope: 'subject' as const,
      kind: 'shareholder',
      subjectRef: ref,
      reason: 'motivo',
    })

    it('cria, lista como vigente e retoma, guardando quem e quando', async () => {
      const repo = createDrizzleAssemblyPauseRepository(db)
      const created = await repo.create(global, adminId, now)
      expect(created.status).toBe('created')
      if (created.status !== 'created') return
      expect((await repo.listActive()).map((p) => p.id)).toEqual([created.pause.id])

      const later = new Date(now.getTime() + 60_000)
      const lifted = await repo.lift(created.pause.id, adminId, later)
      expect(lifted).toMatchObject({
        status: 'lifted',
        pause: { liftedBy: adminId, liftedAt: later },
      })
      expect(await repo.listActive()).toEqual([])
      expect((await repo.listRecent(10))[0].liftedAt).toEqual(later)
    })

    it('duas pausas simultâneas no mesmo escopo: só uma vence', async () => {
      const repo = createDrizzleAssemblyPauseRepository(db)
      const results = await Promise.all(
        Array.from({ length: 5 }, () => repo.create(global, adminId, now)),
      )
      expect(results.filter((r) => r.status === 'created')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'conflict')).toHaveLength(4)
      expect(await repo.listActive()).toHaveLength(1)
    })

    it('global e cada empresa são escopos independentes, e retomada libera o escopo', async () => {
      const repo = createDrizzleAssemblyPauseRepository(db)
      const g = await repo.create(global, adminId, now)
      expect((await repo.create(company('c1'), adminId, now)).status).toBe('created')
      expect((await repo.create(company('c2'), adminId, now)).status).toBe('created')
      expect((await repo.create(company('c1'), adminId, now)).status).toBe('conflict')
      if (g.status !== 'created') return
      await repo.lift(g.pause.id, adminId, now)
      expect((await repo.create(global, adminId, now)).status).toBe('created')
    })

    it('retomar duas vezes ao mesmo tempo só vence uma; inexistente é not_found', async () => {
      const repo = createDrizzleAssemblyPauseRepository(db)
      const created = await repo.create(global, adminId, now)
      if (created.status !== 'created') throw new Error('não criou')
      const results = await Promise.all([
        repo.lift(created.pause.id, adminId, now),
        repo.lift(created.pause.id, adminId, now),
      ])
      expect(results.map((r) => r.status).sort()).toEqual(['already_lifted', 'lifted'])
      expect((await repo.lift(randomUUID(), adminId, now)).status).toBe('not_found')
    })
  })

  describe('parâmetros', () => {
    it('grava, sobrescreve e remove', async () => {
      const store = createDrizzleAssemblySettingsStore(db)
      await store.upsert('min_voters', 5, adminId, now)
      await store.upsert('duration_days', 3, adminId, now)
      await store.upsert('min_voters', 8, adminId, new Date(now.getTime() + 1000))
      const rows = await store.loadAll()
      expect(rows.find((r) => r.key === 'min_voters')).toMatchObject({
        value: 8,
        updatedBy: adminId,
        updatedAt: new Date(now.getTime() + 1000),
      })
      expect(rows).toHaveLength(2)

      await store.remove('min_voters')
      expect((await store.loadAll()).map((r) => r.key)).toEqual(['duration_days'])
    })
  })

  describe('quórum congelado', () => {
    it('a assembleia guarda o quórum da abertura', async () => {
      const repo = createDrizzleAssemblyRepository(db)
      const created = await repo.create(
        {
          kind: 'shareholder',
          subjectRef: `c-${prefix}`,
          dedupeKey: `${prefix}:quorum`,
          opensAt: now,
          snapshotAt: now,
          closesAt: new Date(now.getTime() + 86_400_000),
          effectAppliesAt: new Date(now.getTime() + 2 * 86_400_000),
          minVoters: 4,
          options: [
            { key: 'aa', label: 'A', gain: 'g', loss: 'l', effect: {} },
            { key: 'bb', label: 'B', gain: 'g', loss: 'l', effect: {} },
          ],
        },
        now,
      )
      expect(created.assembly.minVoters).toBe(4)
      expect((await repo.findById(created.assembly.id))?.assembly.minVoters).toBe(4)
      await db.delete(schema.assemblies).where(eq(schema.assemblies.id, created.assembly.id))
    })
  })

  describe('catálogo de pautas', () => {
    const effect = { metric: 'base_growth_pct', direction: 1, intensity: 0.5 }
    const content = {
      sector: 'Varejo',
      title: 'Pauta de teste',
      description: 'Descrição da pauta de teste.',
      options: [
        { key: 'aa', label: 'A', gain: 'g', loss: 'l', effect },
        { key: 'bb', label: 'B', gain: 'g', loss: 'l', effect },
      ],
    }

    it('cria, recusa chave repetida, edita e desativa sem apagar', async () => {
      const catalog = createDrizzleAgendaCatalogAdmin(db)
      const key = `${prefix}_a`
      const created = await catalog.create('shareholder', key, content)
      expect(created).toMatchObject({
        status: 'created',
        template: { key, active: true, sector: 'Varejo' },
      })
      expect((await catalog.create('shareholder', key, content)).status).toBe('conflict')

      const edited = await catalog.update('shareholder', key, {
        ...content,
        title: 'Outro título',
        sector: null,
      })
      expect(edited).toMatchObject({ title: 'Outro título', sector: null, active: true })
      expect(edited?.options).toEqual(content.options)

      const off = await catalog.setActive('shareholder', key, false)
      expect(off?.active).toBe(false)
      expect((await catalog.find('shareholder', key))?.active).toBe(false)
      // A lista do painel traz também as desativadas; o sorteio do ciclo (listActive) não.
      expect((await catalog.listAll('shareholder')).some((t) => t.key === key)).toBe(true)
    })

    it('a finalidade da pauta (geral ou destinação do lucro) é gravada, editável e sorteada à parte (MO.6.13)', async () => {
      const catalog = createDrizzleAgendaCatalogAdmin(db)
      const key = `${prefix}_p`
      const composed = {
        effects: [
          { metric: 'payout_ratio_pct', direction: -1, intensity: 1 },
          { metric: 'dividend_policy', value: 'semiannual' },
        ],
      }
      const profit = {
        ...content,
        purpose: 'profit' as const,
        options: content.options.map((o) => ({ ...o, effect: composed })),
      }
      const created = await catalog.create('shareholder', key, profit)
      expect(created).toMatchObject({ status: 'created', template: { purpose: 'profit' } })
      // O jsonb guarda o efeito composto como veio e a leitura do sorteio traz a finalidade.
      const active = (await createDrizzleAgendaCatalog(db).listActive('shareholder')).find(
        (t) => t.key === key,
      )
      expect(active?.purpose).toBe('profit')
      expect(active?.options[0].effect).toEqual(composed)

      const edited = await catalog.update('shareholder', key, { ...profit, purpose: 'general' })
      expect(edited?.purpose).toBe('general')
      // Sem finalidade informada vale geral (as pautas anteriores ao campo).
      const legacy = await catalog.create('shareholder', `${key}2`, content)
      expect(legacy).toMatchObject({ template: { purpose: 'general' } })
    })

    it('pauta inexistente devolve null; o catálogo semeado aparece com o uso', async () => {
      const catalog = createDrizzleAgendaCatalogAdmin(db)
      expect(await catalog.update('shareholder', `${prefix}_x`, content)).toBeNull()
      expect(await catalog.setActive('shareholder', `${prefix}_x`, true)).toBeNull()
      const all = await catalog.listAll('shareholder')
      expect(all.length).toBeGreaterThanOrEqual(17)
      expect(all.every((t) => t.usage.assemblies >= 0 && t.usage.activeProposals >= 0)).toBe(true)
    })

    it('conta o uso da pauta em assembleias e propostas ativas', async () => {
      const catalog = createDrizzleAgendaCatalogAdmin(db)
      const repo = createDrizzleAssemblyRepository(db)
      const key = `${prefix}_u`
      await catalog.create('shareholder', key, content)
      const a = await repo.create(
        {
          kind: 'shareholder',
          subjectRef: `c-${prefix}`,
          dedupeKey: `${prefix}:uso`,
          opensAt: now,
          snapshotAt: now,
          closesAt: new Date(now.getTime() + 86_400_000),
          effectAppliesAt: new Date(now.getTime() + 2 * 86_400_000),
          templateKey: key,
          options: content.options,
        },
        now,
      )
      const suffix = randomUUID().slice(0, 8)
      const [user] = await db
        .insert(schema.users)
        .values({
          name: 'p',
          username: `p-${suffix}`,
          email: `p-${suffix}@exemplo.com`,
          passwordHash: 'x',
        })
        .returning({ id: schema.users.id })
      await db.insert(schema.agendaProposals).values({
        kind: 'shareholder',
        subjectRef: `c-${prefix}`,
        templateKey: key,
        proposedBy: user.id,
        expiresAt: new Date(now.getTime() + 86_400_000),
      })

      expect((await catalog.find('shareholder', key))?.usage).toEqual({
        assemblies: 1,
        activeProposals: 1,
      })
      expect((await catalog.listAll('shareholder')).find((t) => t.key === key)?.usage).toEqual({
        assemblies: 1,
        activeProposals: 1,
      })

      await db.delete(schema.agendaProposals).where(eq(schema.agendaProposals.templateKey, key))
      await db.delete(schema.assemblies).where(eq(schema.assemblies.id, a.assembly.id))
      await db.delete(schema.users).where(eq(schema.users.id, user.id))
    })
  })
})
