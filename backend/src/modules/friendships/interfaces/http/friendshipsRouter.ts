import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  AddresseeNotFoundError,
  FriendshipAlreadyExistsError,
  FriendshipNotFoundError,
  NotAuthorizedError,
  SelfFriendshipError,
} from '../../domain/errors'
import type { ListFriendRequestsUseCase } from '../../application/useCases/listFriendRequests'
import type { ListFriendsUseCase } from '../../application/useCases/listFriends'
import type { RemoveFriendshipUseCase } from '../../application/useCases/removeFriendship'
import type { RespondToFriendRequestUseCase } from '../../application/useCases/respondToFriendRequest'
import type { SearchUsersUseCase } from '../../application/useCases/searchUsers'
import type { SendFriendRequestUseCase } from '../../application/useCases/sendFriendRequest'
import {
  listFriendRequestsQuerySchema,
  listFriendsQuerySchema,
  searchUsersQuerySchema,
  sendFriendRequestBodySchema,
} from './schemas'

export interface FriendshipsRouterDeps {
  searchUsers: SearchUsersUseCase
  sendFriendRequest: SendFriendRequestUseCase
  respondToFriendRequest: RespondToFriendRequestUseCase
  removeFriendship: RemoveFriendshipUseCase
  listFriends: ListFriendsUseCase
  listFriendRequests: ListFriendRequestsUseCase
  authMiddleware: AuthMiddleware
}

export function createFriendshipsRouter(deps: FriendshipsRouterDeps): Router {
  const router = Router()

  router.get('/users/search', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = searchUsersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    const users = await deps.searchUsers.execute({ userId: req.auth.userId, query: parsed.data.q })
    res.status(200).json({ users })
  })

  router.post('/friendships', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = sendFriendRequestBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const friendship = await deps.sendFriendRequest.execute({
        requesterId: req.auth.userId,
        addresseeUsername: parsed.data.addresseeUsername,
      })
      res.status(201).json({ friendship })
    } catch (err) {
      if (err instanceof AddresseeNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof SelfFriendshipError) {
        res.status(400).json({ error: err.message })
        return
      }
      if (err instanceof FriendshipAlreadyExistsError) {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/friendships/:id/accept', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const friendship = await deps.respondToFriendRequest.execute({
        // Express 5 infere `params` como `string | string[]` com mais de um
        // handler nesta rota (authMiddleware + handler) — mesmo padrão já
        // documentado em `lessonsRouter`/`missionsRouter`.
        friendshipId: req.params.id as string,
        userId: req.auth.userId,
      })
      res.status(200).json({ friendship })
    } catch (err) {
      if (err instanceof FriendshipNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof NotAuthorizedError) {
        res.status(403).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.delete('/friendships/:id', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      await deps.removeFriendship.execute({
        friendshipId: req.params.id as string,
        userId: req.auth.userId,
      })
      res.status(204).send()
    } catch (err) {
      if (err instanceof FriendshipNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof NotAuthorizedError) {
        res.status(403).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.get('/friendships', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = listFriendsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    const result = await deps.listFriends.execute({
      userId: req.auth.userId,
      page: parsed.data.page,
      sort: parsed.data.sort,
    })
    res.status(200).json({
      friends: result.items,
      page: result.page,
      pageSize: result.pageSize,
      totalEntries: result.totalEntries,
      totalPages: result.totalPages,
    })
  })

  router.get('/friendships/requests', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = listFriendRequestsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    const requests = await deps.listFriendRequests.execute({
      userId: req.auth.userId,
      receivedPage: parsed.data.receivedPage,
      sentPage: parsed.data.sentPage,
      sort: parsed.data.sort,
    })
    res.status(200).json(requests)
  })

  return router
}
