import { z } from 'zod'

export const castVoteBodySchema = z.object({ optionId: z.uuid() })

export const proposeAgendaBodySchema = z.object({ templateKey: z.string().min(1).max(80) })
