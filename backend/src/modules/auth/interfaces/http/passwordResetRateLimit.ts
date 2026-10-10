import { createHash } from 'node:crypto'
import type { RequestHandler } from 'express'
import { createRateLimiter, type RateLimitOptions } from '../../../../shared/http/rateLimit'

const WINDOW_MS = 15 * 60_000

// Limites do "esqueci minha senha" (EM.2.2): por IP, para barrar quem varre endereços, e por
// e-mail normalizado (guardado como hash, o contador em memória não retém endereços), para
// ninguém inundar a caixa de uma pessoa com e-mails. O limite por e-mail conta mesmo quando a
// conta não existe, então um 429 não revela nada.
export function createForgotPasswordRateLimiters(
  overrides: Partial<Pick<RateLimitOptions, 'now'>> = {},
): RequestHandler[] {
  return [
    createRateLimiter({ windowMs: WINDOW_MS, max: 20, ...overrides }),
    createRateLimiter({
      windowMs: WINDOW_MS,
      max: 3,
      keyOf: (req) => {
        const email = (req.body as { email?: unknown } | undefined)?.email
        // Corpo sem e-mail válido cai no 400 da rota; a chave só precisa ser estável.
        return typeof email === 'string'
          ? `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`
          : `ip:${req.ip ?? 'unknown'}`
      },
      ...overrides,
    }),
  ]
}

// Troca de senha com token: o token tem 256 bits, então força bruta é inviável; o teto só freia
// laço descontrolado e consumo de CPU do bcrypt.
export function createResetPasswordRateLimiter(
  overrides: Partial<Pick<RateLimitOptions, 'now'>> = {},
): RequestHandler {
  return createRateLimiter({ windowMs: WINDOW_MS, max: 20, ...overrides })
}
