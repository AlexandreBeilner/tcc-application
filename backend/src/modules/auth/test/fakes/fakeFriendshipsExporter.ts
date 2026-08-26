import type {
  ExportedFriendship,
  FriendshipsExporter,
} from '../../application/ports/friendshipsExporter'

export function createFakeFriendshipsExporter(
  byUserId: Record<string, ExportedFriendship[]> = {},
): FriendshipsExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? []
    },
  }
}
