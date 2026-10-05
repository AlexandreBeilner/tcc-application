import { z } from 'zod'
import { ADMIN_AUDIT_ACTIONS } from '../../domain/auditEntry'

const macroEventTargetSchema = z
  .object({
    sector: z.string().trim().min(1).optional(),
    risk_class: z.string().trim().min(1).optional(),
    asset_id: z.uuid().optional(),
  })
  .refine(
    (target) =>
      [target.sector, target.risk_class, target.asset_id].filter((v) => v !== undefined).length ===
      1,
    { message: 'exatamente um entre sector, risk_class e asset_id deve ser informado' },
  )

// Duas variantes (união): a partir de um template do catálogo (4.3, só
// targets vem do corpo) ou avulso (todos os campos textuais/de efeito
// obrigatórios, tela 10.2, RF13) — mesma regra descrita na tarefa 4.4.
// z.union tenta a primeira variante que bater; um payload com template_key
// e mais nenhum campo cai na primeira, um payload sem template_key só
// valida se tiver todos os campos do evento avulso.
const macroEventFromTemplateSchema = z.object({
  template_key: z.string().trim().min(1),
  targets: z.array(macroEventTargetSchema).min(1),
  created_by: z.uuid().optional(),
  apply_on_day: z.number().int().positive().optional(),
})

const macroEventAdHocSchema = z.object({
  title: z.string().trim().min(1).max(150),
  narrative: z.string().trim().min(1),
  direction: z.enum(['positivo', 'negativo', 'misto']),
  magnitude_band: z.enum(['leve', 'moderado', 'severo']),
  affects_price: z.boolean(),
  affects_fundamentals: z.boolean(),
  targets: z.array(macroEventTargetSchema).min(1),
  created_by: z.uuid().optional(),
  apply_on_day: z.number().int().positive().optional(),
})

export const triggerMacroEventBodySchema = z.union([
  macroEventFromTemplateSchema,
  macroEventAdHocSchema,
])

// Paginação simples de GET /admin/macro-events (tarefa 4.5) — limit/offset
// chegam como string na query, coeridos pro tipo numérico esperado pelo
// motor (GET /macro-events); ambos opcionais, o motor aplica o default
// (20, máximo 100) quando ausentes.
export const listMacroEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    // Filtros do histórico do painel (N.11). O motor valida de novo; aqui só o formato.
    status: z.enum(['pendente', 'aplicado', 'cancelado']).optional(),
    sector: z.string().trim().min(1).optional(),
    risk_class: z.string().trim().min(1).optional(),
    asset_id: z.uuid().optional(),
    from_day: z.coerce.number().int().min(0).optional(),
    to_day: z.coerce.number().int().min(0).optional(),
  })
  .refine((q) => [q.sector, q.risk_class, q.asset_id].filter((v) => v !== undefined).length <= 1, {
    message: 'use no máximo um filtro de alvo (sector, risk_class ou asset_id)',
  })
  .refine((q) => q.from_day === undefined || q.to_day === undefined || q.from_day <= q.to_day, {
    message: 'from_day não pode ser maior que to_day',
    path: ['from_day'],
  })

// GET /admin/macro-events/:id (N.11): janela do impacto realizado, em dias simulados.
export const macroEventDetailQuerySchema = z.object({
  window_days: z.coerce.number().int().min(1).max(90).optional(),
})

// GET /admin/audit-log (N.4) — filtros todos opcionais; datas ISO 8601. `limit`
// default 20 / máximo 100, mesmo teto de GET /admin/macro-events. `action` é
// validado contra a lista fechada de ações auditáveis, não texto livre.
export const listAuditLogQuerySchema = z
  .object({
    admin_id: z.uuid().optional(),
    action: z.enum(ADMIN_AUDIT_ACTIONS).optional(),
    result: z.enum(['success', 'failed']).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    message: 'from deve ser anterior ou igual a to',
    path: ['from'],
  })

// GET /admin/ticks (N.6): mesma paginação limit/offset de GET /admin/macro-events,
// repassada ao motor (que aplica o padrão de 20 e o teto de 100).
export const listTicksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

// POST /admin/tick/advance (N.6): 1 a 30 dias, o mesmo teto do motor
// (tick.MaxAdvanceDays). O motor valida de novo; aqui a borda recusa antes de
// auditar e de chamar.
export const MAX_ADVANCE_DAYS = 30

export const advanceTicksBodySchema = z.object({
  days: z.number().int().min(1).max(MAX_ADVANCE_DAYS),
})

// GET /admin/orders (N.10): filtros opcionais repassados ao motor, que valida de novo.
// `limit` até 200, o teto do motor.
export const listAdminOrdersQuerySchema = z
  .object({
    user_id: z.uuid().optional(),
    asset_id: z.uuid().optional(),
    side: z.enum(['buy', 'sell']).optional(),
    status: z.enum(['open', 'pending', 'partially_filled', 'filled', 'cancelled']).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    message: 'from deve ser anterior ou igual a to',
    path: ['from'],
  })

// POST /admin/orders/cancel-batch (N.10): pelo menos um filtro. "Cancelar tudo" não existe.
export const cancelOrdersBatchBodySchema = z
  .object({
    asset_id: z.uuid().optional(),
    user_id: z.uuid().optional(),
  })
  .refine((b) => b.asset_id !== undefined || b.user_id !== undefined, {
    message: 'informe asset_id ou user_id',
  })

// POST /admin/halts (N.9): pausa global ou de um ativo. O motivo é obrigatório e fica na
// auditoria; o teto de 200 caracteres é o do motor.
export const pauseTradingBodySchema = z
  .object({
    scope: z.enum(['global', 'asset']),
    asset_id: z.uuid().optional(),
    reason: z.string().trim().min(1).max(200),
  })
  .refine((b) => (b.scope === 'asset' ? b.asset_id !== undefined : b.asset_id === undefined), {
    message: 'a pausa de um ativo exige asset_id e a global não leva asset_id',
    path: ['asset_id'],
  })

// POST /admin/bots (N.1). Os valores de setor e classe de risco são os do motor (strings de
// exibição, com acento); o motor valida de novo as faixas da personalidade (atividade no
// escopo 0,85 a 0,90, spread até 0,10) e que o escopo não é vazio.
export const BOT_SECTORS = [
  'Mineração',
  'Agronegócio',
  'Bancário/Financeiro',
  'Varejo',
  'Energia',
  'Tecnologia',
] as const

export const MAX_BOT_INITIAL_CASH = 1_000_000_000_000

export const createBotBodySchema = z.object({
  archetype: z.enum(['ruido', 'market_maker', 'chartista', 'fundamentalista']),
  sectors: z.array(z.enum(BOT_SECTORS)).default([]),
  risk_classes: z.array(z.enum(['Conservador', 'Sofisticado'])).default([]),
  asset_classes: z.array(z.enum(['acao', 'etf', 'fii'])).default([]),
  within_scope_pct: z.number().min(0.85).max(0.9),
  knowledge_level: z.number().min(0).max(1).optional(),
  max_position_size_pct: z.number().gt(0).max(1),
  market_order_preference: z.number().min(0).max(1),
  spread_width_pct: z.number().min(0).max(0.1),
  max_covered_assets: z.number().int().positive().optional(),
  initial_cash: z.number().gt(0).max(MAX_BOT_INITIAL_CASH),
})

// PATCH /admin/bots/:id (N.1 e N.15): pelo menos um campo. `covered_asset_ids` é o conjunto final
// de ativos do Market Maker; lista vazia tira toda a cobertura. Os campos de personalidade (N.15)
// repetem as faixas da criação; o motor valida de novo (escopo final não vazio, conhecimento só no
// fundamentalista). `market_order_preference` não existe aqui (achado 001): campo reservado e sem
// efeito, então um valor enviado é descartado pelo schema.
export const updateBotBodySchema = z
  .object({
    is_active: z.boolean().optional(),
    max_covered_assets: z.number().int().positive().optional(),
    covered_asset_ids: z.array(z.uuid()).optional(),
    sectors: z.array(z.enum(BOT_SECTORS)).optional(),
    risk_classes: z.array(z.enum(['Conservador', 'Sofisticado'])).optional(),
    asset_classes: z.array(z.enum(['acao', 'etf', 'fii'])).optional(),
    within_scope_pct: z.number().min(0.85).max(0.9).optional(),
    knowledge_level: z.number().min(0).max(1).optional(),
    max_position_size_pct: z.number().gt(0).max(1).optional(),
    spread_width_pct: z.number().min(0).max(0.1).optional(),
  })
  .refine((b) => Object.values(b).some((value) => value !== undefined), {
    message: 'informe pelo menos um campo a alterar',
  })

// POST /admin/bots/:id/funding (N.15): aporte de caixa e/ou posição, sempre positivo.
export const MAX_BOT_FUNDING_QUANTITY = 2_000_000_000

export const fundBotBodySchema = z
  .object({
    cash: z.number().gt(0).max(MAX_BOT_INITIAL_CASH).optional(),
    holdings: z
      .array(
        z.object({
          asset_id: z.uuid(),
          quantity: z.number().int().positive().max(MAX_BOT_FUNDING_QUANTITY),
        }),
      )
      .min(1)
      .optional(),
  })
  .refine((b) => b.cash !== undefined || b.holdings !== undefined, {
    message: 'informe caixa e/ou posição a aportar',
  })

// GET /admin/bots/:id/activity?days= e GET /admin/bots/summary?idle_days= (N.14): janelas em dias
// simulados; ausente usa o padrão do motor (30 e 3).
export const botActivityQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
})

export const botsSummaryQuerySchema = z.object({
  idle_days: z.coerce.number().int().positive().max(90).optional(),
})

// PUT /admin/settings/:key (N.7). A faixa de cada chave é do motor (422); aqui só o formato.
export const engineSettingKeySchema = z.enum(['ticks_per_day', 'max_catch_up'])

export const updateEngineSettingBodySchema = z.object({
  value: z.number().int(),
})

// GET /admin/users (N.16): busca livre e filtros, todos opcionais. `limit` default
// 20 / máximo 100, mesma convenção do log de auditoria.
export const listAdminUsersQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    provider: z.string().trim().min(1).max(50).optional(),
    created_from: z.iso.datetime({ offset: true }).optional(),
    created_to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (q) => !q.created_from || !q.created_to || new Date(q.created_from) <= new Date(q.created_to),
    {
      message: 'created_from deve ser anterior ou igual a created_to',
      path: ['created_from'],
    },
  )

// POST /admin/users/:id/suspend (N.16): motivo obrigatório (fica no log e na tela).
export const suspendUserBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

// DELETE /admin/users/:id (N.16, LGPD): o username atual digitado de volta.
export const deleteUserBodySchema = z.object({
  confirm_username: z.string().trim().min(1).max(30),
})

// Correções manuais de conta (N.17). `reason` obrigatório nos ajustes de gamificação e de
// lição, opcional no crédito. Valor do crédito: positivo e finito (o zod já recusa NaN e
// Infinity); sem teto de negócio, o motor guarda só o limite físico do saldo.
const correctionReasonSchema = z.string().trim().min(3).max(500)

export const creditUserBodySchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().max(500).optional(),
})

export const adjustXpBodySchema = z.object({
  delta: z
    .number()
    .int()
    .refine((delta) => delta !== 0, { message: 'o ajuste não pode ser zero' }),
  reason: correctionReasonSchema,
})

export const setStreakBodySchema = z.object({
  value: z.number().int().min(0).max(36500),
  reason: correctionReasonSchema,
})

export const correctionReasonBodySchema = z.object({
  reason: correctionReasonSchema,
})

// Catálogo de conquistas e missões (N.19). O critério é uma das regras fechadas que o código
// avalia; a meta e os limites finos (inteira, centavos, teto) são da regra de domínio (422).
const achievementCriteriaSchema = z.enum([
  'net_worth',
  'streak_days',
  'lessons_completed',
  'trades_executed',
  'micro_decisions_streak',
  'track_completed_no_errors',
  'lesson_reviewed',
])

export const createAchievementBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).nullish(),
  criteria_type: achievementCriteriaSchema,
  criteria_value: z.number().positive(),
})

export const updateAchievementBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(255).nullable().optional(),
    criteria_type: achievementCriteriaSchema.optional(),
    criteria_value: z.number().positive().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'informe ao menos um campo' })

export const updateMissionBodySchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    xp_reward: z.number().int().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'informe ao menos um campo' })

// GET /admin/gamification/ranking (N.19): leitura da janela corrente. `window` só é opcional
// no critério de nível, que é cumulativo.
export const adminRankingQuerySchema = z
  .object({
    window: z.enum(['week', 'month']).optional(),
    criterion: z.enum(['overall', 'fixedIncome', 'variableIncome', 'level']).default('overall'),
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((query) => query.criterion === 'level' || query.window !== undefined, {
    message: 'window é obrigatório exceto quando criterion=level',
    path: ['window'],
  })
