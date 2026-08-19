import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

export function createDb(databaseUrl: string): Database {
  const pool = new Pool({ connectionString: databaseUrl })
  return drizzle(pool, { schema })
}
