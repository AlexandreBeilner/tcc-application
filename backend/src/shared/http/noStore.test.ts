import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { noStore } from './noStore'

describe('noStore', () => {
  it('marca a resposta como não armazenável', async () => {
    const app = express()
    app.use('/admin', noStore)
    app.get('/admin/x', (_req, res) => {
      res.json({})
    })
    app.get('/publico', (_req, res) => {
      res.json({})
    })

    expect((await request(app).get('/admin/x')).headers['cache-control']).toBe('no-store')
    expect((await request(app).get('/publico')).headers['cache-control']).toBeUndefined()
  })
})
