import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { registerShutdownHook } from '../infra/shutdownRegistry'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

export function createDb(databaseUrl: string): Database {
  const pool = new Pool({ connectionString: databaseUrl })
  // O pool emite 'error' quando o servidor derruba uma conexão OCIOSA (reinício do Postgres, failover). Sem
  // ouvinte, o Node trata como exceção não capturada e derruba o backend inteiro; com ele, o pool descarta a
  // conexão e abre outra na próxima consulta.
  pool.on('error', (err) => console.error('pool do Postgres: erro em conexão ociosa', err))
  registerShutdownHook('pool do Postgres', () => pool.end())
  return drizzle(pool, { schema })
}
