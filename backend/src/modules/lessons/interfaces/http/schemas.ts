import { z } from 'zod'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const answerMicroDecisionBodySchema = z.object({
  selectedOption: z.number().int().min(0),
})

// Exatamente um de `selectedOption` (única escolha, verdadeiro/falso) ou
// `value` (numérica) — qual dos dois vale depende do bloco, validado no caso de uso.
export const answerCheckpointBodySchema = z
  .object({
    selectedOption: z.number().int().min(0).optional(),
    value: z.number().finite().optional(),
  })
  .refine((body) => (body.selectedOption === undefined) !== (body.value === undefined), {
    message: 'envie selectedOption ou value',
  })

export const advanceLessonBodySchema = z.object({
  step: z.number().int().min(0).max(LESSON_UNLOCK_STEP),
  // DEPRECADO (RC.2.3): a escolha agora vai em `POST /lessons/:id/answer`.
  // Continua aceito e é ignorado, pra cliente antigo não tomar 400; sai do
  // schema numa versão futura.
  selectedOption: z.number().int().min(0).optional(),
})
