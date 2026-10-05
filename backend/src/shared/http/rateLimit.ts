import type { Request, RequestHandler } from 'express'

export interface RateLimitOptions {
  windowMs: number
  max: number
  // Quem conta como "o mesmo cliente". Padrão: o IP; o painel usa o
  // administrador autenticado quando existe.
  keyOf?: (req: Request) => string
  now?: () => number
}

// Janela fixa em memória (N.22). Suficiente pro painel: o backend roda em
// uma instância só, e o objetivo é frear força bruta e laço descontrolado,
// não cobrança por uso. Se o backend virar várias réplicas, o contador
// precisa migrar pro Redis (mesma assinatura).
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now
  const keyOf = options.keyOf ?? ((req) => req.ip ?? 'unknown')
  const buckets = new Map<string, { count: number; resetAt: number }>()

  return (req, res, next) => {
    const current = now()
    // Varredura oportunista pra o mapa não crescer sem limite.
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= current) buckets.delete(key)
      }
    }

    const key = keyOf(req)
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + options.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    if (bucket.count > options.max) {
      res.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((bucket.resetAt - current) / 1000))),
      )
      res.status(429).json({ error: 'muitas requisições, tente novamente em instantes' })
      return
    }
    next()
  }
}
