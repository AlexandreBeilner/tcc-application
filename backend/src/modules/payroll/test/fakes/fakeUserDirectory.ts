import type { UserDirectory } from '../../application/ports/userDirectory'

export function createFakeUserDirectory(userIds: string[]): UserDirectory {
  return {
    async listAllUserIds() {
      return userIds
    },
  }
}
