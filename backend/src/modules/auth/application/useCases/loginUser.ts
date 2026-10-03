import { InvalidCredentialsError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { AdminSessionAuditor } from '../ports/adminSessionAuditor'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { TokenIssuer } from '../ports/tokenIssuer'
import type { UserRepository } from '../ports/userRepository'

export interface LoginUserInput {
  email: string
  password: string
}

export interface LoginUserResult {
  user: User
  token: string
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly sessionAuditor?: AdminSessionAuditor,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const user = await this.userRepository.findByEmail(input.email)
    // Conta só-OAuth (passwordHash nulo) não tem senha local pra comparar —
    // mesma mensagem genérica de erro que credencial inválida, de propósito.
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError('credenciais inválidas')
    }

    const valid = await this.passwordHasher.verify(input.password, user.passwordHash)
    if (!valid) {
      // Tentativa falha contra uma conta admin vai pro log de auditoria (N.22).
      if (user.role === 'admin') {
        await this.sessionAuditor?.record({ adminId: user.id, kind: 'login_failed' })
      }
      throw new InvalidCredentialsError('credenciais inválidas')
    }

    if (user.role === 'admin') {
      await this.sessionAuditor?.record({ adminId: user.id, kind: 'login' })
    }
    const token = this.tokenIssuer.issue({ sub: user.id, role: user.role })
    return { user, token }
  }
}
