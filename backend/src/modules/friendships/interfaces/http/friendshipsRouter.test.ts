import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListFriendRequestsUseCase } from '../../application/useCases/listFriendRequests'
import { ListFriendsUseCase } from '../../application/useCases/listFriends'
import { RemoveFriendshipUseCase } from '../../application/useCases/removeFriendship'
import { RespondToFriendRequestUseCase } from '../../application/useCases/respondToFriendRequest'
import { SearchUsersUseCase } from '../../application/useCases/searchUsers'
import { SendFriendRequestUseCase } from '../../application/useCases/sendFriendRequest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createFriendshipsRouter } from './friendshipsRouter'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice', avatarUrl: null }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob', avatarUrl: null }

function buildApp() {
  const friendshipRepository = createFakeFriendshipRepository()
  const userDirectory = createFakeUserDirectory([alice, bob])
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(
    createFriendshipsRouter({
      searchUsers: new SearchUsersUseCase(userDirectory),
      sendFriendRequest: new SendFriendRequestUseCase(friendshipRepository, userDirectory),
      respondToFriendRequest: new RespondToFriendRequestUseCase(friendshipRepository),
      removeFriendship: new RemoveFriendshipUseCase(friendshipRepository),
      listFriends: new ListFriendsUseCase(friendshipRepository, userDirectory),
      listFriendRequests: new ListFriendRequestsUseCase(friendshipRepository, userDirectory),
      authMiddleware,
    }),
  )
  return { app, tokenIssuer, friendshipRepository }
}

describe('friendships routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /users/search retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/users/search?q=bob')

    expect(res.status).toBe(401)
  })

  it('GET /users/search retorna usuários que combinam com a busca', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .get('/users/search?q=bob')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
    expect(res.body.users[0].username).toBe('bob')
  })

  it('GET /users/search retorna 400 sem parâmetro q', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).get('/users/search').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('POST /friendships cria solicitação e retorna 201', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/friendships')
      .set('Authorization', `Bearer ${token}`)
      .send({ addresseeUsername: bob.username })

    expect(res.status).toBe(201)
    expect(res.body.friendship.status).toBe('pending')
  })

  it('POST /friendships retorna 404 pra username inexistente', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/friendships')
      .set('Authorization', `Bearer ${token}`)
      .send({ addresseeUsername: 'ninguem' })

    expect(res.status).toBe(404)
  })

  it('POST /friendships/:id/accept aceita a solicitação', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    const created = await friendshipRepository.create(alice.id, bob.id)
    const token = tokenIssuer.issue({ sub: bob.id, role: 'user' })

    const res = await request(app)
      .post(`/friendships/${created.id}/accept`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.friendship.status).toBe('accepted')
  })

  it('POST /friendships/:id/accept retorna 403 pra quem não é o destinatário', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    const created = await friendshipRepository.create(alice.id, bob.id)
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post(`/friendships/${created.id}/accept`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('DELETE /friendships/:id cancela solicitação pendente e retorna 204', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    const created = await friendshipRepository.create(alice.id, bob.id)
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .delete(`/friendships/${created.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })

  it('DELETE /friendships/:id desfaz amizade já aceita (6.9.3) e retorna 204', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    const created = await friendshipRepository.create(alice.id, bob.id)
    await friendshipRepository.accept(created.id)
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .delete(`/friendships/${created.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
    await expect(friendshipRepository.findById(created.id)).resolves.toBeUndefined()
  })

  it('GET /friendships lista amigos aceitos, paginado', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    const created = await friendshipRepository.create(alice.id, bob.id)
    await friendshipRepository.accept(created.id)
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).get('/friendships').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.friends).toHaveLength(1)
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, totalEntries: 1, totalPages: 1 })
  })

  it('GET /friendships rejeita parâmetro de ordenação inválido', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .get('/friendships?sort=invalido')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('GET /friendships/requests separa recebidas de enviadas, cada uma paginada', async () => {
    const { app, tokenIssuer, friendshipRepository } = buildApp()
    await friendshipRepository.create(bob.id, alice.id)
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .get('/friendships/requests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.received.items).toHaveLength(1)
    expect(res.body.received.totalEntries).toBe(1)
    expect(res.body.sent.items).toHaveLength(0)
    expect(res.body.sent.totalEntries).toBe(0)
  })
})
