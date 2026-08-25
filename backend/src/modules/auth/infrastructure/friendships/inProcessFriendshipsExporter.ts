import type { ExportFriendshipsUseCase } from '../../../friendships/application/useCases/exportFriendships'
import type { FriendshipsExporter } from '../../application/ports/friendshipsExporter'

export function createInProcessFriendshipsExporter(
  exportFriendships: ExportFriendshipsUseCase,
): FriendshipsExporter {
  return {
    async exportForUser(userId) {
      return exportFriendships.execute({ userId })
    },
  }
}
