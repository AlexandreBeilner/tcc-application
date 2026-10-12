import { z } from 'zod'

export const cosmeticKindSchema = z.enum(['frame', 'title'])

export const equipBodySchema = z.object({
  kind: cosmeticKindSchema,
  itemKey: z.string().min(1).max(40),
})

export const unequipBodySchema = z.object({
  kind: cosmeticKindSchema,
})
