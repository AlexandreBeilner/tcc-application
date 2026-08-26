import type { FriendshipRepository } from '../../application/ports/friendshipRepository'
import type { Friendship } from '../../domain/friendship'

let sequence = 0

export function createFakeFriendshipRepository(seed: Friendship[] = []): FriendshipRepository {
  const rows = [...seed]

  return {
    async findByPair(userAId, userBId) {
      return rows.find(
        (row) =>
          (row.requesterId === userAId && row.addresseeId === userBId) ||
          (row.requesterId === userBId && row.addresseeId === userAId),
      )
    },

    async findById(id) {
      return rows.find((row) => row.id === id)
    },

    async create(requesterId, addresseeId) {
      const row: Friendship = {
        id: `fake-friendship-${(sequence += 1)}`,
        requesterId,
        addresseeId,
        status: 'pending',
        createdAt: new Date(),
        respondedAt: null,
      }
      rows.push(row)
      return row
    },

    async accept(id) {
      const row = rows.find((r) => r.id === id)
      if (!row) {
        throw new Error(`fake: friendship ${id} não encontrada`)
      }
      row.status = 'accepted'
      row.respondedAt = new Date()
      return row
    },

    async remove(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) {
        rows.splice(index, 1)
      }
    },

    async listAccepted(userId) {
      return rows.filter(
        (row) =>
          row.status === 'accepted' && (row.requesterId === userId || row.addresseeId === userId),
      )
    },

    async listReceivedPending(userId) {
      return rows.filter((row) => row.addresseeId === userId && row.status === 'pending')
    },

    async listSentPending(userId) {
      return rows.filter((row) => row.requesterId === userId && row.status === 'pending')
    },
  }
}
