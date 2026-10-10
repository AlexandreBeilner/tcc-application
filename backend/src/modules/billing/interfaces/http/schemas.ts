import { z } from 'zod'

// Só o que o caso de uso precisa do webhook do RevenueCat; o resto do corpo é ignorado. Campos
// opcionais porque variam por tipo de evento (ex.: `transferred_*` só existe em TRANSFER).
const idList = z.array(z.string()).optional()

export const webhookBodySchema = z.object({
  event: z.object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(60),
    event_timestamp_ms: z.number().optional(),
    app_user_id: z.string().optional(),
    original_app_user_id: z.string().optional(),
    aliases: idList,
    transferred_from: idList,
    transferred_to: idList,
  }),
})

export type WebhookBody = z.infer<typeof webhookBodySchema>

export const devPurchaseBodySchema = z.object({
  plan: z.enum(['monthly', 'annual']),
  store: z.enum(['app_store', 'play_store']),
})
