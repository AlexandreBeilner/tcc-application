import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { RankingUserRecord, UserDirectory } from '../../application/ports/userDirectory'

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async listAll(): Promise<RankingUserRecord[]> {
      return db.select({ id: users.id, createdAt: users.createdAt }).from(users)
    },
  }
}
