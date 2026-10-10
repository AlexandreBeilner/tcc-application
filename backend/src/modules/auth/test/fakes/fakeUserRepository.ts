import { randomUUID } from 'node:crypto'
import type {
  IdentityRecord,
  NewIdentityInput,
  NewUserInput,
  UpdateUserInput,
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
        onboardingCompleted: false,
        avatarPath: null,
        status: 'active',
        suspendedReason: null,
        suspendedAt: null,
        tokenVersion: 0,
        emailVerifiedAt: input.emailVerified ? new Date() : null,
        createdAt: new Date(),
      }
      usersById.set(user.id, user)
      return user
    },

    async updateUser(id: string, input: UpdateUserInput) {
      const current = usersById.get(id)
      if (!current) {
        throw new Error(`fake: usuário ${id} não encontrado`)
      }
      const updated: User = {
        ...current,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.username !== undefined && { username: input.username }),
        ...(input.passwordHash !== undefined && { passwordHash: input.passwordHash }),
        ...(input.onboardingCompleted !== undefined && {
          onboardingCompleted: input.onboardingCompleted,
        }),
        ...(input.avatarPath !== undefined && { avatarPath: input.avatarPath }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.suspendedReason !== undefined && { suspendedReason: input.suspendedReason }),
        ...(input.suspendedAt !== undefined && { suspendedAt: input.suspendedAt }),
        ...(input.emailVerifiedAt !== undefined && { emailVerifiedAt: input.emailVerifiedAt }),
      }
      usersById.set(id, updated)
      return updated
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

    async listIdentitiesForUser(userId: string) {
      return [...identities.values()].filter((identity) => identity.userId === userId)
    },

    async revokeSessions(userId: string) {
      const current = usersById.get(userId)
      if (!current) {
        throw new Error(`fake: usuário ${userId} não encontrado`)
      }
      const updated = { ...current, tokenVersion: current.tokenVersion + 1 }
      usersById.set(userId, updated)
      return updated.tokenVersion
    },

    async deleteIdentitiesForUser(userId: string) {
      for (const [id, identity] of identities) {
        if (identity.userId === userId) {
          identities.delete(id)
        }
      }
    },
  }
}
