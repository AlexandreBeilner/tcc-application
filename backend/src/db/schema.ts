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
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
  // Participação em assembleias (MO.6.7): quantas assembleias distintas a pessoa votou.
  'assemblies_participated',
  // Indicações que viraram válidas (MO.7.2): a pessoa indicada concluiu a primeira lição.
  'referrals_qualified',
])
// Widget do passo Micro-decisão (spec 5.2, tarefa 7.0.2) — 'reflection' é o
// padrão (sem widget embutido); os outros três embutem um componente já
// existente (tarefa 6.7) junto da pergunta. Ver `domain/lesson.ts` pro
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

export const users = pgTable(
  'users',
  {
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
    // Suspensão pelo painel admin (N.16): reversível, nunca apaga progresso.
    // Texto + CHECK em vez de enum do Postgres, como o `result` do log de
    // auditoria: um terceiro estado futuro não exige migration de tipo.
    status: text('status').notNull().default('active'),
    suspendedReason: text('suspended_reason'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    // Incrementado por "forçar logout" (N.16): o token carrega a versão com que
    // foi emitido e o `authMiddleware` recusa token de versão antiga.
    tokenVersion: integer('token_version').notNull().default(0),
    // Quando o dono provou controlar a caixa de e-mail (EM.3.1): link de verificação, reset de
    // senha concluído, e-mail confirmado pelo Google ou seed do admin. `null` = não verificado.
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('users_status_chk', sql`${table.status} IN ('active', 'suspended')`)],
)

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
  // Catálogo operável pelo painel (N.19). Conquista desativada para de ser
  // concedida e some da lista de quem ainda não a tem; quem já ganhou não perde.
  isActive: boolean('is_active').notNull().default(true),
  // Chave estável do seed (N.19): `db:seed:achievements` casa por ela, não pelo
  // nome, que o painel agora pode editar (casar por nome criaria duplicata a cada
  // seed depois de um renomear). Nula nas conquistas criadas pelo painel.
  seedKey: varchar('seed_key', { length: 50 }).unique(),
  // Conquista rara de verdade (ponto 044, decisão 2026-10-11): marcada no catálogo pelo painel,
  // independente do tamanho da base. É o que dispara o e-mail de conquista rara.
  isRare: boolean('is_rare').notNull().default(false),
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
    stableKey: varchar('stable_key', { length: 64 }).notNull(),
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
    // Publicação (N.18): lição despublicada sai da trilha e da conta de
    // progressão de todos (`buildProgression` só recebe as publicadas), sem
    // apagar o progresso de ninguém.
    published: boolean('published').notNull().default(true),
    // Conteúdo visual por fase (RC.3.1): `{ schemaVersion, phases: { scenario,
    // microDecision, revelation } }` de blocos tipados (texto, widgets).
    // Nulo é o estado normal e faz o player usar `scenarioText`/
    // `microDecisionPrompt`/`revelationText`; o contrato (Zod) vive em
    // `modules/lessons/domain/widgets/lessonBlocks.ts`.
    blocks: jsonb('blocks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('lessons_stable_key_unique').on(table.stableKey),
    unique('lessons_code_unique').on(table.code),
    unique('lessons_sort_order_unique').on(table.sortOrder),
  ],
)

// Histórico de revisões do conteúdo de uma lição (N.23), append-only: o banco
// virou a fonte da verdade do conteúdo, então este é o histórico que o git
// dava. Cada linha é um retrato completo do conteúdo editável (`snapshot`).
// `action`: 'baseline' (estado anterior à primeira edição de uma lição vinda
// do seed), 'create', 'update' ou 'restore'. `admin_id` é nulo só no baseline.
export const lessonRevisions = pgTable(
  'lesson_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    adminId: uuid('admin_id').references(() => users.id),
    action: varchar('action', { length: 20 }).notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'lesson_revisions_action_chk',
      sql`${table.action} IN ('baseline', 'create', 'update', 'restore')`,
    ),
    index('lesson_revisions_lesson_id_idx').on(table.lessonId, table.createdAt),
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
    // Dispensa (N.24): lição criada no meio do currículo depois que o usuário
    // já tinha passado daquele ponto. Não é conclusão (`completedAt` segue
    // nulo, sem XP), mas conta como "satisfeita" na progressão, então não
    // bloqueia a sequência nem cancela as chaves de produto da lição. Se o
    // usuário fizer a lição depois, `completedAt` é preenchido e `waivedAt`
    // permanece como registro de origem.
    waivedAt: timestamp('waived_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('user_lesson_progress_unique').on(table.userId, table.lessonId)],
)

// Cartão mais avançado que o usuário já alcançou no player de uma lição (LJ.5.1): fase (0 a 3) e
// posição na fase. Só serve pra contar cada pessoa uma vez por cartão em `lesson_card_reach`. Fica
// fora de `user_lesson_progress` de propósito: abrir uma lição não cria progresso (o "iniciaram" do
// funil por lição e o status do mapa dependem dessa linha).
export const userLessonCardProgress = pgTable(
  'user_lesson_card_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    furthestPhase: smallint('furthest_phase').notNull(),
    furthestCard: smallint('furthest_card').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.lessonId] })],
)

// Funil por cartão (LJ.5.1): quantas pessoas chegaram a cada cartão de uma lição, por dia. Só
// contagem agregada, sem usuário. O índice do cartão é o do player no momento da leitura (a lição
// reeditada muda o sentido dos índices, então a tela admin lê uma janela de dias, não o histórico).
export const lessonCardReach = pgTable(
  'lesson_card_reach',
  {
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    phase: smallint('phase').notNull(),
    cardIndex: smallint('card_index').notNull(),
    day: date('day').notNull(),
    reachedCount: integer('reached_count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.lessonId, table.phase, table.cardIndex, table.day] }),
    check('lesson_card_reach_phase_chk', sql`${table.phase} BETWEEN 0 AND 3`),
    check('lesson_card_reach_card_chk', sql`${table.cardIndex} >= 0`),
  ],
)

// Enquete da comunidade (LJ.2.6): um voto por pessoa e enquete. Sem resposta certa e sem gabarito; a
// leitura devolve só a distribuição agregada, e só com votos suficientes (LJ-D5). `pollId` é o id do
// bloco `poll` dentro do conteúdo da lição.
export const lessonPollVotes = pgTable(
  'lesson_poll_votes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    pollId: text('poll_id').notNull(),
    option: smallint('option').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.lessonId, table.pollId] }),
    index('lesson_poll_votes_poll_idx').on(table.lessonId, table.pollId),
    check('lesson_poll_votes_option_chk', sql`${table.option} BETWEEN 0 AND 3`),
  ],
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
  // Catálogo operável pelo painel (N.19): missão desativada deixa de ser gerada
  // pro dia e de poder ser concluída; o que já foi concluído fica como está.
  isActive: boolean('is_active').notNull().default(true),
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
  // Dados extras de um tipo de evento (ex: o resultado de um duelo, MO.5.3). Nulo em
  // `track_completed`. Nunca carrega valor financeiro absoluto (RNF09).
  data: jsonb('data'),
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

// Resposta às perguntas intermediárias (`check`, RC.3.2) de uma lição: uma
// linha por (usuário, lição, checkpoint). `wrong_options` guarda as
// alternativas erradas já tentadas (a UI as desativa); numérica só conta
// tentativas. "Acertou de primeira" = resolvida com `attempts = 1`.
export const userLessonCheckpoints = pgTable(
  'user_lesson_checkpoints',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    checkpointId: varchar('checkpoint_id', { length: 64 }).notNull(),
    attempts: smallint('attempts').notNull().default(0),
    wrongOptions: smallint('wrong_options')
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    solvedAt: timestamp('solved_at', { withTimezone: true }),
    // Resposta dos formatos que não são por índice (LJ.2.1); hoje só a estimativa:
    // `{ kind: 'estimate', value, hit }` ou `{ kind: 'order', sequence }` ou `{ kind: 'categorize', groups }`. Nulo em `single`/`true_false`.
    lastResponse: jsonb('last_response').$type<
      | { kind: 'estimate'; value: number; hit: boolean }
      | { kind: 'order'; sequence: number[] }
      | { kind: 'categorize'; groups: number[] }
      | { kind: 'match'; pairs: [number, number][]; misses: number }
    >(),
    // Revisão espaçada (LJ.5.6): quantas revisões já passou (0 a 3) e quando volta (nulo = fora da fila).
    reviewStage: smallint('review_stage').notNull().default(0),
    reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.lessonId, table.checkpointId] })],
)

// Log de auditoria das ações administrativas (Fase N, tarefa N.4). Append-only
// também no banco: a migration 0018 cria um trigger que recusa UPDATE e DELETE
// (mesmo padrão de `market_events` no motor). `action` é texto (a lista
// fechada vive em `modules/admin/domain/auditEntry.ts`) pra uma ação nova não
// pedir migration. `targetId` é texto porque o alvo nem sempre é um uuid (o
// dia do tick, por exemplo). Sem backfill: ações anteriores à tarefa não
// existem aqui.
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    result: text('result').notNull(),
    errorMessage: text('error_message'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('admin_audit_log_result_chk', sql`${table.result} IN ('success', 'failed')`),
    index('admin_audit_log_occurred_at_idx').on(table.occurredAt),
    index('admin_audit_log_admin_id_idx').on(table.adminId),
    index('admin_audit_log_action_idx').on(table.action),
  ],
)

// Comunicados globais e modo de manutenção (Fase N, tarefa N.20). Faixa no topo do
// app do usuário dentro da janela [starts_at, ends_at); `ends_at` nulo = até alguém
// encerrar. `kind = 'maintenance'` é o aviso criado pelo modo de manutenção (crítico,
// não dispensável); `linked_halt_id` guarda a pausa global aberta junto, pra
// encerrar a manutenção levantá-la. Sem backfill: tabela nova.
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 80 }).notNull(),
    body: varchar('body', { length: 280 }).notNull(),
    severity: text('severity').notNull(),
    kind: text('kind').notNull().default('notice'),
    dismissible: boolean('dismissible').notNull().default(true),
    // Aviso também por e-mail (EM.5.2): só a quem tem e-mail verificado, e só para crítico.
    notifyByEmail: boolean('notify_by_email').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    linkedHaltId: uuid('linked_halt_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('announcements_severity_chk', sql`${table.severity} IN ('info', 'warning', 'critical')`),
    check('announcements_kind_chk', sql`${table.kind} IN ('notice', 'maintenance')`),
    check(
      'announcements_window_chk',
      sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`,
    ),
    index('announcements_window_idx').on(table.startsAt, table.endsAt),
  ],
)

// Snapshot do ranking, calculado por um job a cada poucas horas (o ranking não é em tempo
// real: a tela lê esta tabela, nunca recalcula o patrimônio de todo mundo a cada abertura).
// Uma rodada (`run_id`) grava todos os grupos (critério x janela) de uma vez, numa transação,
// então a leitura nunca vê uma rodada pela metade. `window_kind` é 'none' no critério de
// nível, que não usa janela. Nome e nível são copiados pra a rodada ficar consistente no
// instante do cálculo. O histórico fica por alguns dias e some na limpeza do job.
export const rankingSnapshots = pgTable(
  'ranking_snapshots',
  {
    runId: uuid('run_id').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    windowKind: text('window_kind').notNull(),
    criterion: text('criterion').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    username: text('username').notNull(),
    level: integer('level').notNull(),
    xp: integer('xp').notNull(),
    profitabilityPct: doublePrecision('profitability_pct'),
    sortKey: doublePrecision('sort_key').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.windowKind, table.criterion, table.userId] }),
    check('ranking_snapshots_window_chk', sql`${table.windowKind} IN ('week', 'month', 'none')`),
    index('ranking_snapshots_computed_at_idx').on(table.computedAt),
  ],
)

// Amostras do patrimônio de cada usuário (renda fixa pelo valor de hoje) tiradas pelo job do
// ranking logo depois do começo de cada janela (segunda 00:00 UTC e dia 1 do mês). O motor não
// sabe avaliar a renda fixa numa data passada, então o começo da janela vem daqui: a amostra mais
// antiga dentro de uma pequena tolerância depois do começo. Só as rodadas perto de um começo de
// janela gravam amostras, por isso a tabela cresce devagar. `snapshot` é o `Snapshot` do ranking.
export const rankingValuationSamples = pgTable(
  'ranking_valuation_samples',
  {
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.computedAt, table.userId] }),
    index('ranking_valuation_samples_user_idx').on(table.userId),
  ],
)

// Fila de e-mails a enviar (EM.1.1, `.claude/plano-gateway-email.md` 4.3). Quem precisa de um
// e-mail só grava uma linha aqui (na mesma transação da escrita de negócio, quando houver); um
// worker entrega depois, com retry e backoff. `idempotency_key` única impede enviar duas vezes o
// mesmo fato. `claimed_at` marca quando o worker pegou a linha: uma `sending` velha é de um
// processo que caiu e volta pra `pending`. `payload` guarda só o que o template precisa e é
// limpo junto do endereço depois da retenção (EM.8.1). Texto + CHECK em vez de enum, como
// `users.status`: um estado novo não exige migration de tipo.
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    toAddress: varchar('to_address', { length: 320 }).notNull(),
    templateKey: varchar('template_key', { length: 60 }).notNull(),
    category: text('category').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull().unique(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    providerMessageId: varchar('provider_message_id', { length: 200 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // Confirmação de entrega que o webhook do provedor traz (EM.1.4); `sent` só diz que o
    // provedor aceitou a mensagem.
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'email_outbox_status_chk',
      sql`${table.status} IN ('pending', 'sending', 'sent', 'failed', 'suppressed')`,
    ),
    check(
      'email_outbox_category_chk',
      sql`${table.category} IN ('security', 'transactional', 'social', 'engagement')`,
    ),
    index('email_outbox_pending_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} = 'pending'`),
    index('email_outbox_user_idx').on(table.userId),
  ],
)

// Endereços que não devem receber e-mail (EM.1.4): bounce permanente, reclamação de spam e
// descadastro total. A chave é o endereço normalizado em minúsculo, não o usuário: o bounce vale
// pro endereço mesmo se a conta mudar. Consultada em todo enfileiramento e de novo na entrega.
export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    address: varchar('address', { length: 320 }).primaryKey(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'email_suppressions_reason_chk',
      sql`${table.reason} IN ('bounce', 'complaint', 'unsubscribe_all')`,
    ),
  ],
)

// Preferências de e-mail por categoria opcional (EM.6.1). Sem linha = tudo desligado (D8): a linha
// só nasce quando a pessoa liga ou desliga algo (onboarding, Configurações ou link de cancelar).
// Segurança e transacional não têm coluna: nunca são desligáveis.
export const emailPreferences = pgTable('email_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  social: boolean('social').notNull().default(false),
  engagement: boolean('engagement').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Tokens de uso único enviados por e-mail (EM.2.1): hoje só `password_reset`, a verificação de
// e-mail entra na EM.3.1. Só o hash SHA-256 do token é gravado; o token em claro existe apenas no
// link do e-mail. `used_at` marca o consumo (ou a invalidação por um pedido mais novo).
export const authEmailTokens = pgTable(
  'auth_email_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'auth_email_tokens_kind_chk',
      sql`${table.kind} IN ('password_reset', 'email_verification')`,
    ),
    index('auth_email_tokens_user_kind_idx').on(table.userId, table.kind),
  ],
)

// Projeção local do direito ao PRO (MO.2.1), uma linha por usuário. A verdade é o RevenueCat:
// esta tabela só guarda o que a última consulta devolveu (fatos, não um "status" gravado, porque
// ativo/vencido depende da hora de agora). Sem linha = nunca assinou. Nunca guarda dado de cartão.
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    store: text('store').notNull(),
    productId: varchar('product_id', { length: 200 }).notNull(),
    period: text('period').notNull().default('unknown'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }),
    // Nulo = sem vencimento (concessão promocional vitalícia).
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    graceExpiresAt: timestamp('grace_expires_at', { withTimezone: true }),
    billingIssueDetectedAt: timestamp('billing_issue_detected_at', { withTimezone: true }),
    unsubscribeDetectedAt: timestamp('unsubscribe_detected_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    isSandbox: boolean('is_sandbox').notNull().default(false),
    managementUrl: text('management_url'),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'subscriptions_store_chk',
      sql`${table.store} IN ('app_store', 'play_store', 'stripe', 'rc_billing', 'promotional', 'other')`,
    ),
    check('subscriptions_period_chk', sql`${table.period} IN ('monthly', 'annual', 'unknown')`),
  ],
)

// Eventos do webhook do RevenueCat já tratados (MO.2.1). A chave é o id do próprio evento, não um
// id nosso. O efeito do webhook é reconsultar o estado e regravar a projeção (convergente), então
// isto é auditoria e atalho contra reprocessar repetição, não o que garante a correção.
export const billingWebhookEvents = pgTable('billing_webhook_events', {
  id: varchar('id', { length: 200 }).primaryKey(),
  eventType: varchar('event_type', { length: 60 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

// Catálogo de cosméticos do PRO (MO.5.1): moldura de avatar e título. Tabela própria, nunca o
// catálogo de conquistas (`achievements`): emblema de conquista real continua grátis. A chave é
// estável e legível (o frontend mapeia a moldura pelo visual, o texto vem daqui). Os itens são
// dado, inseridos na própria migração.
export const cosmeticItems = pgTable(
  'cosmetic_items',
  {
    key: varchar('key', { length: 40 }).primaryKey(),
    kind: text('kind').notNull(),
    name: varchar('name', { length: 60 }).notNull(),
    description: varchar('description', { length: 200 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    // Título liberado por indicações (MO.7.2): só quem tem pelo menos N indicações válidas equipa.
    // Nulo = livre pra todo PRO (o catálogo da MO.5.1).
    unlockReferrals: integer('unlock_referrals'),
  },
  (table) => [check('cosmetic_items_kind_chk', sql`${table.kind} IN ('frame', 'title')`)],
)

// O que cada pessoa equipou: no máximo um item por tipo. Cancelar o PRO não apaga estas linhas
// (arquivar, nunca apagar): a leitura pública só mostra o item de quem é PRO agora, então
// reativar restaura o visual sem escrever nada.
export const userCosmetics = pgTable(
  'user_cosmetics',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    itemKey: varchar('item_key', { length: 40 })
      .notNull()
      .references(() => cosmeticItems.key),
    equippedAt: timestamp('equipped_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind] }),
    check('user_cosmetics_kind_chk', sql`${table.kind} IN ('frame', 'title')`),
  ],
)

// Ligas privadas do PRO (MO.5.2). Só quem é PRO cria (até 3 abertas por pessoa); qualquer amigo
// convidado entra sem plano. A pontuação não é coluna: é sempre a rentabilidade percentual da
// janela do ranking (`window_kind`), nunca patrimônio absoluto (RNF09). "Arquivada" quando o
// dono cancela o PRO não é estado gravado, é derivado do plano do dono a cada leitura (volta
// sozinha na reativação). `closed_at` é o encerramento voluntário pelo dono (libera a vaga das 3).
export const leagues = pgTable(
  'leagues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 40 }).notNull(),
    windowKind: text('window_kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('leagues_owner_idx').on(table.ownerId),
    check('leagues_window_kind_chk', sql`${table.windowKind} IN ('week', 'month')`),
  ],
)

// Participação numa liga. `invited` = convite pendente (só entre amigos aceitos); `active` =
// participa do ranking da liga. O dono é um membro `active` desde a criação.
export const leagueMembers = pgTable(
  'league_members',
  {
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.leagueId, table.userId] }),
    index('league_members_user_idx').on(table.userId),
    check('league_members_status_chk', sql`${table.status} IN ('invited', 'active')`),
  ],
)

// Duelos entre amigos (MO.5.3): desafio 1 contra 1 de 7 dias, vence a maior rentabilidade
// percentual do período. Criar é PRO, aceitar nunca. O resultado é gravado uma única vez, no
// encerramento, e depois nunca muda (arquivar, nunca apagar). `status`: pending (aguardando
// aceite), active, finished, declined, cancelled (o desafiante desistiu) e expired (ninguém
// respondeu a tempo).
// Assembleias (MO.6.1): decisões coletivas por `kind` (hoje só `shareholder`). `subject_ref` é a
// empresa (ou o mercado, em kinds futuros). O peso dos votos vem do snapshot de posições do motor,
// que não é copiado para cá.
export const assemblies = pgTable(
  'assemblies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    subjectRef: text('subject_ref').notNull(),
    // Chave de idempotência da abertura (reexecutar o job não abre duas vezes a mesma assembleia).
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
    // scheduled | open | closed
    status: text('status').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    // Data de corte: posições medidas nesse instante definem quem pode votar e com que peso.
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    effectAppliesAt: timestamp('effect_applies_at', { withTimezone: true }).notNull(),
    // approved | not_approved (só depois de fechada)
    outcome: text('outcome'),
    // quorum | tie | decided
    outcomeReason: text('outcome_reason'),
    winningOptionId: uuid('winning_option_id'),
    voterCount: integer('voter_count'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    // Contexto de exibição (MO.6.3): título da pauta, nome da empresa e a pauta do catálogo que
    // originou a assembleia. Nulos em assembleias criadas sem catálogo.
    title: text('title'),
    subjectLabel: text('subject_label'),
    templateKey: text('template_key'),
    // Quando o resultado aprovado foi entregue ao motor (nulo = ainda não aplicado).
    effectAppliedAt: timestamp('effect_applied_at', { withTimezone: true }),
    // Quando o resultado foi publicado (feed social e e-mail, MO.6.7); nulo = ainda não publicado.
    resultAnnouncedAt: timestamp('result_announced_at', { withTimezone: true }),
    // Quórum fixado na abertura (MO.6.8): editar o parâmetro depois não muda as regras de quem já
    // está votando. Nulo (assembleia anterior ao parâmetro editável) usa o valor de agora.
    minVoters: integer('min_voters'),
    // Declaração de dividendo retida no motor que esta assembleia vai liberar (MO.6.13): a decisão
    // a libera com o payout novo, e fechar sem decisão a libera com o vigente. Nulo nas
    // assembleias que não seguram dividendo.
    declarationId: uuid('declaration_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('assemblies_dedupe_key_unique').on(table.dedupeKey),
    index('assemblies_status_closes_idx').on(table.status, table.closesAt),
    index('assemblies_kind_subject_idx').on(table.kind, table.subjectRef),
    check('assemblies_status_chk', sql`${table.status} IN ('scheduled', 'open', 'closed')`),
    check(
      'assemblies_outcome_chk',
      sql`${table.outcome} IS NULL OR ${table.outcome} IN ('approved', 'not_approved')`,
    ),
    check(
      'assemblies_schedule_chk',
      sql`${table.snapshotAt} <= ${table.opensAt} AND ${table.opensAt} < ${table.closesAt} AND ${table.closesAt} <= ${table.effectAppliesAt}`,
    ),
  ],
)

// Catálogo de pautas (MO.6.3): cada linha é uma pauta fechada de dois lados que o job de abertura
// sorteia de forma determinística para uma empresa. `sector` nulo vale para qualquer setor.
// `options` é uma lista `[{ key, label, gain, loss, effect }]`. Cresce por linha nova (migração
// ou, na MO.6.8, painel admin); a MO.6.5 acrescenta proposta e apoio.
export const agendaTemplates = pgTable(
  'agenda_templates',
  {
    key: varchar('key', { length: 80 }).primaryKey(),
    kind: text('kind').notNull(),
    sector: text('sector'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    options: jsonb('options').notNull(),
    active: boolean('active').notNull().default(true),
    // `general` é sorteada na abertura normal; `profit` só nas assembleias de destinação do lucro,
    // abertas a partir da declaração de dividendo retida (MO.6.13).
    purpose: text('purpose').notNull().default('general'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agenda_templates_kind_active_idx').on(table.kind, table.active),
    check('agenda_templates_purpose_chk', sql`${table.purpose} IN ('general', 'profit')`),
  ],
)

// Parâmetros das assembleias editados no painel (MO.6.8). Uma linha por chave; sem linha vale o
// valor inicial (variável de ambiente ou padrão do código). Restaurar apaga a linha.
export const assemblySettings = pgTable('assembly_settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: integer('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Pausa do ciclo das assembleias (MO.6.8), no padrão das pausas de negociação: global (todas) ou de
// um assunto (uma empresa). Pausar só impede abrir e aplicar; nada se perde, retomar continua de
// onde parou. `scope_key` ('global' ou 'kind:assunto') garante uma pausa vigente por escopo.
export const assemblyPauses = pgTable(
  'assembly_pauses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    kind: text('kind'),
    subjectRef: text('subject_ref'),
    scopeKey: varchar('scope_key', { length: 200 }).notNull(),
    reason: text('reason').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    liftedAt: timestamp('lifted_at', { withTimezone: true }),
    liftedBy: uuid('lifted_by').references(() => users.id),
  },
  (table) => [
    check('assembly_pauses_scope_chk', sql`${table.scope} IN ('global', 'subject')`),
    uniqueIndex('assembly_pauses_active_unique')
      .on(table.scopeKey)
      .where(sql`lifted_at IS NULL`),
    index('assembly_pauses_created_idx').on(table.createdAt),
  ],
)

// Opções da pauta (catálogo fechado, sem texto livre): cada uma com ganho e perda explícitos.
export const assemblyOptions = pgTable(
  'assembly_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assemblyId: uuid('assembly_id')
      .notNull()
      .references(() => assemblies.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    gain: text('gain').notNull(),
    loss: text('loss').notNull(),
    // Parâmetros do efeito, interpretados pelo `EffectApplier` do kind.
    effect: jsonb('effect').notNull().default({}),
    position: smallint('position').notNull(),
  },
  (table) => [unique('assembly_options_assembly_key_unique').on(table.assemblyId, table.key)],
)

// Um voto por pessoa e assembleia; trocar o voto até o fechamento atualiza a mesma linha.
export const assemblyVotes = pgTable(
  'assembly_votes',
  {
    assemblyId: uuid('assembly_id')
      .notNull()
      .references(() => assemblies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    optionId: uuid('option_id')
      .notNull()
      .references(() => assemblyOptions.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.assemblyId, table.userId] }),
    index('assembly_votes_option_idx').on(table.optionId),
  ],
)

// Crédito mensal de voto de quem não é PRO: a linha existe quando o crédito foi consumido numa
// assembleia (no primeiro voto). `month_key` é o mês de calendário de Brasília ('2026-10').
export const assemblyVoteCredits = pgTable(
  'assembly_vote_credits',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    assemblyId: uuid('assembly_id')
      .notNull()
      .references(() => assemblies.id, { onDelete: 'cascade' }),
    monthKey: varchar('month_key', { length: 7 }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.assemblyId] }),
    index('assembly_vote_credits_user_month_idx').on(table.userId, table.monthKey),
  ],
)

// Proposta de pauta (MO.6.5): uma pessoa PRO escolhe uma pauta do catálogo para uma empresa que
// possui e as demais apoiam. Sem texto livre: só `template_key`. `status`: active | consumed
// (virou a pauta de uma assembleia) | expired (passou `expires_at` sem ser escolhida). Uma
// proposta ativa por (kind, empresa, pauta): propor de novo vira apoio à existente.
export const agendaProposals = pgTable(
  'agenda_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    subjectRef: text('subject_ref').notNull(),
    templateKey: varchar('template_key', { length: 80 })
      .notNull()
      .references(() => agendaTemplates.key),
    proposedBy: uuid('proposed_by')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Assembleia que consumiu a proposta (nula enquanto ativa ou expirada).
    consumedAssemblyId: uuid('consumed_assembly_id').references(() => assemblies.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('agenda_proposals_active_unique')
      .on(table.kind, table.subjectRef, table.templateKey)
      .where(sql`status = 'active'`),
    index('agenda_proposals_subject_idx').on(table.kind, table.subjectRef, table.status),
    index('agenda_proposals_proposer_idx').on(table.proposedBy, table.createdAt),
  ],
)

// Apoio a uma proposta: uma linha por pessoa (o proponente entra como primeiro apoio).
export const agendaProposalSupports = pgTable(
  'agenda_proposal_supports',
  {
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => agendaProposals.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.proposalId, table.userId] })],
)

export const duels = pgTable(
  'duels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengerId: uuid('challenger_id')
      .notNull()
      .references(() => users.id),
    opponentId: uuid('opponent_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Prazo para o convidado responder.
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    // challenger | opponent | draw
    outcome: text('outcome'),
    // profitability | abandonment | tie | both_inactive
    reason: text('reason'),
    challengerPct: doublePrecision('challenger_pct'),
    opponentPct: doublePrecision('opponent_pct'),
    challengerOperated: boolean('challenger_operated'),
    opponentOperated: boolean('opponent_operated'),
    // XP de participação já creditado (idempotência do encerramento).
    xpAwardedAt: timestamp('xp_awarded_at', { withTimezone: true }),
  },
  (table) => [
    index('duels_challenger_idx').on(table.challengerId),
    index('duels_opponent_idx').on(table.opponentId),
    index('duels_status_ends_idx').on(table.status, table.endsAt),
    check(
      'duels_status_chk',
      sql`${table.status} IN ('pending', 'active', 'finished', 'declined', 'cancelled', 'expired')`,
    ),
    check('duels_outcome_chk', sql`${table.outcome} IN ('challenger', 'opponent', 'draw')`),
    check('duels_distinct_players_chk', sql`${table.challengerId} <> ${table.opponentId}`),
  ],
)

// Dias em que a pessoa teve atividade qualificadora (lição ou missão concluída), um por linha (MO.5.4).
// Dia presente = manteve a sequência; dia ausente = ficou off. Alimenta o calendário e a maior
// sequência do mês da retrospectiva. Só o registro de atividade, nada financeiro.
export const dailyActivity = pgTable(
  'daily_activity',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // Dia calendário em UTC, o mesmo do streak (`gamification/domain/streak.ts`).
    day: date('day').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
)

// Retrospectiva mensal arquivada (MO.5.4): o conteúdo do mês fica gravado e nunca é recalculado,
// então rever meses antigos independe do plano. `month` no formato AAAA-MM.
export const retrospectives = pgTable(
  'retrospectives',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    month: varchar('month', { length: 7 }).notNull(),
    data: jsonb('data').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
)

// Funil de conversão do PRO (MO.1.3/MO.7.1): eventos próprios, sem terceiro. Guarda só quem fez o
// quê e onde (ponto de convite), nunca valor em reais nem patrimônio (RNF09). `dedupe_key` torna a
// gravação idempotente: o cliente reporta no máximo um evento por pessoa, nome, origem e dia, e os
// eventos de servidor (assinou, cancelou) usam a chave do próprio fato.
export const funnelEvents = pgTable(
  'funnel_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    source: text('source'),
    plan: text('plan'),
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'funnel_events_name_chk',
      sql`${table.name} IN ('invite_viewed', 'plans_opened', 'purchase_started', 'subscribed', 'cancelled')`,
    ),
    check(
      'funnel_events_source_chk',
      sql`${table.source} IS NULL OR ${table.source} IN ('league', 'duel', 'cosmetics', 'retrospective', 'assembly', 'portfolio', 'menu', 'header', 'direct')`,
    ),
    check(
      'funnel_events_plan_chk',
      sql`${table.plan} IS NULL OR ${table.plan} IN ('monthly', 'annual', 'unknown')`,
    ),
    index('funnel_events_name_created_idx').on(table.name, table.createdAt),
    index('funnel_events_user_idx').on(table.userId),
  ],
)

// Indicação entre amigos (MO.7.2). O código é do dono, gerado na primeira leitura. Uma conta
// indicada só existe uma vez em `referrals` (`referred_id` único), então cada conta conta uma vez
// para um único indicador. `qualified` = a pessoa indicada concluiu a primeira lição (ponto 052).
export const referralCodes = pgTable('referral_codes', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  code: varchar('code', { length: 12 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => users.id),
    referredId: uuid('referred_id')
      .notNull()
      .unique()
      .references(() => users.id),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
  },
  (table) => [
    check('referrals_status_chk', sql`${table.status} IN ('pending', 'qualified')`),
    check('referrals_not_self_chk', sql`${table.referrerId} <> ${table.referredId}`),
    index('referrals_referrer_status_idx').on(table.referrerId, table.status),
  ],
)

// Escada de marcos: dado, não código. Acima do último marco a regra continua no domínio
// (`+1 semana a cada 50`). Cada marco só é concedido uma vez por pessoa (`referral_rewards`).
export const referralMilestones = pgTable('referral_milestones', {
  threshold: integer('threshold').primaryKey(),
  rewardDays: integer('reward_days').notNull(),
})

export const referralRewards = pgTable(
  'referral_rewards',
  {
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => users.id),
    threshold: integer('threshold').notNull(),
    rewardDays: integer('reward_days').notNull(),
    status: text('status').notNull().default('pending'),
    // Fim do PRO promocional, calculado e gravado ANTES de chamar o provedor: repetir a chamada
    // com o mesmo fim é tratado como duplicata (não concede duas vezes).
    promoEndsAt: timestamp('promo_ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.referrerId, table.threshold] }),
    check('referral_rewards_status_chk', sql`${table.status} IN ('pending', 'granted')`),
  ],
)
