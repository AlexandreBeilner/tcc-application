import type { AdminUserSummary } from '../../domain/adminUser'
import type { AdminUserDirectory } from '../../application/ports/adminUserDirectory'

export function createFakeAdminUserDirectory(
  seed: AdminUserSummary[] = [],
): AdminUserDirectory & { users: AdminUserSummary[] } {
  const fake = {
    users: seed,
    async list(query: Parameters<AdminUserDirectory['list']>[0]) {
      const text = query.q?.toLowerCase()
      const filtered = fake.users
        .filter(
          (u) =>
            !text ||
            u.id === query.q ||
            [u.name, u.email, u.username].some((v) => v.toLowerCase().includes(text)),
        )
        .filter((u) => !query.role || u.role === query.role)
        .filter((u) => !query.status || u.status === query.status)
        .filter((u) => !query.provider || u.providers.includes(query.provider))
        .filter((u) => !query.createdFrom || u.createdAt >= query.createdFrom)
        .filter((u) => !query.createdTo || u.createdAt <= query.createdTo)
      return {
        users: filtered.slice(query.offset, query.offset + query.limit),
        total: filtered.length,
      }
    },
  }
  return fake
}
