import express, { Express } from 'express'
import { healthRouter } from './routes/health'
import { statusRouter } from './routes/status'

export function createApp(): Express {
  const app = express()
  app.use(express.json())
  app.use(healthRouter)
  app.use(statusRouter)
  return app
}
