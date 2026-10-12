import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app'

describe('CORS (tarefa 6.0.1)', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl
  })

  it('libera a origem configurada em FRONTEND_URL', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com'

    const res = await request(createApp()).get('/health').set('Origin', 'https://app.example.com')

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com')
  })

  it('usa http://localhost:5173 como padrão quando FRONTEND_URL não está definida', async () => {
    delete process.env.FRONTEND_URL

    const res = await request(createApp()).get('/health').set('Origin', 'http://localhost:5173')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('sempre reflete a origem configurada, nunca a origem da requisição', async () => {
    // `cors` com `origin` string fixa devolve sempre esse valor, não a
    // origem recebida — é o navegador quem compara e bloqueia a resposta
    // se a origem da página não bater com este header (é aí que a proteção
    // de fato acontece, não em um filtro server-side aqui).
    process.env.FRONTEND_URL = 'https://app.example.com'

    const res = await request(createApp()).get('/health').set('Origin', 'https://outra-origem.com')

    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com')
  })
})

describe('Assembleia de Acionistas (MO.6.4): rotas atrás de ASSEMBLIES_ENABLED', () => {
  const original = process.env.ASSEMBLIES_ENABLED
  const id = '11111111-1111-4111-8111-111111111111'

  afterEach(() => {
    if (original === undefined) delete process.env.ASSEMBLIES_ENABLED
    else process.env.ASSEMBLIES_ENABLED = original
  })

  it('desligada de emergência (off): as rotas não existem e o job não é exposto', async () => {
    process.env.ASSEMBLIES_ENABLED = 'off'
    const app = createApp()
    expect((await request(app).get(`/assemblies/${id}/me`)).status).toBe(404)
    expect(app.locals.runAssemblyLifecycle).toBeUndefined()
  })

  it('ligada por padrão (sem a variável): as rotas exigem login e o job do ciclo é exposto ao server.ts', async () => {
    delete process.env.ASSEMBLIES_ENABLED
    const app = createApp()
    expect((await request(app).get(`/assemblies/${id}/me`)).status).toBe(401)
    expect((await request(app).post(`/assemblies/${id}/vote`).send({})).status).toBe(401)
    expect(app.locals.runAssemblyLifecycle).toBeDefined()
  })
})
