import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { authEmailTokens } from '../../../../db/schema'
import type { AuthEmailTokenRepository } from '../../application/ports/authEmailTokenRepository'
import type { EmailTokenKind } from '../../domain/emailToken'

export function createDrizzleAuthEmailTokenRepository(db: Database): AuthEmailTokenRepository {
  return {
    async replaceActive(input, now) {
      return db.transaction(async (tx) => {
        await tx
          .update(authEmailTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(authEmailTokens.userId, input.userId),
              eq(authEmailTokens.kind, input.kind),
              isNull(authEmailTokens.usedAt),
            ),
          )
        const [row] = await tx
          .insert(authEmailTokens)
          .values({
            userId: input.userId,
            kind: input.kind,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
            createdAt: now,
          })
          .returning({ id: authEmailTokens.id })
        return { id: row.id }
      })
    },

    async findByHash(tokenHash, kind) {
      const [row] = await db
        .select()
        .from(authEmailTokens)
        .where(and(eq(authEmailTokens.tokenHash, tokenHash), eq(authEmailTokens.kind, kind)))
        .limit(1)
      if (!row) return undefined
      return {
        id: row.id,
        userId: row.userId,
        kind: row.kind as EmailTokenKind,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
      }
    },

    async markUsed(id, now) {
      const rows = await db
        .update(authEmailTokens)
        .set({ usedAt: now })
        .where(and(eq(authEmailTokens.id, id), isNull(authEmailTokens.usedAt)))
        .returning({ id: authEmailTokens.id })
      return rows.length === 1
    },
  }
}
