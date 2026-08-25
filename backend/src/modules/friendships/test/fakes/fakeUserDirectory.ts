import type { UserDirectory, UserSummary } from '../../application/ports/userDirectory'

export function createFakeUserDirectory(seed: UserSummary[] = []): UserDirectory {
  const users = [...seed]

  return {
    async findByUsername(username) {
      return users.find((user) => user.username === username)
    },

    async findById(id) {
      return users.find((user) => user.id === id)
    },

    async searchByUsername(query, excludeUserId) {
      return users.filter(
        (user) =>
          user.id !== excludeUserId && user.username.toLowerCase().includes(query.toLowerCase()),
      )
    },
  }
}
