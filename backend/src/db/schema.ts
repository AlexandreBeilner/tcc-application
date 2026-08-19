// Banco "gamification" — usuário, identidade, trilha e mecânicas de
// engajamento. Combina o DER original do TCC (Figura 10) com as extensões
// da spec seção 4. Ver .claude/der-original-tcc.md para as divergências
// assumidas (ex: password_hash nullable para contas só-OAuth).
//
// accounts/positions do motor NÃO aparecem aqui — vivem no banco "market",
// dono é o motor de simulação (Event Sourcing). Este backend só os acessa
// via API, nunca via SQL direto.
import { sql } from 'drizzle-orm'
import {
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'admin'])
export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted', 'declined'])
export const missionStatus = pgEnum('mission_status', ['pending', 'completed'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  // Nullable: contas criadas só via OAuth Google não têm senha local.
  passwordHash: varchar('password_hash', { length: 255 }),
  username: varchar('username', { length: 30 }).notNull().unique(),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    providerName: varchar('provider_name', { length: 50 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  },
  (table) => [
    unique('user_identities_provider_unique').on(table.providerName, table.providerAccountId),
  ],
)

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  requiredPoints: integer('required_points').notNull(),
})

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('user_achievements_unique').on(table.userId, table.achievementId)],
)

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackNumber: integer('track_number').notNull(),
    trackName: varchar('track_name', { length: 60 }).notNull(),
    // Código do currículo (spec 5.1), ex: "0.1", "2.6.3", "3.4".
    code: varchar('code', { length: 10 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    centralConcept: text('central_concept').notNull(),
    unlocksDescription: text('unlocks_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('lessons_code_unique').on(table.code),
    unique('lessons_sort_order_unique').on(table.sortOrder),
  ],
)

export const userLessonProgress = pgTable(
  'user_lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    // Permite retomar a lição no meio (cenário=0, micro-decisão=1, revelação=2, desbloqueio=3).
    currentStep: integer('current_step').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('user_lesson_progress_unique').on(table.userId, table.lessonId)],
)

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id),
    status: friendshipStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [
    unique('friendships_pair_unique').on(table.requesterId, table.addresseeId),
    check('friendships_no_self_chk', sql`${table.requesterId} <> ${table.addresseeId}`),
  ],
)

export const dailyMissions = pgTable('daily_missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description'),
  completionCriteria: text('completion_criteria').notNull(),
  xpReward: integer('xp_reward').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userMissionProgress = pgTable(
  'user_mission_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => dailyMissions.id),
    missionDate: date('mission_date').notNull(),
    status: missionStatus('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    unique('user_mission_progress_unique').on(table.userId, table.missionId, table.missionDate),
  ],
)
