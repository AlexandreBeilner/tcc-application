import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { TokenIssuer } from '../../modules/auth/application/ports/tokenIssuer'
import type { UserRole } from '../../modules/auth/domain/user'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole }
    }
  }
}

export interface AuthMiddleware {
  authenticate: RequestHandler
  requireRole(role: UserRole): RequestHandler
}

// Cross-cutting: usado por qualquer módulo que precise proteger uma rota
// (auth/me hoje, painéis administrativos futuros — 4.4/6.x). Depende só da
// abstração TokenIssuer (porta do módulo auth), não de uma implementação
// concreta — quem decide qual usar é a composição em app.ts.
export function createAuthMiddleware(tokenIssuer: TokenIssuer): AuthMiddleware {
  return {
    authenticate(req: Request, res: Response, next: NextFunction) {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      try {
        const payload = tokenIssuer.verify(header.slice('Bearer '.length))
        req.auth = { userId: payload.sub, role: payload.role }
        next()
      } catch {
        res.status(401).json({ error: 'token inválido' })
      }
    },

    requireRole(role: UserRole) {
      return (req, res, next) => {
        if (req.auth?.role !== role) {
          res.status(403).json({ error: 'acesso restrito' })
          return
        }
        next()
      }
    },
  }
}
