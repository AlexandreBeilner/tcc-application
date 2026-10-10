import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetEmailPreferencesUseCase } from '../../application/useCases/getEmailPreferences'
import type { UnsubscribeByTokenUseCase } from '../../application/useCases/unsubscribeByToken'
import type { UpdateEmailPreferencesUseCase } from '../../application/useCases/updateEmailPreferences'
import { InvalidUnsubscribeTokenError } from '../../domain/errors'

export interface EmailPreferencesRouterDeps {
  getEmailPreferences: GetEmailPreferencesUseCase
  updateEmailPreferences: UpdateEmailPreferencesUseCase
  unsubscribeByToken: UnsubscribeByTokenUseCase
  authMiddleware: AuthMiddleware
  // Página pública de confirmação do frontend (`${FRONTEND_URL}/cancelar-inscricao`).
  unsubscribePageUrl: string
}

// Só as categorias opcionais existem no contrato: segurança e transacional não são desligáveis,
// então `{ "security": false }` cai em "campo desconhecido" (`.strict()`), não é ignorado.
const updatePreferencesBodySchema = z
  .object({ social: z.boolean().optional(), engagement: z.boolean().optional() })
  .strict()
  .refine((body) => body.social !== undefined || body.engagement !== undefined, {
    message: 'informe ao menos uma categoria',
  })

// O token vem na query (é a URL do `List-Unsubscribe`, que os clientes de e-mail chamam por POST
// sem corpo útil) ou no corpo JSON (a página de confirmação do frontend).
const unsubscribeSchema = z.object({ token: z.string().min(1).max(400) })

export function createEmailPreferencesRouter(deps: EmailPreferencesRouterDeps): Router {
  const router = Router()

  router.get('/me/email-preferences', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const { preferences, suppression } = await deps.getEmailPreferences.execute({
      userId: req.auth.userId,
    })
    res.status(200).json({ preferences, suppression })
  })

  router.patch('/me/email-preferences', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = updatePreferencesBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }
    const preferences = await deps.updateEmailPreferences.execute({
      userId: req.auth.userId,
      changes: parsed.data,
    })
    res.status(200).json({ preferences })
  })

  // Scanners de e-mail "clicam" em todo link: um GET nunca cancela nada. Só leva para a página
  // de confirmação do frontend (o token vai no fragmento, que não chega a nenhum servidor).
  router.get('/email/unsubscribe', (req, res) => {
    const parsed = unsubscribeSchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'link de cancelamento inválido' })
      return
    }
    res.redirect(302, `${deps.unsubscribePageUrl}#token=${encodeURIComponent(parsed.data.token)}`)
  })

  router.post('/email/unsubscribe', async (req, res) => {
    const parsed = unsubscribeSchema.safeParse({
      token: req.query.token ?? (req.body as { token?: unknown } | undefined)?.token,
    })
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }
    try {
      const { category } = await deps.unsubscribeByToken.execute({ token: parsed.data.token })
      res.status(200).json({ status: 'cancelado', category })
    } catch (err) {
      if (err instanceof InvalidUnsubscribeTokenError) {
        // 400, não 401: aqui não há sessão, e um 401 dispararia o tratamento de "sessão expirada"
        // do client HTTP do frontend.
        res.status(400).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
