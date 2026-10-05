import type { RequestHandler } from 'express'

// Respostas do painel nunca ficam em cache de navegador nem de proxy (N.22):
// carregam dado de conta e de operação que não deve sobreviver ao logout.
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
}
