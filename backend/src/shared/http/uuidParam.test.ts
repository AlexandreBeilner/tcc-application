import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { requireUuidParam } from './uuidParam'

function buildApp() {
  const router = express.Router()
  router.param('id', requireUuidParam)
  router.get('/things/:id', (req, res) => {
    res.status(200).json({ id: req.params.id })
  })
  const app = express()
  app.use(router)
  return app
}

describe('requireUuidParam', () => {
  it('deixa passar um UUID válido', async () => {
    const res = await request(buildApp()).get('/things/a74dfc5a-12f3-45aa-a146-313f3605c497')
    expect(res.status).toBe(200)
  })

  it('aceita UUID determinístico sem versão RFC (ids de seed do motor)', async () => {
    const res = await request(buildApp()).get('/things/00000000-0000-0000-0000-000000000020')
    expect(res.status).toBe(200)
  })

  it.each(['abc', '1 OR 1=1', 'a74dfc5a-12f3-45aa-a146-313f3605c49', '%00'])(
    'recusa %s com 400',
    async (id) => {
      const res = await request(buildApp()).get(`/things/${encodeURIComponent(id)}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('id deve ser um UUID válido')
    },
  )
})
