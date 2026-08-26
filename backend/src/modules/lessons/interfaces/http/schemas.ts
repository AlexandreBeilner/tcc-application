import { z } from 'zod'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const advanceLessonBodySchema = z.object({
  step: z.number().int().min(0).max(LESSON_UNLOCK_STEP),
})
