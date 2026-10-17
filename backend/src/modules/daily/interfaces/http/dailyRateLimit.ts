import type { RequestHandler } from 'express'
import { createRateLimiter } from '../../../../shared/http/rateLimit'

// Rotas do Diário sem login ficam abertas à internet (a página pública não tem conta). O teto é
// por IP, que atrás do proxy é o IP real (`trust proxy`, LW.3.9). Uma partida inteira usa poucas
// chamadas; o teto só freia varredura de respostas e laço descontrolado.
export const DAILY_RATE_LIMIT = { windowMs: 60_000, max: 120 }

export function createDailyRateLimiter(now?: () => number): RequestHandler {
  return createRateLimiter({ ...DAILY_RATE_LIMIT, now })
}
