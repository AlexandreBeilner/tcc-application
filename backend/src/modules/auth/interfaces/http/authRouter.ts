import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  UsernameAlreadyInUseError,
  UserNotFoundError,
} from '../../domain/errors'
import type { User } from '../../domain/user'
import type { GoogleIdentityProvider } from '../../application/ports/googleIdentityProvider'
import type { GetCurrentUserUseCase } from '../../application/useCases/getCurrentUser'
import type { LoginUserUseCase } from '../../application/useCases/loginUser'
import type { LoginWithGoogleUseCase } from '../../application/useCases/loginWithGoogle'
import type { RegisterUserUseCase } from '../../application/useCases/registerUser'
import { loginBodySchema, registerBodySchema } from './schemas'

export interface AuthRouterDeps {
  registerUser: RegisterUserUseCase
  loginUser: LoginUserUseCase
  getCurrentUser: GetCurrentUserUseCase
  loginWithGoogle: LoginWithGoogleUseCase
  googleIdentityProvider: GoogleIdentityProvider
  authMiddleware: AuthMiddleware
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
  }
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router()

  router.post('/auth/register', async (req, res) => {
    const parsed = registerBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'dados de cadastro inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const result = await deps.registerUser.execute(parsed.data)
      res.status(201).json({ token: result.token, user: toPublicUser(result.user) })
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError || err instanceof UsernameAlreadyInUseError) {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/auth/login', async (req, res) => {
    const parsed = loginBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'e-mail e senha são obrigatórios' })
      return
    }

    try {
      const result = await deps.loginUser.execute(parsed.data)
      res.status(200).json({ token: result.token, user: toPublicUser(result.user) })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: err.message })
        return
      }
      throw err
    }
  })

  // Sem caso de uso próprio: montar a URL de autorização não tem regra de
  // negócio, só delega pro adapter — um RequestHandler cobre o suficiente.
  router.get('/auth/google', (_req, res) => {
    const state = randomUUID()
    res.redirect(deps.googleIdentityProvider.buildAuthUrl(state))
  })

  router.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code ausente' })
      return
    }

    try {
      const result = await deps.loginWithGoogle.execute({ code })
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      res.redirect(`${frontendUrl}/auth/callback#token=${result.token}`)
    } catch (err) {
      console.error('falha na troca de código OAuth do Google:', err)
      res.status(502).json({ error: 'falha ao autenticar com o Google' })
    }
  })

  router.get('/auth/me', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const user = await deps.getCurrentUser.execute({ userId: req.auth.userId })
      res.status(200).json({ user: toPublicUser(user) })
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
