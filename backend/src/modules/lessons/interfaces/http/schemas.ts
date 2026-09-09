import { z } from 'zod'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const advanceLessonBodySchema = z.object({
  step: z.number().int().min(0).max(LESSON_UNLOCK_STEP),
  // Aposta com acerto/erro real (backlog engajamento B.2) — Zod só garante
  // formato (inteiro >= 0); o índice caber em `microDecisionOptions` da
  // lição é regra de negócio, validada no caso de uso (não aqui).
  selectedOption: z.number().int().min(0).optional(),
})
