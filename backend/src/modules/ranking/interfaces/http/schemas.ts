import { z } from 'zod'

export const rankingQuerySchema = z.object({
  window: z.enum(['week', 'month']),
  scope: z.enum(['global', 'friends']).default('global'),
})
