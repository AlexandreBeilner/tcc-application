import type { RankingUserRecord, UserDirectory } from '../../application/ports/userDirectory'

export function createFakeUserDirectory(users: RankingUserRecord[] = []): UserDirectory {
  return {
    async listAll() {
      return users
    },
  }
}
