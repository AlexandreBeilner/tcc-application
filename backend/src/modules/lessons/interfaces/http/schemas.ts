import { z } from 'zod'
import { MAX_CARD_INDEX, MAX_CARD_PHASE } from '../../domain/cardReach'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const answerMicroDecisionBodySchema = z.object({
  selectedOption: z.number().int().min(0),
})

// Resposta por formato (LJ.2.1): `selectedOption` (única escolha ou verdadeiro/falso) ou
// `value` (estimativa) ou `sequence` (ordenar), um dos três. O intervalo válido depende do bloco e é validado no
// caso de uso.
export const answerCheckpointBodySchema = z.union([
  z.object({ selectedOption: z.number().int().min(0) }),
  z.object({ value: z.number().finite() }),
  z.object({ sequence: z.array(z.number().int().min(0)).min(2).max(12) }),
])

export const advanceLessonBodySchema = z.object({
  step: z.number().int().min(0).max(LESSON_UNLOCK_STEP),
  // DEPRECADO (RC.2.3): a escolha agora vai em `POST /lessons/:id/answer`.
  // Continua aceito e é ignorado, pra cliente antigo não tomar 400; sai do
  // schema numa versão futura.
  selectedOption: z.number().int().min(0).optional(),
})

// Cartão que o player acabou de mostrar (LJ.5.1): fase (0 a 3) e posição na fase.
export const recordCardReachBodySchema = z.object({
  phase: z.number().int().min(0).max(MAX_CARD_PHASE),
  cardIndex: z.number().int().min(0).max(MAX_CARD_INDEX),
})
