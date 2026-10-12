import { createHash } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import { createRateLimiter, type RateLimitOptions } from '../../../../shared/http/rateLimit'

const WINDOW_MS = 15 * 60_000

type Overrides = Partial<Pick<RateLimitOptions, 'now'>>

// `AUTH_RATE_LIMIT=off` desliga estes três limites, só para desenvolvimento e simulações que criam
// centenas de contas do mesmo IP (`engine/scripts/e2e-mercado-simulado`). A guarda de configuração
// (`productionConfigGuard`) recusa subir staging ou produção com ele ligado.
export function authRateLimitDisabled(env: NodeJS.ProcessEnv): boolean {
  return env.AUTH_RATE_LIMIT?.trim() === 'off'
}

// Chave por e-mail normalizado, guardada como hash: o contador em memória não retém endereços.
// Corpo sem e-mail válido cai no 400 da rota; a chave só precisa ser estável (cai no IP).
function emailKey(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email
  return typeof email === 'string'
    ? `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`
    : `ip:${req.ip ?? 'unknown'}`
}

// Limites do login (OWASP, proteção contra força bruta e credential stuffing). Dois eixos, porque
// cada um cobre o que o outro não vê:
// - por IP: barra quem varre muitas contas a partir de um lugar só. Folgado (30 em 15 minutos)
//   porque muita gente compartilha IP (faculdade, empresa, rede móvel).
// - por e-mail: barra quem tenta adivinhar a senha de uma conta específica vindo de vários IPs.
//   10 em 15 minutos; conta mesmo quando a conta não existe, então o 429 não revela se o e-mail
//   está cadastrado.
// Contam todas as tentativas (e não só as erradas) de propósito: contar só falhas exigiria
// esperar a resposta, e uma rajada em paralelo passaria inteira pelo teto. A troca é que alguém
// consegue travar o login de uma pessoa por até 15 minutos mandando 10 tentativas com o e-mail
// dela; o IP dele também é limitado, então o custo para o atacante é alto e o efeito é curto.
// Em memória: o backend roda em uma instância só (ver `shared/http/rateLimit.ts`); reiniciar zera
// os contadores, e a regra de rate limiting da Cloudflare cobre as rajadas antes de chegar aqui.
export function createLoginRateLimiters(overrides: Overrides = {}): RequestHandler[] {
  return [
    createRateLimiter({ windowMs: WINDOW_MS, max: 30, ...overrides }),
    createRateLimiter({ windowMs: WINDOW_MS, max: 10, keyOf: emailKey, ...overrides }),
  ]
}

// Cadastro: freia criação de contas em massa a partir de um IP. Uma hora, porque o abuso aqui é
// volume, e não adivinhação.
export function createRegisterRateLimiter(overrides: Overrides = {}): RequestHandler {
  return createRateLimiter({ windowMs: 60 * 60_000, max: 20, ...overrides })
}

// Login com Google por token (app nativo): o token é validado pelo Google, então o teto só freia
// laço descontrolado e consumo de CPU.
export function createGoogleTokenRateLimiter(overrides: Overrides = {}): RequestHandler {
  return createRateLimiter({ windowMs: WINDOW_MS, max: 30, ...overrides })
}
