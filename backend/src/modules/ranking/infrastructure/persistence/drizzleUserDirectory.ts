import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { RankingUserRecord, UserDirectory } from '../../application/ports/userDirectory'

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    // Conta suspensa pelo painel (N.16) sai do ranking, mas não perde progresso:
    // reativar traz de volta com o mesmo histórico.
    async listAll(): Promise<RankingUserRecord[]> {
      return db
        .select({ id: users.id, username: users.username, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.status, 'active'))
    },
  }
}
