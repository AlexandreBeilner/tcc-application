import type { Request, Response } from 'express'

// Embrulha o handler de uma rota autenticada: pega o `userId` do token e converte erro de regra em
// resposta (`mapError` devolve `true` se tratou). O resto segue para o `jsonErrorHandler`.
export function authedRoute(
  mapError: (err: unknown, res: Response) => boolean,
  handler: (userId: string, req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      await handler(req.auth.userId, req, res)
    } catch (err) {
      if (!mapError(err, res)) throw err
    }
  }
}
