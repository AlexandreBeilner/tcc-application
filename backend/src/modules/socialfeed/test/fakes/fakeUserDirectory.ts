import type { UserDirectory, UserSummary } from '../../application/ports/userDirectory'

export function createFakeUserDirectory(users: UserSummary[] = []): UserDirectory {
  return {
    async findByIds(ids) {
      return users.filter((user) => ids.includes(user.id))
    },
  }
}
