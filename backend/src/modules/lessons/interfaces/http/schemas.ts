import { z } from 'zod'
import { MAX_CARD_INDEX, MAX_CARD_PHASE } from '../../domain/cardReach'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'

export const answerMicroDecisionBodySchema = z.object({
  selectedOption: z.number().int().min(0),
})

// Resposta por formato (LJ.2.1): `selectedOption` (única escolha ou verdadeiro/falso) ou
// `value` (estimativa) ou `sequence` (ordenar) ou `groups` (agrupar) ou `pair` (ligar, um par por vez), um dos cinco. O intervalo válido depende do bloco e é validado no
// caso de uso.
// `practice` (LJ.5.5/5.6): o cliente avisa que é prática (Relembra, revisão de 1 minuto); só muda a resposta
// quando a pergunta é de leitura (ver `AnswerCheckpointInput`).
const practiceFlag = { practice: z.boolean().optional() }
export const answerCheckpointBodySchema = z.union([
  z.object({ selectedOption: z.number().int().min(0), ...practiceFlag }),
  z.object({ value: z.number().finite(), ...practiceFlag }),
  z.object({ sequence: z.array(z.number().int().min(0)).min(2).max(12), ...practiceFlag }),
  z.object({ groups: z.array(z.number().int().min(0)).min(2).max(12), ...practiceFlag }),
  // Ligar pares (LJ.2.5, LJ-D3): um par por chamada, `[esquerda, direita]`.
  z.object({ pair: z.tuple([z.number().int().min(0), z.number().int().min(0)]), ...practiceFlag }),
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

// Resultado de uma pergunta da revisão de 1 minuto (LJ.5.6): acertou sem errar antes.
export const reviewResultBodySchema = z.object({ correct: z.boolean() })
