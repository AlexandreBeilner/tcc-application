import { Router } from 'express'
import { checkEngineHealth } from '../infra/engineClient'

export const statusRouter = Router()

statusRouter.get('/status', async (_req, res) => {
  const engine = await checkEngineHealth()
  res.status(200).json({ backend: 'ok', engine })
})
