import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  AccountSuspendedError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  UsernameAlreadyInUseError,
  UserNotFoundError,
} from '../../domain/errors'
import type { GoogleIdentityProvider } from '../../application/ports/googleIdentityProvider'
import type { GetCurrentUserUseCase } from '../../application/useCases/getCurrentUser'
import type { LoginUserUseCase } from '../../application/useCases/loginUser'
import type { LoginWithGoogleUseCase } from '../../application/useCases/loginWithGoogle'
import type { ReauthenticateUseCase } from '../../application/useCases/reauthenticate'
import type { RegisterUserUseCase } from '../../application/useCases/registerUser'
import {
  googleTokenBodySchema,
  loginBodySchema,
  reauthBodySchema,
  registerBodySchema,
} from './schemas'
import { toPublicUser } from './userSerializer'

export interface AuthRouterDeps {
  registerUser: RegisterUserUseCase
  loginUser: LoginUserUseCase
  getCurrentUser: GetCurrentUserUseCase
  loginWithGoogle: LoginWithGoogleUseCase
  reauthenticate: ReauthenticateUseCase
  googleIdentityProvider: GoogleIdentityProvider
  authMiddleware: AuthMiddleware
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
      if (err instanceof AccountSuspendedError) {
        res.status(403).json({ error: 'account_suspended' })
        return
      }
      throw err
    }
  })

  // N.22: confere a senha de quem já está logado e devolve token novo com
  // `authTime` fresco — libera as ações destrutivas do painel (`401
  // reauth_required` nelas). 401 aqui significa senha errada, não token ruim.
  router.post('/auth/reauth', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = reauthBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'senha obrigatória' })
      return
    }

    try {
      const result = await deps.reauthenticate.execute({
        userId: req.auth.userId,
        password: parsed.data.password,
      })
      res.status(200).json({ token: result.token })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: err.message })
        return
      }
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
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
      if (err instanceof AccountSuspendedError) {
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
        res.redirect(`${frontendUrl}/auth/callback#error=account_suspended`)
        return
      }
      console.error('falha na troca de código OAuth do Google:', err)
      res.status(502).json({ error: 'falha ao autenticar com o Google' })
    }
  })

  // Pra login pelo app mobile (SDK nativo, `@react-native-google-signin/google-signin` —
  // tarefa 3.3 do backlog de app mobile): o app já chega com um idToken assinado
  // pelo Google, sem passar pelo redirect `/auth/google` (que o Google bloqueia
  // dentro de WebView desde 2021). Aditivo — as rotas de redirect acima não mudam.
  router.post('/auth/google/token', async (req, res) => {
    const parsed = googleTokenBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'idToken é obrigatório' })
      return
    }

    try {
      const result = await deps.loginWithGoogle.execute({ idToken: parsed.data.idToken })
      res.status(200).json({ token: result.token, user: toPublicUser(result.user) })
    } catch (err) {
      console.error('falha na verificação do idToken do Google:', err)
      res.status(401).json({ error: 'idToken inválido ou expirado' })
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
