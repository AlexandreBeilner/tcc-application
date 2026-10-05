import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import type { ListEngineSettingsUseCase } from '../../application/useCases/listEngineSettings'
import type { ResetEngineSettingUseCase } from '../../application/useCases/resetEngineSetting'
import type { UpdateEngineSettingUseCase } from '../../application/useCases/updateEngineSetting'
import { engineSettingKeySchema, updateEngineSettingBodySchema } from './schemas'

export interface AdminSettingsRouterDeps {
  listEngineSettings: ListEngineSettingsUseCase
  updateEngineSetting: UpdateEngineSettingUseCase
  resetEngineSetting: ResetEngineSettingUseCase
  authMiddleware: AuthMiddleware
}

// Parâmetros de simulação (Fase N, tarefa N.7): lista, altera e restaura o padrão. Só os
// parâmetros de ritmo são editáveis; chave fora da lista é 404. Alterar e restaurar passam
// pela auditoria (N.4).
export function createAdminSettingsRouter(deps: AdminSettingsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]

  router.get('/admin/settings', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.listEngineSettings.execute())
  })

  router.put('/admin/settings/:key', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const key = engineSettingKeySchema.safeParse(req.params.key)
    if (!key.success) {
      res.status(404).json({ error: 'parâmetro desconhecido ou somente leitura' })
      return
    }
    const body = updateEngineSettingBodySchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({
        error: 'value deve ser um inteiro',
        details: z.flattenError(body.error),
      })
      return
    }
    try {
      res
        .status(200)
        .json(await deps.updateEngineSetting.execute(req.auth.userId, key.data, body.data.value))
    } catch (err) {
      sendSettingError(err, res)
    }
  })

  router.delete('/admin/settings/:key', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const key = engineSettingKeySchema.safeParse(req.params.key)
    if (!key.success) {
      res.status(404).json({ error: 'parâmetro desconhecido ou somente leitura' })
      return
    }
    try {
      res.status(200).json(await deps.resetEngineSetting.execute(req.auth.userId, key.data))
    } catch (err) {
      sendSettingError(err, res)
    }
  })

  return router
}

function sendSettingError(err: unknown, res: Response): void {
  if (err instanceof EngineSettingNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof EngineSettingRejectedError) {
    res.status(422).json({ error: err.message })
    return
  }
  throw err
}
