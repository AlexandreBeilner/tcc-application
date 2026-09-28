import request from 'supertest'

// Suíte ponta a ponta (tarefa 7.3) bate no gateway real (nginx, porta 8000
// por padrão, ver docker-compose.yml), nunca em createApp() em processo —
// diferente de todo teste de router do resto do repo. Sem stack de pé, toda
// chamada falha por erro de conexão (o critério de aceite explícito é
// "falha se qualquer serviço não estiver de pé", não um verde por acidente).
export function e2eBaseUrl(): string {
  return process.env.E2E_BASE_URL ?? 'http://localhost:8000'
}

export function api() {
  return request(e2eBaseUrl())
}

export function authed(token: string) {
  return {
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => api().post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => api().patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`),
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
