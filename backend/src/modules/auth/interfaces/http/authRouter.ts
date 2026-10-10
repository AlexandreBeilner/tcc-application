import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  AccountSuspendedError,
  EmailAlreadyInUseError,
  EmailNotVerifiedError,
  GoogleEmailNotVerifiedError,
  InvalidEmailTokenError,
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
import type { RequestPasswordResetUseCase } from '../../application/useCases/requestPasswordReset'
import type { ResetPasswordUseCase } from '../../application/useCases/resetPassword'
import type { SendEmailVerificationUseCase } from '../../application/useCases/sendEmailVerification'
import type { VerifyEmailUseCase } from '../../application/useCases/verifyEmail'
import {
  forgotPasswordBodySchema,
  googleTokenBodySchema,
  loginBodySchema,
  reauthBodySchema,
  registerBodySchema,
  resendVerificationBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from './schemas'
import { toPublicUser } from './userSerializer'

export interface AuthRouterDeps {
  registerUser: RegisterUserUseCase
  loginUser: LoginUserUseCase
  getCurrentUser: GetCurrentUserUseCase
  loginWithGoogle: LoginWithGoogleUseCase
  reauthenticate: ReauthenticateUseCase
  requestPasswordReset: RequestPasswordResetUseCase
  resetPassword: ResetPasswordUseCase
  sendEmailVerification: SendEmailVerificationUseCase
  verifyEmail: VerifyEmailUseCase
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
      // Sem token (D2): a sessão só nasce depois de verificar o e-mail e entrar.
      res.status(201).json({ user: toPublicUser(result.user), emailVerificationRequired: true })
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
      if (err instanceof EmailNotVerifiedError) {
        res.status(403).json({ error: 'email_not_verified' })
        return
      }
      throw err
    }
  })

  // EM.3.1: reenvio do link de verificação. Resposta idêntica exista a conta ou não, já esteja
  // verificada ou não (sem enumeração de e-mail).
  router.post('/auth/resend-verification', async (req, res) => {
    const parsed = resendVerificationBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'e-mail inválido' })
      return
    }

    await deps.sendEmailVerification.execute({ email: parsed.data.email })
    res.status(202).json({
      message:
        'Se existir uma conta pendente com esse e-mail, enviamos um novo link de verificação.',
    })
  })

  router.post('/auth/verify-email', async (req, res) => {
    const parsed = verifyEmailBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'token obrigatório' })
      return
    }

    try {
      await deps.verifyEmail.execute(parsed.data)
      res.status(200).json({ message: 'e-mail verificado' })
    } catch (err) {
      if (err instanceof InvalidEmailTokenError) {
        // Mesma convenção do reset: desconhecido => 401; venceu ou já usado => 410 (a tela oferece reenviar).
        if (err.reason === 'invalid') {
          res.status(401).json({ error: 'invalid_token' })
          return
        }
        res.status(410).json({ error: err.reason === 'expired' ? 'token_expired' : 'token_used' })
        return
      }
      throw err
    }
  })

  // EM.2.2: resposta idêntica exista a conta ou não (sem enumeração de e-mail). O trabalho pesado
  // é só gravar no outbox, então o tempo de resposta também não denuncia.
  router.post('/auth/forgot-password', async (req, res) => {
    const parsed = forgotPasswordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'e-mail inválido' })
      return
    }

    await deps.requestPasswordReset.execute({ email: parsed.data.email })
    res.status(202).json({
      message: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.',
    })
  })

  router.post('/auth/reset-password', async (req, res) => {
    const parsed = resetPasswordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'dados de redefinição inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      await deps.resetPassword.execute(parsed.data)
      res.status(200).json({ message: 'senha redefinida' })
    } catch (err) {
      if (err instanceof InvalidEmailTokenError) {
        // Desconhecido => 401; existiu mas venceu ou já foi usado => 410 (o frontend oferece pedir outro).
        if (err.reason === 'invalid') {
          res.status(401).json({ error: 'invalid_token' })
          return
        }
        res.status(410).json({ error: err.reason === 'expired' ? 'token_expired' : 'token_used' })
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
      if (err instanceof GoogleEmailNotVerifiedError) {
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
        res.redirect(`${frontendUrl}/auth/callback#error=google_email_not_verified`)
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
