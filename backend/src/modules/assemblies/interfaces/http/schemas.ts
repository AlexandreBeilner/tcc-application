import { z } from 'zod'

export const castVoteBodySchema = z.object({ optionId: z.uuid() })

export const proposeAgendaBodySchema = z.object({ templateKey: z.string().min(1).max(80) })

export const listAssembliesQuerySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  companyId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
