import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleAnnouncementRepository } from './drizzleAnnouncementRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations). Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleAnnouncementRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adminId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    const suffix = Date.now().toString(36)
    const [admin] = await db
      .insert(schema.users)
      .values({
        name: 'Admin',
        email: `ann-${suffix}@t.dev`,
        username: `ann${suffix}`,
        role: 'admin',
      })
      .returning({ id: schema.users.id })
    adminId = admin!.id
  })

  afterAll(async () => {
    await db.delete(schema.announcements)
    await pool.end()
  })

  const base = { title: 'Aviso', body: 'Texto', severity: 'info' as const, dismissible: true }

  it('lista só o que está no ar na janela, fim exclusivo', async () => {
    const repository = createDrizzleAnnouncementRepository(db)
    const now = new Date('2026-10-06T12:00:00Z')
    const hour = 3_600_000
    const live = await repository.create({
      ...base,
      title: 'no ar',
      kind: 'notice',
      createdBy: adminId,
      startsAt: new Date(now.getTime() - hour),
      endsAt: new Date(now.getTime() + hour),
    })
    const open = await repository.create({
      ...base,
      title: 'sem fim',
      kind: 'notice',
      createdBy: adminId,
      startsAt: new Date(now.getTime() - hour),
      endsAt: null,
    })
    await repository.create({
      ...base,
      title: 'agendado',
      kind: 'notice',
      createdBy: adminId,
      startsAt: new Date(now.getTime() + hour),
      endsAt: null,
    })
    await repository.create({
      ...base,
      title: 'acabou no instante',
      kind: 'notice',
      createdBy: adminId,
      startsAt: new Date(now.getTime() - hour),
      endsAt: now,
    })

    const ids = (await repository.listActive(now)).map((a) => a.id)
    expect(ids).toContain(live.id)
    expect(ids).toContain(open.id)
    expect(ids).toHaveLength(2)
  })

  it('encerra, edita e remove', async () => {
    const repository = createDrizzleAnnouncementRepository(db)
    const now = new Date('2026-10-06T12:00:00Z')
    const created = await repository.create({
      ...base,
      kind: 'maintenance',
      linkedHaltId: null,
      createdBy: adminId,
      startsAt: new Date(now.getTime() - 1000),
      endsAt: null,
    })
    expect((await repository.findOpenMaintenance(now))?.id).toBe(created.id)

    const edited = await repository.update(created.id, {
      ...base,
      title: 'novo título',
      startsAt: created.startsAt,
      endsAt: null,
    })
    expect(edited?.title).toBe('novo título')

    await repository.setEnd(created.id, now)
    expect(await repository.findOpenMaintenance(now)).toBeNull()

    await repository.remove(created.id)
    expect(await repository.findById(created.id)).toBeNull()
  })
})
