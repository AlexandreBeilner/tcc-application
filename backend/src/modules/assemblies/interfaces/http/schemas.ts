import { z } from 'zod'

export const castVoteBodySchema = z.object({ optionId: z.uuid() })
