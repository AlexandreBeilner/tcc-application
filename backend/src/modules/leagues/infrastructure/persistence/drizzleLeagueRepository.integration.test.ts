import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleLeagueRepository } from './drizzleLeagueRepository'

// Integração (MO.5.2a): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// `league_members`, `leagues` e `users`). Prova o teto sob concorrência e as constraints reais.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositório de ligas (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]
  const now = new Date('2026-10-10T12:00:00Z')

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.leagueMembers)
    await db.delete(schema.leagues)
    await db.delete(schema.userCosmetics)
    await db.delete(schema.subscriptions)
    await db.delete(schema.emailOutbox)
    await db.delete(schema.emailPreferences)
    await db.delete(schema.users)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'beto', 'caio'].map((u) => ({
          name: u,
          username: u,
          email: `${u}@exemplo.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    ids = rows.map((r) => r.id)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('cria a liga com o dono como membro ativo e respeita o teto de abertas', async () => {
    const repo = createDrizzleLeagueRepository(db)
    const input = { ownerId: ids[0], name: 'Liga', window: 'week' as const, now }
    for (let i = 0; i < 3; i++) expect(await repo.createIfUnderLimit(input, 3)).not.toBeNull()
    expect(await repo.createIfUnderLimit(input, 3)).toBeNull()

    const mine = await repo.listForUser(ids[0])
    expect(mine).toHaveLength(3)
    expect(mine[0].membership.status).toBe('active')
  })

  it('encerrar libera a vaga e a liga some da listagem, sem apagar nada', async () => {
    const repo = createDrizzleLeagueRepository(db)
    const input = { ownerId: ids[0], name: 'Liga', window: 'month' as const, now }
    const league = (await repo.createIfUnderLimit(input, 1))!
    expect(await repo.createIfUnderLimit(input, 1)).toBeNull()

    await repo.close(league.id, now)

    expect(await repo.listForUser(ids[0])).toHaveLength(0)
    expect((await repo.findById(league.id))?.closedAt).toEqual(now)
    expect(await repo.createIfUnderLimit(input, 1)).not.toBeNull()
  })

  it('criações simultâneas do mesmo dono não furam o teto', async () => {
    const repo = createDrizzleLeagueRepository(db)
    const input = { ownerId: ids[0], name: 'Liga', window: 'week' as const, now }
    const results = await Promise.all(
      Array.from({ length: 6 }, () => repo.createIfUnderLimit(input, 3)),
    )
    expect(results.filter((r) => r !== null)).toHaveLength(3)
  })

  it('convites simultâneos não passam do teto de pessoas', async () => {
    const repo = createDrizzleLeagueRepository(db)
    const league = (await repo.createIfUnderLimit(
      { ownerId: ids[0], name: 'Liga', window: 'week', now },
      3,
    ))!
    const results = await Promise.all(
      [ids[1], ids[2]].map((userId) =>
        repo.addMemberIfRoom(
          { leagueId: league.id, userId, status: 'invited', invitedBy: ids[0], now },
          2,
        ),
      ),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await repo.listMembers(league.id)).toHaveLength(2)
  })

  it('convite vira membro ativo; remover tira só a pessoa', async () => {
    const repo = createDrizzleLeagueRepository(db)
    const league = (await repo.createIfUnderLimit(
      { ownerId: ids[0], name: 'Liga', window: 'week', now },
      3,
    ))!
    await repo.addMemberIfRoom(
      { leagueId: league.id, userId: ids[1], status: 'invited', invitedBy: ids[0], now },
      20,
    )
    expect((await repo.findMember(league.id, ids[1]))?.status).toBe('invited')

    await repo.activateMember(league.id, ids[1], now)
    const member = await repo.findMember(league.id, ids[1])
    expect(member?.status).toBe('active')
    expect(member?.joinedAt).toEqual(now)

    await repo.removeMember(league.id, ids[1])
    expect(await repo.findMember(league.id, ids[1])).toBeNull()
    expect(await repo.findMember(league.id, ids[0])).not.toBeNull()
  })

  it('rejeita janela inválida e membro duplicado (constraints)', async () => {
    const repo = createDrizzleLeagueRepository(db)
    await expect(
      db.insert(schema.leagues).values({ ownerId: ids[0], name: 'x', windowKind: 'year' }),
    ).rejects.toThrow()
    const league = (await repo.createIfUnderLimit(
      { ownerId: ids[0], name: 'Liga', window: 'week', now },
      3,
    ))!
    await expect(
      repo.addMemberIfRoom(
        { leagueId: league.id, userId: ids[0], status: 'active', invitedBy: ids[0], now },
        20,
      ),
    ).rejects.toThrow()
  })
})
