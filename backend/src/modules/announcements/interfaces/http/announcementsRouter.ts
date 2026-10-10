import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListActiveAnnouncementsUseCase } from '../../application/useCases/announcements'

export interface AnnouncementsRouterDeps {
  listActiveAnnouncements: ListActiveAnnouncementsUseCase
  authMiddleware: AuthMiddleware
}

// Faixa de comunicados do app (N.20): qualquer usuário autenticado lê os que estão no ar
// agora. O texto é puro; quem exibe o renderiza como texto, nunca como HTML.
export function createAnnouncementsRouter(deps: AnnouncementsRouterDeps): Router {
  const router = Router()

  router.get('/announcements', deps.authMiddleware.authenticate, async (_req, res) => {
    const active = await deps.listActiveAnnouncements.execute()
    res.status(200).json({
      announcements: active.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        severity: a.severity,
        kind: a.kind,
        dismissible: a.dismissible,
        starts_at: a.startsAt.toISOString(),
        ends_at: a.endsAt?.toISOString() ?? null,
      })),
    })
  })

  return router
}
