import type { ProfileUserRecord, UserDirectory } from '../../application/ports/userDirectory'

export function createFakeUserDirectory(seed: ProfileUserRecord[] = []): UserDirectory {
  return {
    async findById(id) {
      return seed.find((user) => user.id === id)
    },
  }
}
