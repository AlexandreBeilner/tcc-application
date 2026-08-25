import { and, eq, or } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { friendships } from '../../../../db/schema'
import type { FriendshipRepository } from '../../application/ports/friendshipRepository'
import type { Friendship } from '../../domain/friendship'

function toFriendship(row: typeof friendships.$inferSelect): Friendship {
  return {
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  }
}

export function createDrizzleFriendshipRepository(db: Database): FriendshipRepository {
  return {
    async findByPair(userAId, userBId) {
      const [row] = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, userAId), eq(friendships.addresseeId, userBId)),
            and(eq(friendships.requesterId, userBId), eq(friendships.addresseeId, userAId)),
          ),
        )
        .limit(1)
      return row ? toFriendship(row) : undefined
    },

    async findById(id) {
      const [row] = await db.select().from(friendships).where(eq(friendships.id, id)).limit(1)
      return row ? toFriendship(row) : undefined
    },

    async create(requesterId, addresseeId) {
      const [row] = await db.insert(friendships).values({ requesterId, addresseeId }).returning()
      return toFriendship(row)
    },

    async accept(id) {
      const [row] = await db
        .update(friendships)
        .set({ status: 'accepted', respondedAt: new Date() })
        .where(eq(friendships.id, id))
        .returning()
      return toFriendship(row)
    },

    async remove(id) {
      await db.delete(friendships).where(eq(friendships.id, id))
    },

    async listAccepted(userId) {
      const rows = await db
        .select()
        .from(friendships)
        .where(
          and(
            eq(friendships.status, 'accepted'),
            or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
          ),
        )
      return rows.map(toFriendship)
    },

    async listReceivedPending(userId) {
      const rows = await db
        .select()
        .from(friendships)
        .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, 'pending')))
      return rows.map(toFriendship)
    },

    async listSentPending(userId) {
      const rows = await db
        .select()
        .from(friendships)
        .where(and(eq(friendships.requesterId, userId), eq(friendships.status, 'pending')))
      return rows.map(toFriendship)
    },
  }
}
