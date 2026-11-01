import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../client'
import * as schema from '../schema'
import { deleteAllUsers } from './deleteAllUsers'

// Integração: só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga todos os usuários e o
// que os referencia, inclusive `admin_audit_log`, que é append-only).
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('deleteAllUsers (banco real)', () => {
  let pool: Pool
  let db: Database

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 2 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, { migrationsFolder: path.join(__dirname, '../migrations') })
    db = drizzleDb as unknown as Database
  })

  afterAll(async () => {
    await pool.end()
  })

  it('apaga usuários presos por FK obrigatória e por tabela append-only, e mantém a linha da migration', async () => {
    const suffix = Date.now().toString(36)
    const [user] = await db
      .insert(schema.users)
      .values({
        name: 'Resíduo',
        username: `residuo_${suffix}`,
        email: `residuo_${suffix}@exemplo.com`,
        passwordHash: 'x',
      })
      .returning({ id: schema.users.id })
    await db
      .insert(schema.userIdentities)
      .values({ userId: user.id, providerName: 'google', providerAccountId: suffix })
    await db
      .insert(schema.adminAuditLog)
      .values({ adminId: user.id, action: 'tick.trigger', targetType: 'engine', result: 'success' })
    await db
      .update(schema.dailySettings)
      .set({ updatedBy: user.id })
      .where(eq(schema.dailySettings.id, 1))

    await deleteAllUsers(db)

    expect(await db.select().from(schema.users)).toHaveLength(0)
    expect(await db.select().from(schema.userIdentities)).toHaveLength(0)
    expect(await db.select().from(schema.adminAuditLog)).toHaveLength(0)
    const settings = await db.select().from(schema.dailySettings)
    expect(settings).toHaveLength(1)
    expect(settings[0].updatedBy).toBeNull()
  })

  it('não falha num banco sem usuários', async () => {
    await deleteAllUsers(db)
    expect(await db.select().from(schema.users)).toHaveLength(0)
  })
})
