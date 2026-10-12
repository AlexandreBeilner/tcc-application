import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { registerShutdownHook } from '../infra/shutdownRegistry'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

export function createDb(databaseUrl: string): Database {
  const pool = new Pool({ connectionString: databaseUrl })
  registerShutdownHook('pool do Postgres', () => pool.end())
  return drizzle(pool, { schema })
}
