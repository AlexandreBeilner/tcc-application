import { EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { AccountProvisioner } from '../ports/accountProvisioner'
import type { ReferralAttributor } from '../ports/referralAttributor'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { UserRepository } from '../ports/userRepository'
import type { SendEmailVerificationUseCase } from './sendEmailVerification'

export interface RegisterUserInput {
  name: string
  email: string
  username: string
  password: string
  // Código do link de indicação (MO.7.2); opcional e ignorado se inválido.
  referralCode?: string
}

// Sem token: a conta só entra depois de verificar o e-mail (D2).
export interface RegisterUserResult {
  user: User
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accountProvisioner: AccountProvisioner,
    private readonly emailVerification: Pick<SendEmailVerificationUseCase, 'sendToUser'>,
    private readonly referralAttributor?: ReferralAttributor,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    if (await this.userRepository.findByEmail(input.email)) {
      throw new EmailAlreadyInUseError('e-mail já cadastrado')
    }
    if (await this.userRepository.findByUsername(input.username)) {
      throw new UsernameAlreadyInUseError('username já em uso')
    }

    const passwordHash = await this.passwordHasher.hash(input.password)
    // `role` nunca é definido aqui — autocadastro sempre cria usuário comum
    // (RNF07); `role: 'admin'` só existe via src/db/seed.ts.
    const user = await this.userRepository.createUser({
      name: input.name,
      email: input.email,
      username: input.username,
      passwordHash,
    })

    // Capital inicial padronizado (RNF06) — toda conta nova nasce com o
    // mesmo saldo simulado, aberta no motor de simulação.
    await this.accountProvisioner.provision(user.id)

    await this.attributeReferral(user.id, input.referralCode)

    // Falha ao enfileirar o link nunca derruba o cadastro: a conta já existe e a pessoa pede
    // outro link pela tela de login (reenvio).
    try {
      await this.emailVerification.sendToUser(user)
    } catch (err) {
      console.error('[auth] falha ao enfileirar o e-mail de verificação', err)
    }
    return { user }
  }

  // Indicação nunca derruba o cadastro: a conta já existe.
  private async attributeReferral(userId: string, referralCode: string | undefined) {
    if (!referralCode || !this.referralAttributor) return
    try {
      await this.referralAttributor.attribute(userId, referralCode)
    } catch (err) {
      console.error('[auth] falha ao registrar a indicação', err)
    }
  }
}
