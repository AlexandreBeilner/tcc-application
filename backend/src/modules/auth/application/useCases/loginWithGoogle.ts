import { AccountSuspendedError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { AccountProvisioner } from '../ports/accountProvisioner'
import type { GoogleIdentityProvider } from '../ports/googleIdentityProvider'
import type { TokenIssuer } from '../ports/tokenIssuer'
import type { UserRepository } from '../ports/userRepository'
import { generateUniqueUsername, usernameFromEmail } from '../services/usernameGenerator'

export type LoginWithGoogleInput = { code: string } | { idToken: string }

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
    // pra mesma pessoa.
    let user = existingIdentity
      ? await this.userRepository.findById(existingIdentity.userId)
      : await this.userRepository.findByEmail(profile.email)

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
      })
      // Capital inicial padronizado (RNF06) — só na criação, nunca ao
      // reaproveitar uma conta/identidade já existente.
      await this.accountProvisioner.provision(user.id)
    }

    // Antes de vincular identidade nova: conta suspensa não ganha provedor novo.
    if (user.status === 'suspended') {
      throw new AccountSuspendedError('account_suspended')
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
