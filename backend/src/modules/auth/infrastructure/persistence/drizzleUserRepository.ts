import { and, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userIdentities, users } from '../../../../db/schema'
import type {
  IdentityRecord,
  NewIdentityInput,
  NewUserInput,
  UpdateUserInput,
  UserRepository,
} from '../../application/ports/userRepository'
import type { User } from '../../domain/user'

// Traduz a linha do Drizzle (formato do schema físico) pro tipo de domínio —
// hoje os campos são iguais, mas a repository é o único lugar que sabe disso.
function toDomainUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    onboardingCompleted: row.onboardingCompleted,
    avatarPath: row.avatarPath,
    createdAt: row.createdAt,
  }
}

export function createDrizzleUserRepository(db: Database): UserRepository {
  return {
    async findByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
      return row ? toDomainUser(row) : undefined
    },

    async findByUsername(username) {
      const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1)
      return row ? toDomainUser(row) : undefined
    },

    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return row ? toDomainUser(row) : undefined
    },

    async createUser(input: NewUserInput) {
      const [row] = await db
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          username: input.username,
          passwordHash: input.passwordHash,
          role: input.role ?? 'user',
        })
        .returning()
      return toDomainUser(row)
    },

    async updateUser(id: string, input: UpdateUserInput) {
      const [row] = await db.update(users).set(input).where(eq(users.id, id)).returning()
      return toDomainUser(row)
    },

    async findIdentity(providerName, providerAccountId) {
      const [row] = await db
        .select()
        .from(userIdentities)
        .where(
          and(
            eq(userIdentities.providerName, providerName),
            eq(userIdentities.providerAccountId, providerAccountId),
          ),
        )
        .limit(1)
      return row
    },

    async createIdentity(input: NewIdentityInput) {
      const [row] = await db
        .insert(userIdentities)
        .values({
          userId: input.userId,
          providerName: input.providerName,
          providerAccountId: input.providerAccountId,
        })
        .returning()
      return row
    },

    async listIdentitiesForUser(userId: string): Promise<IdentityRecord[]> {
      // Select explícito (não `.select()` cru) — accessToken/refreshToken
      // nunca saem daqui, mesmo por engano futuro num campo adicionado à
      // tabela (GET /me/identities e a exportação de dados exigem isso).
      return db
        .select({
          id: userIdentities.id,
          userId: userIdentities.userId,
          providerName: userIdentities.providerName,
          providerAccountId: userIdentities.providerAccountId,
        })
        .from(userIdentities)
        .where(eq(userIdentities.userId, userId))
    },

    async deleteIdentitiesForUser(userId: string) {
      await db.delete(userIdentities).where(eq(userIdentities.userId, userId))
    },
  }
}
