import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// Aplica as migrations do banco "gamification" automaticamente na subida do
// backend — sempre em container, sem passo manual separado (CLAUDE.md).
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') })

  await pool.end()
}
