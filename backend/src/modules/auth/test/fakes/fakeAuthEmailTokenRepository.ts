import { randomUUID } from 'node:crypto'
import type {
  AuthEmailTokenRepository,
  NewEmailToken,
} from '../../application/ports/authEmailTokenRepository'
import type { EmailTokenRecord } from '../../domain/emailToken'

export interface FakeAuthEmailTokenRepository extends AuthEmailTokenRepository {
  rows: (EmailTokenRecord & { tokenHash: string })[]
}

export function createFakeAuthEmailTokenRepository(): FakeAuthEmailTokenRepository {
  const rows: FakeAuthEmailTokenRepository['rows'] = []
  return {
    rows,
    async replaceActive(input: NewEmailToken, now) {
      for (const row of rows) {
        if (row.userId === input.userId && row.kind === input.kind && row.usedAt === null) {
          row.usedAt = now
        }
      }
      const id = randomUUID()
      rows.push({
        id,
        userId: input.userId,
        kind: input.kind,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
      })
      return { id }
    },
    async findByHash(tokenHash, kind) {
      const row = rows.find((r) => r.tokenHash === tokenHash && r.kind === kind)
      if (!row) return undefined
      return {
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
      }
    },
    async markUsed(id, now) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.usedAt !== null) return false
      row.usedAt = now
      return true
    },
  }
}
