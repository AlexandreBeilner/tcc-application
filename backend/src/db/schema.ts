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
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'admin'])
export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted', 'declined'])
export const missionStatus = pgEnum('mission_status', ['pending', 'completed'])
export const achievementCriteriaType = pgEnum('achievement_criteria_type', [
  'net_worth',
  'streak_days',
  'lessons_completed',
  'trades_executed',
  // Critérios de qualidade (backlog engajamento H.1), não só volume — ver
  // `ProgressSnapshot` em `modules/achievements/domain/achievement.ts`.
  'micro_decisions_streak',
  'track_completed_no_errors',
  'lesson_reviewed',
])
// Widget do passo Micro-decisão (spec 5.2, tarefa 7.0.2) — 'reflection' é o
// padrão (checkbox "já pensei"); os outros três embutem um componente já
// existente (tarefa 6.7) em vez do checkbox. Ver `domain/lesson.ts` pro
// vocabulário completo e `frontend/src/pages/Lesson/index.tsx` pro switch.
export const lessonMicroDecisionType = pgEnum('lesson_micro_decision_type', [
  'reflection',
  'growth_calculator',
  'fixed_income_comparison',
  'live_indicator',
  // Indicador macro ao vivo (tarefa M.5) — mesma ideia do `live_indicator`
  // acima, mas a Revelação busca Selic/IPCA via `GET /market/indicators`
  // (M.3) em vez de um ativo específico; por isso não usa
  // `microDecisionAssetTicker`.
  'live_macro_indicator',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  // Nullable: contas criadas só via OAuth Google não têm senha local.
  passwordHash: varchar('password_hash', { length: 255 }),
  username: varchar('username', { length: 30 }).notNull().unique(),
  role: userRole('role').notNull().default('user'),
  // Tela 1.2 (inventário) — controla se o pós-login cai no onboarding ou
  // direto no Portfólio (2.1). Nunca lido de um flag local (localStorage):
  // precisa sobreviver a um segundo dispositivo/navegador (tarefa 6.0.4).
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  // Nome do arquivo salvo em disco (tarefa 6.10.8, upload de foto de
  // perfil) — nunca a URL pronta, ver `shared/avatarUrl.ts`. Nullable: nem
  // todo usuário fez upload.
  avatarPath: varchar('avatar_path', { length: 255 }),
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
  // Substitui `required_points` (int único, nunca consumido por código —
  // confirmado por grep) — não sustentava critérios variados como
  // patrimônio vs. uso contínuo (spec, tela 7.2). Divergência de schema
  // documentada, trocada direto (sem migração em duas etapas) porque a
  // coluna antiga nunca teve consumidor.
  criteriaType: achievementCriteriaType('criteria_type').notNull(),
  criteriaValue: numeric('criteria_value', { precision: 15, scale: 2 }).notNull(),
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
    // Chave de upsert do seed (achado 010, tarefa M.6) — atribuída uma vez
    // por lição e nunca mais tocada, mesmo quando a posição didática muda.
    // `code` deixou de ser a chave de casamento do upsert justamente porque
    // ele *é* mutável (reflete posição atual no currículo, como a
    // renumeração da M.5 exercitou) — usá-lo como chave fazia uma
    // renumeração reaproveitar a linha física errada, arrastando
    // `user_lesson_progress` de quem já tinha progresso pra um conteúdo
    // diferente. Ver `seedLessons.ts` pro upsert real.
    stableKey: varchar('stable_key', { length: 20 }).notNull(),
    // Código do currículo (spec 5.1), ex: "0.1", "2.6.3", "3.4" — só posição
    // didática atual, mutável em renumeração (ex: M.5). Nunca usado como
    // chave de upsert do seed desde a M.6, ver `stableKey` acima.
    code: varchar('code', { length: 10 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    centralConcept: text('central_concept').notNull(),
    // Conteúdo pedagógico real por passo (spec 5.2, tarefa 7.0.2) — antes
    // desta tarefa, `Lesson` (tela 3.2) reaproveitava `centralConcept`
    // idêntico nos 3 primeiros passos (pendência já sinalizada no
    // componente desde a 6.4). `NOT NULL DEFAULT ''`: as 6 lições seedadas
    // ficam com texto vazio até a 7.1.1/7.1.2 sobrescrever com conteúdo
    // real — estado de transição esperado, não regressão.
    scenarioText: text('scenario_text').notNull().default(''),
    microDecisionPrompt: text('micro_decision_prompt').notNull().default(''),
    microDecisionType: lessonMicroDecisionType('micro_decision_type')
      .notNull()
      .default('reflection'),
    // Só usado quando microDecisionType = 'live_indicator' — ticker real do
    // catálogo cujo indicador a Revelação busca ao vivo via
    // `GET /market/assets/:id`, nunca um número estático.
    microDecisionAssetTicker: varchar('micro_decision_asset_ticker', { length: 20 }),
    revelationText: text('revelation_text').notNull().default(''),
    unlocksDescription: text('unlocks_description'),
    // Vocabulário fixo (tarefa 7.0.1): 'portfolio', 'calculator', 'news_feed'
    // ou 'asset:<AssetType>' (espelha 1:1 `catalog.AssetType` do motor).
    // "Chave desbloqueada" = existe lição completada (sortOrder <=
    // completedCount) cujo unlocksKeys contém a chave — ver
    // `domain/lesson.ts#unlockedKeysFor`. Vazio pra lições que só desbloqueiam
    // a próxima lição/trilha via sortOrder (mecanismo já existente da 5.6).
    unlocksKeys: text('unlocks_keys')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Preenchido só nas lições cujo unlocksKeys inclui um `asset:*` — ticker
    // canônico real do catálogo do produto recém-desbloqueado, usado pelo
    // CTA "Comprar agora" do passo Desbloqueio (tarefa 7.0.2, achado 6).
    unlocksAssetTicker: varchar('unlocks_asset_ticker', { length: 20 }),
    // Aposta com acerto/erro real (backlog engajamento B.1) — troca o
    // checkbox genérico "já pensei" por uma escolha real no passo
    // Micro-decisão. Ambas nullable, sem default: lição sem as duas
    // preenchidas continua mostrando o checkbox de hoje (retrocompatível,
    // mesmo padrão incremental da 7.0.2/7.1 — nenhuma das 33 lições ganha
    // conteúdo aqui, isso é a B.4).
    microDecisionOptions: text('micro_decision_options').array(),
    microDecisionCorrectOption: smallint('micro_decision_correct_option'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('lessons_stable_key_unique').on(table.stableKey),
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
    // Revisão voluntária de lição já concluída (backlog engajamento H.2) —
    // distinto de `completedAt` (nunca muda após a primeira conclusão):
    // marca a última vez que o usuário reabriu e re-percorreu uma lição já
    // concluída. Missão "revise uma lição antiga" checa isto contra hoje
    // (UTC) + `completedAt` mais antigo que `REVIEW_ELIGIBLE_AFTER_DAYS`.
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    // Aposta com acerto/erro real (backlog engajamento B.1) — grava o índice
    // escolhido pelo usuário em `lessons.micro_decision_options` (passo
    // Micro-decisão). Nullable: lição sem aposta real (checkbox de hoje) ou
    // ainda não respondida deixam isto `null`. Necessário pra Fase H
    // (conquista/missão de sequência de acertos) poder consultar o
    // histórico depois, não só o momento da escolha.
    microDecisionSelectedOption: smallint('micro_decision_selected_option'),
    // Pergunta que só avança ao acertar (RC.2.3): `microDecisionSelectedOption`
    // passa a ser a PRIMEIRA escolha (imutável), então "acertou de primeira"
    // continua sendo `isCorrectOption` sobre ela. As colunas abaixo guardam o
    // resto: nº de respostas, as alternativas erradas já tentadas (desativadas
    // na UI) e o instante do acerto (libera o avanço do passo 1 pro 2).
    microDecisionAttempts: smallint('micro_decision_attempts').notNull().default(0),
    microDecisionWrongOptions: smallint('micro_decision_wrong_options')
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    microDecisionSolvedAt: timestamp('micro_decision_solved_at', { withTimezone: true }),
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
  // Slug estável (ex: 'feed_read') pra código cliente identificar uma
  // missão específica sem depender de texto (`title`) — o único jeito que
  // frontend/features/news/useReportFeedMission tinha até a tarefa 6.6.4,
  // já que `completionCriteria` é texto idêntico pras missões
  // auto-reportadas ("Reportado pelo cliente — sem verificação cruzada
  // nesta fase") e `title` pode mudar (correção de texto, tradução).
  key: varchar('key', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description'),
  completionCriteria: text('completion_criteria').notNull(),
  xpReward: integer('xp_reward').notNull(),
  // `completionCriteria` é texto livre — não sustenta uma verificação
  // cruzada real em código (mesmo raciocínio de `achievements.required_points`
  // → `criteria_type`/`criteria_value`, tarefa 5.2). Só a missão "complete
  // uma lição" tem esse tratamento nesta fase (tarefa 5.4).
  requiresLessonCompletion: boolean('requires_lesson_completion').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userProgression = pgTable('user_progression', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  // Dia calendário em UTC (tarefa 5.3) — nullable até a primeira atividade
  // qualificada (lição/missão concluída).
  lastQualifyingActivityDate: date('last_qualifying_activity_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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

// Tarefa 6.6.2 — rastreio de "visto" por usuário no Feed de Notícias.
// macro_events vive no banco "market" (dono é o motor de simulação, mesmo
// raciocínio de accounts/positions) — macroEventId é só um uuid solto,
// sem `.references()`, primeiro caso do schema referenciando um id de
// outro banco sem FK real.
export const newsEventReads = pgTable(
  'news_event_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    macroEventId: uuid('macro_event_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('news_event_reads_unique').on(table.userId, table.macroEventId)],
)

// Feed social de aprendizado (backlog engajamento G.1) — nunca carrega
// patrimônio/rentabilidade (RNF09 continua intocada: só o fato "completou a
// trilha X"). `type` é texto livre, não enum, pra caber um tipo de evento
// futuro sem migration nova — só 'track_completed' é emitido por enquanto.
// `trackNumber` nullable pelo mesmo motivo (um tipo futuro pode não ter
// trilha associada).
export const socialFeedEvents = pgTable('social_feed_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  trackNumber: integer('track_number'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
})

// Idempotência/catch-up do salário mensal (tarefa T.5) — uma linha por
// usuário, mesmo padrão de `user_progression` (chave primária = user_id,
// sem histórico linha-a-linha; quem precisa do histórico de crédito em si é
// `market_events` no motor, T.2, que já é append-only). `lastPaidMonth`
// (formato 'YYYY-MM', mês-calendário real — nunca o bloco de 30 dias do
// IPCA) é só o que o job de folha de pagamento precisa pra nunca pagar o
// mesmo mês duas vezes e saber quantos meses recuperar num catch-up.
export const payrollState = pgTable('payroll_state', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  lastPaidMonth: varchar('last_paid_month', { length: 7 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
