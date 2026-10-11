import { AccountSuspendedError, GoogleEmailNotVerifiedError } from '../../domain/errors'
import type { User } from '../../domain/user'
import { notifySafely } from '../notifySafely'
import type { AccountMailer } from '../ports/accountMailer'
import type { AccountProvisioner } from '../ports/accountProvisioner'
import type { ReferralAttributor } from '../ports/referralAttributor'
import type { GoogleIdentityProvider } from '../ports/googleIdentityProvider'
import type { TokenIssuer } from '../ports/tokenIssuer'
import type { UserRepository } from '../ports/userRepository'
import { generateUniqueUsername, usernameFromEmail } from '../services/usernameGenerator'

// `referralCode` (MO.7.2) só vale quando a chamada cria a conta; em conta existente é ignorado.
export type LoginWithGoogleInput = ({ code: string } | { idToken: string }) & {
  referralCode?: string
}

export interface LoginWithGoogleResult {
  user: User
  token: string
}

export class LoginWithGoogleUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly googleIdentityProvider: GoogleIdentityProvider,
    private readonly tokenIssuer: TokenIssuer,
    private readonly accountProvisioner: AccountProvisioner,
    private readonly accountMailer: AccountMailer,
    private readonly referralAttributor?: ReferralAttributor,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<LoginWithGoogleResult> {
    const profile =
      'code' in input
        ? await this.googleIdentityProvider.exchangeCode(input.code)
        : await this.googleIdentityProvider.verifyIdToken(input.idToken)

    const existingIdentity = await this.userRepository.findIdentity(
      'google',
      profile.providerAccountId,
    )
    // Sem identidade ainda: tenta casar por e-mail (conta criada antes via
    // e-mail/senha) antes de criar um usuário novo — evita conta duplicada
    // pra mesma pessoa. Só casa se o Google garante o e-mail (ponto 043).
    let user = existingIdentity
      ? await this.userRepository.findById(existingIdentity.userId)
      : await this.userRepository.findByEmail(profile.email)

    // Antes de vincular identidade nova ou mexer na conta: conta suspensa não ganha provedor novo.
    if (user?.status === 'suspended') {
      throw new AccountSuspendedError('account_suspended')
    }

    if (user && !existingIdentity) {
      if (!profile.emailVerified) {
        throw new GoogleEmailNotVerifiedError('google_email_not_verified')
      }
      // Conta local que nunca confirmou o e-mail pode ter sido aberta por outra pessoa (pré-
      // sequestro, ponto 043): o titular real acabou de provar o e-mail pelo Google, então a
      // senha local some, as sessões caem e a conta passa a ser dele (D3).
      if (user.emailVerifiedAt === null) {
        await this.userRepository.revokeSessions(user.id)
        user = await this.userRepository.updateUser(user.id, {
          passwordHash: null,
          emailVerifiedAt: new Date(),
        })
      }
    }

    if (!user) {
      const username = await generateUniqueUsername(
        this.userRepository,
        usernameFromEmail(profile.email),
      )
      user = await this.userRepository.createUser({
        name: profile.name,
        email: profile.email,
        username,
        passwordHash: null,
        // Só nasce verificada se o Google garantiu o e-mail.
        emailVerified: profile.emailVerified,
      })
      // Capital inicial padronizado (RNF06) — só na criação, nunca ao
      // reaproveitar uma conta/identidade já existente.
      await this.accountProvisioner.provision(user.id)
      if (input.referralCode && this.referralAttributor) {
        try {
          await this.referralAttributor.attribute(user.id, input.referralCode)
        } catch (err) {
          console.error('[auth] falha ao registrar a indicação', err)
        }
      }
      // Boas-vindas (E5): só quando o Google garantiu o e-mail (conta nasce verificada).
      if (profile.emailVerified) {
        const created = user
        await notifySafely('as boas-vindas', () =>
          this.accountMailer.sendWelcome({
            userId: created.id,
            to: created.email,
            name: created.name,
          }),
        )
      }
    }

    if (!existingIdentity) {
      await this.userRepository.createIdentity({
        userId: user.id,
        providerName: 'google',
        providerAccountId: profile.providerAccountId,
      })
    }

    const token = this.tokenIssuer.issue({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })
    return { user, token }
  }
}
