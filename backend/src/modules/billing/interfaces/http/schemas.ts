import { z } from 'zod'
import { CLIENT_FUNNEL_EVENTS, FUNNEL_SOURCES } from '../../domain/funnel'
import { CONVERSION_WINDOWS } from '../../application/useCases/getBillingConversion'

// Só o que o caso de uso precisa do webhook do RevenueCat; o resto do corpo é ignorado. Campos
// opcionais porque variam por tipo de evento (ex.: `transferred_*` só existe em TRANSFER).
// O RevenueCat manda `null` (e não omite) nos campos que não se aplicam ao tipo do evento, como
// `aliases: null` em INVOICE_ISSUANCE. `.optional()` recusava `null` e o webhook respondia 400.
// Estes campos só ajudam a achar a pessoa; um campo estranho nunca pode derrubar o aviso, porque
// o RevenueCat só reenvia 5 vezes e o evento seria perdido (a reconsulta é que decide o estado).
const idList = z.array(z.string()).nullish().catch(undefined)

export const webhookBodySchema = z.object({
  event: z.object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(60),
    event_timestamp_ms: z.number().nullish().catch(undefined),
    app_user_id: z.string().nullish().catch(undefined),
    original_app_user_id: z.string().nullish().catch(undefined),
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

export const funnelBodySchema = z.object({
  event: z.enum(CLIENT_FUNNEL_EVENTS),
  source: z.enum(FUNNEL_SOURCES).optional(),
  plan: z.enum(['monthly', 'annual']).optional(),
})

export const conversionQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((n): n is (typeof CONVERSION_WINDOWS)[number] =>
      (CONVERSION_WINDOWS as readonly number[]).includes(n),
    )
    .default(30),
})
