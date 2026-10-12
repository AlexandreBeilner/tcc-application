import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

// Uma linha de log por requisição (LW.3.5): método, caminho, status e duração, com um `X-Request-Id` para
// juntar a linha ao erro 5xx do mesmo pedido. Privacidade (LGPD): sem IP, sem usuário, sem corpo, sem query
// string (links de e-mail podem carregar token) e sem ids nos caminhos (UUID e números viram `:id`).
// Healthchecks (a cada 15 s) ficam de fora para não encher o log.
const SKIP = /^\/(health|status)(\/|$)/
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/

export function sanitizePath(rawUrl: string): string {
  const path = rawUrl.split('?')[0]
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
}

export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id')
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID()
    res.locals.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    const startedAt = process.hrtime.bigint()

    res.on('finish', () => {
      if (SKIP.test(req.path)) return
      const entry = {
        requestId,
        method: req.method,
        path: sanitizePath(req.originalUrl),
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
      }
      if (res.statusCode >= 500) console.error('requisição falhou', entry)
      else console.log('requisição', entry)
    })
    next()
  }
}
