import { inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { VoterIdentity } from '../assemblies/inProcessAssemblyAdmin'

// Nome e username de quem votou, para o painel mostrar a pessoa (exceção do admin, MO.6.8).
export function createDrizzleVoterIdentityReader(db: Database) {
  return async (userIds: string[]): Promise<Map<string, VoterIdentity>> => {
    if (userIds.length === 0) return new Map()
    const rows = await db
      .select({ id: users.id, username: users.username, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds))
    return new Map(rows.map((r) => [r.id, { username: r.username, name: r.name }]))
  }
}
