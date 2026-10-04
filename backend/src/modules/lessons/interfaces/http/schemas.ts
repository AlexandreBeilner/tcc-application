import { z } from 'zod'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const answerMicroDecisionBodySchema = z.object({
  selectedOption: z.number().int().min(0),
})

export const advanceLessonBodySchema = z.object({
  step: z.number().int().min(0).max(LESSON_UNLOCK_STEP),
  // DEPRECADO (RC.2.3): a escolha agora vai em `POST /lessons/:id/answer`.
  // Continua aceito e é ignorado, pra cliente antigo não tomar 400; sai do
  // schema numa versão futura.
  selectedOption: z.number().int().min(0).optional(),
})
