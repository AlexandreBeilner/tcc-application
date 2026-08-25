import { z } from 'zod'

export const profileQuerySchema = z.object({
  window: z.enum(['week', 'month']).optional(),
})
