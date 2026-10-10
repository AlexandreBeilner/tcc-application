import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetProgressionUseCase } from '../../application/useCases/getProgression'
import type { MonthlySalaryReader } from '../../application/ports/monthlySalaryReader'
import type { Progression } from '../../domain/progression'

export interface ProgressionRouterDeps {
  getProgression: GetProgressionUseCase
  monthlySalaryReader: MonthlySalaryReader
  authMiddleware: AuthMiddleware
}

// `monthlySalary` (T.8) é derivado do nível, nunca persistido na entidade
// `Progression` (que é `user_progression`, sem esse campo) — composto aqui,
// na borda HTTP, pra não vazar uma dependência de `payroll` pra dentro do
// caso de uso, que outros módulos (profile, achievements, ranking, auth)
// também consomem.
function toResponse(progression: Progression, monthlySalaryReader: MonthlySalaryReader) {
  return {
    ...progression,
    monthlySalary: monthlySalaryReader.getMonthlySalaryForLevel(progression.level),
  }
}

export function createProgressionRouter(deps: ProgressionRouterDeps): Router {
  const router = Router()

  router.get('/me/progression', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const progression = await deps.getProgression.execute({ userId: req.auth.userId })
    res.status(200).json(toResponse(progression, deps.monthlySalaryReader))
  })

  // Público: nível/xp nunca são o dado protegido por RNF09 — só patrimônio
  // absoluto é. `monthlySalary` também é seguro aqui: é função pura do nível,
  // já público, não revela nada novo.
  router.get('/users/:id/progression', async (req, res) => {
    const progression = await deps.getProgression.execute({ userId: req.params.id })
    res.status(200).json(toResponse(progression, deps.monthlySalaryReader))
  })

  return router
}
