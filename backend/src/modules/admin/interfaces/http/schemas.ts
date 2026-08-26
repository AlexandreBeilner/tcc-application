import { z } from 'zod'

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
