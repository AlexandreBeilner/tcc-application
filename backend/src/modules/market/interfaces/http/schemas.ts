import { z } from 'zod'

// Os 11 valores do enum `asset_type` do motor (`.docs/engine/catalog.md`).
const ASSET_TYPES = [
  'tesouro_selic',
  'tesouro_prefixado',
  'tesouro_ipca',
  'cdb',
  'lci',
  'lca',
  'cri',
  'cra',
  'acao',
  'etf',
  'fii',
] as const

export const listAssetsQuerySchema = z.object({
  type: z.enum(ASSET_TYPES).optional(),
})

export const getAssetQuotesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).optional(),
})

// Mesma convenção de paginação de `listMacroEventsQuerySchema`
// (`modules/admin`) — limit/offset opcionais, o motor aplica o default.
export const listMyEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

// `user_id` nunca faz parte do schema do corpo — é sempre injetado pelo
// router a partir de `req.auth.userId` (tarefa 6.0.3), nunca aceito do
// cliente.
export const placeOrderBodySchema = z
  .object({
    asset_id: z.uuid(),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit']),
    price: z.number().positive().optional(),
    quantity: z.number().int().positive(),
  })
  .refine((body) => body.type !== 'limit' || body.price !== undefined, {
    message: 'price é obrigatório e deve ser > 0 para ordens do tipo limit',
    path: ['price'],
  })

export const purchaseFixedIncomeBodySchema = z.object({
  asset_id: z.uuid(),
  amount: z.number().positive(),
})

export const redeemFixedIncomeBodySchema = z.object({
  asset_id: z.uuid(),
})

// GET, não POST — parâmetros vêm de query string (tarefa 6.0.5), por isso
// amount/days_held usam z.coerce (mesma convenção de
// getAssetQuotesQuerySchema/listMyEventsQuerySchema acima).
export const simulateFixedIncomeQuerySchema = z.object({
  asset_id: z.uuid(),
  amount: z.coerce.number().positive(),
  days_held: z.coerce.number().int().positive(),
})
