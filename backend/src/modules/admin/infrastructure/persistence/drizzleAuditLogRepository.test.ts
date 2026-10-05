import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleAuditLogRepository } from './drizzleAuditLogRepository'

// Teste de integração do adapter real: roda só com TEST_DATABASE_URL apontando
// pra um banco DESCARTÁVEL (as migrations são aplicadas nele e o teste grava
// linhas que o trigger append-only impede de apagar). Nunca aponte pro banco
// `gamification` de desenvolvimento.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleAuditLogRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adminA: string
  let adminB: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    const suffix = Date.now().toString(36)
    const [a, b] = await db
      .insert(schema.users)
      .values([
        { name: 'Admin A', email: `a-${suffix}@t.dev`, username: `aa${suffix}`, role: 'admin' },
        { name: 'Admin B', email: `b-${suffix}@t.dev`, username: `bb${suffix}`, role: 'admin' },
      ])
      .returning({ id: schema.users.id })
    adminA = a!.id
    adminB = b!.id
  })

  afterAll(async () => {
    await pool.end()
  })

  it('grava e lista com username do admin, mais recente primeiro, com total e filtros', async () => {
    const repo = createDrizzleAuditLogRepository(db)
    await repo.append({
      adminId: adminA,
      action: 'tick.trigger',
      targetType: 'tick',
      targetId: '7',
      payload: { day: 7 },
      result: 'success',
    })
    await repo.append({
      adminId: adminB,
      action: 'macro_event.trigger',
      targetType: 'macro_event',
      payload: { template_key: 'x' },
      result: 'failed',
      errorMessage: 'template inexistente',
    })

    const all = await repo.list({ adminId: undefined, limit: 10, offset: 0 })
    const mine = all.entries.filter((e) => [adminA, adminB].includes(e.adminId))
    expect(mine.map((e) => e.action)).toEqual(['macro_event.trigger', 'tick.trigger'])
    expect(mine[1]).toMatchObject({ targetId: '7', payload: { day: 7 }, result: 'success' })
    expect(mine[0]).toMatchObject({ errorMessage: 'template inexistente', result: 'failed' })
    expect(mine[0]?.adminUsername).toMatch(/^bb/)

    const onlyA = await repo.list({ adminId: adminA, limit: 10, offset: 0 })
    expect(onlyA.totalEntries).toBe(1)

    const failed = await repo.list({ adminId: adminB, result: 'failed', limit: 10, offset: 0 })
    expect(failed.entries).toHaveLength(1)

    const paged = await repo.list({ adminId: adminA, limit: 1, offset: 1 })
    expect(paged.entries).toHaveLength(0)
    expect(paged.totalEntries).toBe(1)
  })

  it('o trigger recusa UPDATE e DELETE (append-only no banco)', async () => {
    const repo = createDrizzleAuditLogRepository(db)
    await repo.append({
      adminId: adminA,
      action: 'tick.trigger',
      targetType: 'tick',
      payload: {},
      result: 'success',
    })

    await expect(pool.query("UPDATE admin_audit_log SET result = 'failed'")).rejects.toThrow(
      /append-only/,
    )
    await expect(pool.query('DELETE FROM admin_audit_log')).rejects.toThrow(/append-only/)
  })

  it('o CHECK recusa um resultado fora de success/failed', async () => {
    await expect(
      pool.query(
        "INSERT INTO admin_audit_log (admin_id, action, target_type, result) VALUES ($1, 'tick.trigger', 'tick', 'talvez')",
        [adminA],
      ),
    ).rejects.toThrow(/admin_audit_log_result_chk/)
  })
})
