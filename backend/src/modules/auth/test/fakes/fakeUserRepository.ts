import { randomUUID } from 'node:crypto'
import type {
  IdentityRecord,
  NewIdentityInput,
  NewUserInput,
  UserRepository,
} from '../../application/ports/userRepository'
import type { User } from '../../domain/user'

export function createFakeUserRepository(): UserRepository {
  const usersById = new Map<string, User>()
  const identities = new Map<string, IdentityRecord>()

  return {
    async findByEmail(email) {
      return [...usersById.values()].find((user) => user.email === email)
    },

    async findByUsername(username) {
      return [...usersById.values()].find((user) => user.username === username)
    },

    async findById(id) {
      return usersById.get(id)
    },

    async createUser(input: NewUserInput) {
      const user: User = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role ?? 'user',
        createdAt: new Date(),
      }
      usersById.set(user.id, user)
      return user
    },

    async findIdentity(providerName, providerAccountId) {
      return [...identities.values()].find(
        (identity) =>
          identity.providerName === providerName &&
          identity.providerAccountId === providerAccountId,
      )
    },

    async createIdentity(input: NewIdentityInput) {
      const identity: IdentityRecord = { id: randomUUID(), ...input }
      identities.set(identity.id, identity)
      return identity
    },
  }
}
