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
})

export const triggerMacroEventBodySchema = z.union([
  macroEventFromTemplateSchema,
  macroEventAdHocSchema,
])

// Paginação simples de GET /admin/macro-events (tarefa 4.5) — limit/offset
// chegam como string na query, coeridos pro tipo numérico esperado pelo
// motor (GET /macro-events); ambos opcionais, o motor aplica o default
// (20, máximo 100) quando ausentes.
export const listMacroEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
