import { and, asc, eq, gt, isNotNull, not, sql, type SQL } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { emailPreferences, userProgression, users } from '../../../../db/schema'

// Base compartilhada das audiências dos e-mails de engajamento (EM.7.x): conta ativa, com e-mail
// verificado, não anonimizada e com a categoria `engagement` ligada, lida em páginas por `id`
// (cursor). É só uma pré-seleção barata: `EnqueueEmailUseCase` confere tudo de novo ao enfileirar.
// Lê `users`, `email_preferences` e `user_progression` direto (mesmo precedente do
// `RecipientDirectory`): a audiência é uma consulta em lote que os casos de uso dos outros
// módulos, pensados para um usuário por vez, não oferecem.
export async function selectEngagementAudience(
  db: Database,
  options: { afterUserId: string | null; limit: number; extra?: SQL },
) {
  return db
    .select({
      userId: users.id,
      address: users.email,
      name: users.name,
      level: sql<number>`COALESCE(${userProgression.level}, 1)`.mapWith(Number),
      currentStreak: sql<number>`COALESCE(${userProgression.currentStreak}, 0)`.mapWith(Number),
      lastActivityDate: userProgression.lastQualifyingActivityDate,
    })
    .from(users)
    .innerJoin(emailPreferences, eq(emailPreferences.userId, users.id))
    .leftJoin(userProgression, eq(userProgression.userId, users.id))
    .where(
      and(
        eq(emailPreferences.engagement, true),
        eq(users.status, 'active'),
        isNotNull(users.emailVerifiedAt),
        not(sql`${users.email} LIKE '%.invalid'`),
        options.afterUserId ? gt(users.id, options.afterUserId) : undefined,
        options.extra,
      ),
    )
    .orderBy(asc(users.id))
    .limit(options.limit)
}
