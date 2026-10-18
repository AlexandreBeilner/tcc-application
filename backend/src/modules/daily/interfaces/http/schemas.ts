import { z } from 'zod'
import { METRIC_EVENTS } from '../../domain/metrics'
import { MAX_WORD_ATTEMPTS } from '../../domain/wordGuess'

// Limites folgados só para recusar lixo cedo; o formato de verdade é conferido no domínio.
export const wordGuessBodySchema = z.object({
  guess: z.string().min(1).max(32),
  // Obrigatório sem login (o servidor não guarda estado); logado é ignorado.
  attempt: z.number().int().min(1).max(MAX_WORD_ATTEMPTS).optional(),
})

// Contador agregado (DI.7.1): só o nome do evento, nada de quem avisou.
export const metricBodySchema = z.object({ event: z.enum(METRIC_EVENTS) }).strict()

export const triviaAnswerBodySchema = z.object({
  choice: z.number().int().min(0).max(20),
})

export const timelineAnswerBodySchema = z.object({
  order: z.array(z.string().min(1).max(64)).min(1).max(12),
})
