import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type {
  TokenIssuer,
  VerifiedAuthToken,
} from '../../modules/auth/application/ports/tokenIssuer'
import type { SessionGuard } from '../../modules/auth/application/ports/sessionGuard'
import type { UserRole } from '../../modules/auth/domain/user'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole; authTime: number }
    }
  }
}

export interface AuthMiddleware {
  authenticate: RequestHandler
  requireRole(role: UserRole): RequestHandler
  // Ação destrutiva do painel (N.22): exige que a senha tenha sido conferida
  // há pouco (login ou `POST /auth/reauth`). Sem isso, `401 reauth_required`
  // — o frontend pede a senha de novo e repete a ação.
  requireRecentAuth(maxAgeSeconds?: number): RequestHandler
}

// Janela em que uma conferência de senha ainda vale pra ações destrutivas.
export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60

// Cross-cutting: usado por qualquer módulo que precise proteger uma rota
// (auth/me hoje, painéis administrativos futuros — 4.4/6.x). Depende só da
// abstração TokenIssuer (porta do módulo auth), não de uma implementação
// concreta — quem decide qual usar é a composição em app.ts.
export function createAuthMiddleware(
  tokenIssuer: TokenIssuer,
  sessionGuard?: SessionGuard,
): AuthMiddleware {
  return {
    authenticate(req: Request, res: Response, next: NextFunction) {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      let payload: VerifiedAuthToken
      try {
        payload = tokenIssuer.verify(header.slice('Bearer '.length))
      } catch {
        res.status(401).json({ error: 'token inválido' })
        return
      }
      req.auth = { userId: payload.sub, role: payload.role, authTime: payload.authTime }

      // Sem guarda (testes isolados de rota) o token vale por si só.
      if (!sessionGuard) {
        next()
        return
      }
      // Suspensão e "forçar logout" (N.16) só valem se o estado atual do
      // usuário for consultado: o JWT sozinho continuaria válido até expirar.
      sessionGuard.check(payload.sub, payload.tokenVersion).then((verdict) => {
        if (verdict === 'suspended') {
          res.status(403).json({ error: 'account_suspended' })
        } else if (verdict === 'revoked') {
          res.status(401).json({ error: 'sessão encerrada' })
        } else {
          next()
        }
      }, next)
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

    requireRecentAuth(maxAgeSeconds = RECENT_AUTH_MAX_AGE_SECONDS) {
      return (req, res, next) => {
        const nowSeconds = Math.floor(Date.now() / 1000)
        if (!req.auth || nowSeconds - req.auth.authTime > maxAgeSeconds) {
          res.status(401).json({ error: 'reauth_required' })
          return
        }
        next()
      }
    },
  }
}
